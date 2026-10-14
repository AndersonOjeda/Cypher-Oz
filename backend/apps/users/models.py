import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        user = self.model(email=email.strip().lower(), **extra_fields)
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields["role"] = User.Role.ADMIN
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser):
    class Role(models.TextChoices):
        CLIENT = "CLIENT", "Cliente"
        ADMIN = "ADMIN", "Administrador"

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=6, choices=Role, default=Role.CLIENT)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(Lower("email"), name="users_email_case_insensitive_unique"),
            models.CheckConstraint(
                condition=models.Q(role__in=["CLIENT", "ADMIN"]), name="users_valid_role"
            ),
        ]


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=60)
    recipient_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    address_line = models.CharField(max_length=240)
    city = models.CharField(max_length=80, default="Pasto")
    state = models.CharField(max_length=80, default="Nariño")
    notes = models.CharField(max_length=300, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "addresses"
        ordering = ["-is_default", "-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"], condition=models.Q(is_default=True), name="address_one_default"
            ),
            models.CheckConstraint(condition=~models.Q(label=""), name="address_label_not_empty"),
            models.CheckConstraint(
                condition=~models.Q(recipient_name=""), name="address_recipient_not_empty"
            ),
            models.CheckConstraint(condition=~models.Q(phone=""), name="address_phone_not_empty"),
            models.CheckConstraint(
                condition=~models.Q(address_line=""), name="address_line_not_empty"
            ),
            models.CheckConstraint(condition=~models.Q(city=""), name="address_city_not_empty"),
            models.CheckConstraint(condition=~models.Q(state=""), name="address_state_not_empty"),
        ]


class AuthSession(models.Model):
    """JWT session revocation and serialized refresh rotation, persisted in PostgreSQL."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    refresh_jti = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
