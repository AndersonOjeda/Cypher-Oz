from django.db import IntegrityError, transaction
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, CategoryAttribute, Product, Variant
from .variant_serializers import CategoryAttributeSerializer, VariantSerializer
from .views import CatalogPagination, Conflict, PrivateAdminMixin, audit


def variant_snapshot(instance):
    return {
        "name": instance.name,
        "sku": instance.sku,
        "price": format(instance.price, ".2f"),
        "is_active": instance.is_active,
        "attributes": list(instance.attribute_values.values("attribute", "value")),
    }


def audit_changes(before, after):
    return {key: {"before": before.get(key), "after": value} for key, value in after.items()}


def variant_query():
    return Variant.objects.select_related("product__category", "product__brand").prefetch_related(
        "attribute_values__attribute"
    )


class ProductVariantsView(PrivateAdminMixin, APIView):
    def get(self, request, product_id):
        get_object_or_404(Product, pk=product_id)
        pagination = CatalogPagination()
        page = pagination.paginate_queryset(variant_query().filter(product_id=product_id), request)
        return pagination.get_paginated_response(VariantSerializer(page, many=True).data)

    def post(self, request, product_id):
        try:
            with transaction.atomic():
                product = get_object_or_404(
                    Product.objects.select_for_update(),
                    pk=product_id,
                )
                serializer = VariantSerializer(data=request.data, context={"product": product})
                serializer.is_valid(raise_exception=True)
                instance = serializer.save()
                audit(request, instance, "create", audit_changes({}, variant_snapshot(instance)))
                return Response(serializer.data, status=201)
        except IntegrityError as exc:
            raise Conflict("El SKU ya existe o los atributos tienen un conflicto.") from exc


class VariantDetailView(PrivateAdminMixin, APIView):
    def get(self, request, variant_id):
        return Response(VariantSerializer(get_object_or_404(variant_query(), pk=variant_id)).data)

    def patch(self, request, variant_id):
        try:
            with transaction.atomic():
                product_id = get_object_or_404(Variant, pk=variant_id).product_id
                # Product edits/deletion acquire this lock first, keeping categories consistent.
                product = get_object_or_404(
                    Product.objects.select_for_update(),
                    pk=product_id,
                )
                instance = get_object_or_404(Variant.objects.select_for_update(), pk=variant_id)
                instance.product = product
                before = variant_snapshot(instance)
                serializer = VariantSerializer(
                    instance, data=request.data, partial=True, context={"product": product}
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
                audit(
                    request, instance, "update", audit_changes(before, variant_snapshot(instance))
                )
                return Response(serializer.data)
        except IntegrityError as exc:
            raise Conflict("El SKU ya existe o los atributos tienen un conflicto.") from exc


class CategoryAttributesView(PrivateAdminMixin, APIView):
    def get(self, request, category_id):
        category = get_object_or_404(Category, pk=category_id)
        return Response(CategoryAttributeSerializer(category.attributes.all(), many=True).data)

    def post(self, request, category_id):
        try:
            with transaction.atomic():
                category = get_object_or_404(Category.objects.select_for_update(), pk=category_id)
                serializer = CategoryAttributeSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                instance = serializer.save(category=category)
                audit(
                    request,
                    instance,
                    "create",
                    audit_changes(
                        {}, {"category": category.pk, "code": instance.code, "name": instance.name}
                    ),
                )
                return Response(serializer.data, status=201)
        except IntegrityError as exc:
            raise Conflict("Ya existe ese código de atributo en la categoría.") from exc


class CategoryAttributeDetailView(PrivateAdminMixin, APIView):
    def patch(self, request, attribute_id):
        try:
            with transaction.atomic():
                instance = get_object_or_404(
                    CategoryAttribute.objects.select_for_update(), pk=attribute_id
                )
                before = {"code": instance.code, "name": instance.name}
                serializer = CategoryAttributeSerializer(instance, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                audit(
                    request,
                    instance,
                    "update",
                    audit_changes(before, {"code": instance.code, "name": instance.name}),
                )
                return Response(serializer.data)
        except IntegrityError as exc:
            raise Conflict("Ya existe ese código de atributo en la categoría.") from exc
