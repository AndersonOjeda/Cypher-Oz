import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.users.models import User


def test_bootstrap_staging_admin_skips_without_email(db, monkeypatch):
    monkeypatch.delenv("STAGING_ADMIN_EMAIL", raising=False)

    call_command("bootstrap_staging_admin")

    assert User.objects.count() == 0


def test_bootstrap_staging_admin_creates_locked_admin(db, monkeypatch):
    monkeypatch.setenv("STAGING_ADMIN_EMAIL", "Admin.Staging@example.com")
    monkeypatch.setenv("STAGING_ADMIN_NAME", "Admin de pruebas")

    call_command("bootstrap_staging_admin")

    user = User.objects.get(email="admin.staging@example.com")
    assert user.name == "Admin de pruebas"
    assert user.role == User.Role.ADMIN
    assert not user.has_usable_password()


def test_bootstrap_staging_admin_does_not_promote_existing_user(db, monkeypatch, user):
    monkeypatch.setenv("STAGING_ADMIN_EMAIL", user.email.upper())

    with pytest.raises(CommandError, match="Public accounts are never promoted"):
        call_command("bootstrap_staging_admin")

    user.refresh_from_db()
    assert user.role == User.Role.CLIENT
    assert user.has_usable_password()
