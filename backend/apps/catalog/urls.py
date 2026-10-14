from django.urls import path
from rest_framework.routers import SimpleRouter

from .variant_views import (
    CategoryAttributeDetailView,
    CategoryAttributesView,
    ProductVariantsView,
    VariantDetailView,
)
from .views import (
    BrandViewSet,
    CatalogLimitsView,
    CategoryViewSet,
    ProductImageDetailView,
    ProductImagesView,
    ProductViewSet,
)

router = SimpleRouter()
router.register("categories", CategoryViewSet)
router.register("brands", BrandViewSet)
router.register("products", ProductViewSet)
urlpatterns = router.urls + [
    path("products/<int:product_id>/variants/", ProductVariantsView.as_view()),
    path("variants/<int:variant_id>/", VariantDetailView.as_view()),
    path("categories/<int:category_id>/attributes/", CategoryAttributesView.as_view()),
    path("attributes/<int:attribute_id>/", CategoryAttributeDetailView.as_view()),
    path("catalog/limits/", CatalogLimitsView.as_view()),
    path("products/<int:product_id>/images/", ProductImagesView.as_view()),
    path("products/<int:product_id>/images/<int:image_id>/", ProductImageDetailView.as_view()),
]
