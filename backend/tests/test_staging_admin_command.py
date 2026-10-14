from django.core.management import call_command

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


def test_bootstrap_staging_admin_promotes_existing_user(db, monkeypatch, user):
    monkeypatch.setenv("STAGING_ADMIN_EMAIL", user.email.upper())

    call_command("bootstrap_staging_admin")

    user.refresh_from_db()
    assert user.role == User.Role.ADMIN
    assert user.has_usable_password()
