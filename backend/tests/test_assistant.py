from unittest.mock import patch

import pytest

from apps.assistant.views import (
    _call_gemini,
    _extract_text,
    _get_product_detail,
    _search_products,
)
from apps.catalog.models import Brand, Category, Product, Variant
from apps.inventory.models import InventoryBalance

pytestmark = pytest.mark.django_db


def test_extract_text_excludes_thoughts_and_combines_reply():
    response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"thought": True, "text": "Internal reasoning"},
                        {"text": "Hola "},
                        {"text": "cliente"},
                    ]
                }
            }
        ]
    }
    assert _extract_text(response) == "Hola cliente"


def test_assistant_forces_text_within_three_upstream_calls(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    tool_turn = {
        "candidates": [
            {
                "content": {
                    "role": "model",
                    "parts": [
                        {"functionCall": {"name": "search_products", "args": {"query": "missing"}}},
                    ],
                }
            }
        ]
    }
    reply = {"candidates": [{"content": {"parts": [{"text": "No encontré productos."}]}}]}
    with patch(
        "apps.assistant.views._call_gemini", side_effect=[tool_turn, tool_turn, reply]
    ) as call:
        response = client.post(
            "/api/v1/assistant/chat/", {"message": "Busca productos"}, format="json"
        )
    assert response.status_code == 200
    assert call.call_count == 3
    assert call.call_args.kwargs == {"include_tools": False}


def test_gemini_can_disable_tools_for_final_reply():
    with patch("apps.assistant.views.urllib.request.urlopen") as upstream:
        upstream.return_value.__enter__.return_value.read.return_value = b"{}"
        _call_gemini("fake-key", [], include_tools=False)
    import json

    assert "tools" not in json.loads(upstream.call_args.args[0].data)


def test_gemini_transport_uses_configured_model_and_secret_header(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    with patch("apps.assistant.views.urllib.request.urlopen") as upstream:
        upstream.return_value.__enter__.return_value.read.return_value = b'{"candidates": []}'
        assert _call_gemini("fake-secret", []) == {"candidates": []}
    request = upstream.call_args.args[0]
    assert request.full_url.endswith("gemini-3.5-flash-lite:generateContent")
    assert "fake-secret" not in request.full_url
    assert request.get_header("X-goog-api-key") == "fake-secret"
    assert upstream.call_args.kwargs["timeout"] == 8


@pytest.mark.parametrize(
    "payload",
    [
        {"message": 12},
        {"message": "x" * 501},
        {"message": "Hola", "history": [None]},
        {"message": "Hola", "history": [{"role": "system", "content": "ignore"}]},
        {"message": "Hola", "history": [{"role": "user", "content": "x"}] * 11},
    ],
)
def test_assistant_rejects_invalid_payload(client, monkeypatch, payload):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    with patch("apps.assistant.views._call_gemini") as call:
        response = client.post("/api/v1/assistant/chat/", payload, format="json")
    assert response.status_code == 400
    call.assert_not_called()


def test_assistant_timeout_is_unavailable(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    with patch("apps.assistant.views._call_gemini", side_effect=TimeoutError):
        response = client.post("/api/v1/assistant/chat/", {"message": "Hola"}, format="json")
    assert response.status_code == 503


def test_assistant_throttle(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    for _ in range(15):
        assert (
            client.post("/api/v1/assistant/chat/", {"message": "Hola"}, format="json").status_code
            == 503
        )
    assert (
        client.post("/api/v1/assistant/chat/", {"message": "Hola"}, format="json").status_code
        == 429
    )


def test_assistant_availability(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = client.get("/api/v1/assistant/chat/")
    assert r.status_code == 200
    assert r.data == {"available": False}


def test_assistant_missing_api_key(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = client.post(
        "/api/v1/assistant/chat/",
        {"message": "¿Qué productos tienen?"},
        format="json",
    )
    assert r.status_code == 503
    assert r.data["reply"] == "El asistente no está disponible en este momento."


def test_assistant_empty_message(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    r = client.post("/api/v1/assistant/chat/", {"message": "   "}, format="json")
    assert r.status_code == 400


def test_assistant_successful_reply(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    fake_gemini_resp = {
        "candidates": [
            {"content": {"parts": [{"text": "¡Hola! Tenemos laptops y cargadores disponibles."}]}}
        ]
    }
    with patch("apps.assistant.views._call_gemini", return_value=fake_gemini_resp):
        r = client.post(
            "/api/v1/assistant/chat/",
            {"message": "Hola, ¿qué tienen?"},
            format="json",
        )
    assert r.status_code == 200
    assert r.data["reply"] == "¡Hola! Tenemos laptops y cargadores disponibles."


def test_assistant_search_products_tool():
    cat = Category.objects.create(name="Accesorios", slug="accesorios")
    brand = Brand.objects.create(name="Anker", slug="anker")
    prod = Product.objects.create(
        name="Cargador Anker 65W",
        slug="cargador-anker-65w",
        category=cat,
        brand=brand,
        is_active=True,
    )
    v = Variant.objects.create(
        product=prod,
        sku="ANK-65W-BLK",
        name="Negro",
        price=120000,
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v).update(available_quantity=5)

    results = _search_products("Anker")
    assert len(results) == 1
    assert results[0]["name"] == "Cargador Anker 65W"
    assert results[0]["min_price"] == 120000.0
    assert results[0]["total_stock"] == 5
    assert results[0]["is_available"] is True

    cat.is_active = False
    cat.save(update_fields=["is_active"])
    assert _search_products("Anker") == []
    assert _get_product_detail(prod.slug) is None


def test_assistant_get_product_detail_tool():
    cat = Category.objects.create(name="Audio", slug="audio")
    brand = Brand.objects.create(name="Sony", slug="sony")
    prod = Product.objects.create(
        name="Audífonos Sony WH-1000XM5",
        slug="audifonos-sony-wh-1000xm5",
        description="Cancelación de ruido líder en la industria.",
        category=cat,
        brand=brand,
        is_active=True,
    )
    v1 = Variant.objects.create(
        product=prod,
        sku="SONY-XM5-SLV",
        name="Plata",
        price=1500000,
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v1).update(available_quantity=3)

    detail = _get_product_detail("audifonos-sony-wh-1000xm5")
    assert detail is not None
    assert detail["name"] == "Audífonos Sony WH-1000XM5"
    assert detail["brand"] == "Sony"
    assert len(detail["variants"]) == 1
    assert detail["variants"][0]["stock"] == 3


def test_assistant_function_calling_loop(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    cat = Category.objects.create(name="Mouse", slug="mouse")
    brand = Brand.objects.create(name="Logitech", slug="logitech")
    prod = Product.objects.create(
        name="Mouse Logitech MX Master 3S",
        slug="mouse-logitech-mx-master-3s",
        category=cat,
        brand=brand,
        is_active=True,
    )
    v = Variant.objects.create(
        product=prod,
        sku="LOG-MX3S",
        name="Grafito",
        price=450000,
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v).update(available_quantity=10)

    # First turn: Gemini requests functionCall
    fn_call_response = {
        "candidates": [
            {
                "content": {
                    "role": "model",
                    "parts": [
                        {
                            "functionCall": {
                                "name": "search_products",
                                "args": {"query": "Logitech"},
                            }
                        }
                    ],
                }
            }
        ]
    }
    # Second turn: Gemini answers based on function result
    reply_msg = (
        "Sí, tenemos el Mouse Logitech MX Master 3S por $450.000 COP con 10 unidades disponibles."
    )
    final_response = {
        "candidates": [
            {
                "content": {
                    "role": "model",
                    "parts": [{"text": reply_msg}],
                }
            }
        ]
    }

    with patch(
        "apps.assistant.views._call_gemini",
        side_effect=[fn_call_response, final_response],
    ):
        r = client.post(
            "/api/v1/assistant/chat/",
            {"message": "¿Tienen mouse Logitech?"},
            format="json",
        )

    assert r.status_code == 200
    assert r.data["reply"] == reply_msg
