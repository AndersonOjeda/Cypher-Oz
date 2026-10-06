import pytest
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("kind,model", [("categories", Category), ("brands", Brand)])
def test_public_taxonomy_only_lists_active_and_never_writes(kind, model):
    active = model.objects.create(name="Visible", slug="visible")
    model.objects.create(name="Hidden", slug="hidden", is_active=False)
    client = APIClient()
    url = f"/api/v1/{kind}/"
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert [row["id"] for row in response.data["results"]] == [active.pk]
    assert client.get(url + "?active=false").data["count"] == 1
    assert client.get(url + "?search=hidden").data["count"] == 0
    assert client.post(url, {"name": "Injected", "slug": "injected"}).status_code == 405
    active.is_active = False
    active.save()
    assert client.get(url).data["count"] == 0


@pytest.mark.parametrize("kind,model", [("categories", Category), ("brands", Brand)])
def test_public_taxonomy_is_paginated(kind, model):
    model.objects.bulk_create([model(name=f"Name {i:02}", slug=f"name-{i}") for i in range(21)])
    response = APIClient().get(f"/api/v1/{kind}/")
    assert response.data["count"] == 21
    assert len(response.data["results"]) == 20
    assert response.data["next"]
