from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import APIException

from .models import Address, User


class DuplicateEmail(APIException):
    status_code = 409
    default_code = "EMAIL_ALREADY_EXISTS"
    default_detail = "Ya existe una cuenta con este correo."


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id",
            "label",
            "recipient_name",
            "phone",
            "address_line",
            "city",
            "state",
            "notes",
            "is_default",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        unexpected = set(self.initial_data) - (set(self.fields) - {"id"})
        if unexpected:
            raise serializers.ValidationError("Hay campos no permitidos en la dirección.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        # Lock the owner even when there are no addresses yet.
        User.objects.select_for_update().get(pk=user.pk)
        if validated_data.get("is_default") or not user.addresses.exists():
            user.addresses.update(is_default=False)
            validated_data["is_default"] = True
        return Address.objects.create(user=user, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        User.objects.select_for_update().get(pk=instance.user_id)
        instance = get_object_or_404(Address, pk=instance.pk, user_id=instance.user_id)
        if validated_data.get("is_default"):
            instance.user.addresses.exclude(pk=instance.pk).update(is_default=False)
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    addresses = AddressSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "addresses"]
        read_only_fields = fields


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "email"]
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise DuplicateEmail()
        return value

    def validate(self, attrs):
        if set(self.initial_data) - set(self.fields):
            raise serializers.ValidationError("Hay campos no permitidos en el perfil.")
        return attrs

    def update(self, instance, validated_data):
        if not validated_data:
            return instance
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            with transaction.atomic():
                instance.save(update_fields=[*validated_data.keys()])
        except IntegrityError as exc:
            if "email" in validated_data:
                raise DuplicateEmail() from exc
            raise
        return instance


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise DuplicateEmail()
        return value

    def validate(self, attrs):
        if set(self.initial_data) - {"name", "email", "password"}:
            raise serializers.ValidationError("Hay campos no permitidos en el registro.")
        user = User(name=attrs["name"], email=attrs["email"])
        try:
            validate_password(attrs["password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, role=User.Role.CLIENT)
        user.set_password(password)
        try:
            with transaction.atomic():
                user.save()
        except IntegrityError as exc:
            if User.objects.filter(email__iexact=user.email).exists():
                raise DuplicateEmail() from exc
            raise
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=128)
