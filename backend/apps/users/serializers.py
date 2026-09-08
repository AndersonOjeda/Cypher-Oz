from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.exceptions import APIException

from .models import User


class DuplicateEmail(APIException):
    status_code = 409
    default_code = "EMAIL_ALREADY_EXISTS"
    default_detail = "Ya existe una cuenta con este correo."


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email", "role"]
        read_only_fields = fields


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
