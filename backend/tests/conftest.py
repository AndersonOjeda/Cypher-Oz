import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.users.models import User

PASSWORD = "Una-clave!Distinta8472"


@pytest.fixture(autouse=True)
def clear_throttle():
    cache.clear()


@pytest.fixture
def client():
    client = APIClient(enforce_csrf_checks=True)
    token = client.get("/api/v1/auth/csrf/").data["csrfToken"]
    client.credentials(HTTP_X_CSRFTOKEN=token)
    return client


@pytest.fixture
def user(db):
    return User.objects.create_user("cliente@example.com", PASSWORD, name="Cliente TTI")


@pytest.fixture
def logged_in(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {
            "email": user.email,
            "password": PASSWORD,
        },
        format="json",
    )
    assert response.status_code == 200
    client.credentials(HTTP_X_CSRFTOKEN=response.data["csrfToken"])
    return client
