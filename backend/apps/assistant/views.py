import json
import logging
import os
import urllib.request
from urllib.error import HTTPError, URLError

from django.db.models import Prefetch, Q
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.catalog.models import Product, Variant

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Eres el asistente virtual de TTI (Tienda Tecnológica Inteligente), una tienda de "
    'tecnología ubicada en Pasto, Nariño, Colombia. Tu nombre es "Asistente TTI".\n\n'
    "REGLAS:\n"
    "- Responde SIEMPRE en español colombiano, de forma amable, breve y útil.\n"
    "- Solo puedes hablar sobre los productos de la tienda, precios, disponibilidad y "
    "ayuda con compras.\n"
    "- Si te preguntan sobre temas que no sean de la tienda, redirige amablemente al "
    "catálogo.\n"
    "- Usa las funciones search_products y get_product_detail para consultar información "
    "real y actualizada.\n"
    "- NUNCA inventes productos, precios ni disponibilidad. Si no encuentras algo, dilo "
    "honestamente.\n"
    "- Los precios están en pesos colombianos (COP). Formatea como $100.000 COP.\n"
    "- Si un producto tiene stock 0, indica que está agotado.\n"
    "- Si el cliente quiere comprar, sugiérele visitar /catalogo o /comprar en la tienda."
)

GEMINI_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "search_products",
                "description": (
                    "Busca productos en el catálogo de la tienda por nombre. "
                    "Opcionalmente filtra por categoría."
                ),
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {
                            "type": "STRING",
                            "description": "Texto de búsqueda para el nombre del producto.",
                        },
                        "category": {
                            "type": "STRING",
                            "description": ("Slug de la categoría para filtrar (opcional)."),
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "get_product_detail",
                "description": (
                    "Obtiene el detalle completo de un producto, incluyendo variantes, "
                    "precio y stock."
                ),
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "slug": {
                            "type": "STRING",
                            "description": "Slug único del producto.",
                        },
                    },
                    "required": ["slug"],
                },
            },
        ]
    }
]

FALLBACK_REPLY = "Lo siento, ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo."


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def _search_products(query: str, category: str | None = None) -> list[dict]:
    """Search active products matching *query*, optionally filtered by category slug."""
    qs = (
        Product.objects.visible()
        .select_related("category", "brand")
        .prefetch_related(
            Prefetch(
                "variants",
                queryset=Variant.objects.filter(is_active=True).select_related("inventory_balance"),
            )
        )
    )

    if query:
        qs = qs.filter(Q(name__icontains=query))

    if category:
        qs = qs.filter(category__slug=category)

    qs = qs[:5]

    results = []
    for p in qs:
        variants = p.variants.all()
        prices = [v.price for v in variants]
        min_price = min(prices) if prices else None
        total_stock = sum(
            getattr(v, "inventory_balance", None) and v.inventory_balance.available_quantity or 0
            for v in variants
        )
        results.append(
            {
                "name": p.name,
                "slug": p.slug,
                "category": p.category.name,
                "brand": p.brand.name,
                "min_price": float(min_price) if min_price is not None else None,
                "total_stock": total_stock,
                "is_available": total_stock > 0 and len(prices) > 0,
            }
        )
    return results


def _get_product_detail(slug: str) -> dict | None:
    """Return full product detail including variants with stock and price."""
    try:
        product = (
            Product.objects.visible()
            .select_related("category", "brand")
            .prefetch_related(
                Prefetch(
                    "variants",
                    queryset=Variant.objects.filter(is_active=True).select_related(
                        "inventory_balance"
                    ),
                )
            )
            .get(slug=slug)
        )
    except Product.DoesNotExist:
        return None

    variants_data = []
    for v in product.variants.all():
        stock = (
            v.inventory_balance.available_quantity
            if hasattr(v, "inventory_balance") and v.inventory_balance
            else 0
        )
        variants_data.append(
            {
                "name": v.name,
                "sku": v.sku,
                "price": float(v.price),
                "stock": stock,
                "is_available": stock > 0,
            }
        )

    total_stock = sum(v["stock"] for v in variants_data)
    prices = [v["price"] for v in variants_data]

    return {
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "warranty": product.warranty,
        "category": product.category.name,
        "brand": product.brand.name,
        "variants": variants_data,
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "total_stock": total_stock,
        "is_available": total_stock > 0 and len(variants_data) > 0,
    }


TOOL_DISPATCH = {
    "search_products": _search_products,
    "get_product_detail": _get_product_detail,
}


# ---------------------------------------------------------------------------
# Gemini API helpers
# ---------------------------------------------------------------------------


def _build_contents(message: str, history: list[dict]) -> list[dict]:
    """Translate the incoming history + new message into Gemini contents format."""
    contents: list[dict] = []
    role_map = {"user": "user", "assistant": "model"}
    for entry in history:
        role = role_map.get(entry.get("role", ""), "user")
        contents.append({"role": role, "parts": [{"text": entry.get("content", "")}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    return contents


def _call_gemini(api_key: str, contents: list[dict], include_tools: bool = True) -> dict:
    """Send a request to the Gemini API and return the parsed JSON response."""
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        **({"tools": GEMINI_TOOLS} if include_tools else {}),
        "generationConfig": {"maxOutputTokens": 768},
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode())


def _extract_text(response: dict) -> str | None:
    """Extract the text reply from a Gemini response, if present."""
    try:
        parts = response["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        return text or None
    except (KeyError, IndexError):
        pass
    return None


def _extract_function_calls(response: dict) -> list[dict]:
    """Extract function call requests from a Gemini response."""
    calls: list[dict] = []
    try:
        parts = response["candidates"][0]["content"]["parts"]
        for part in parts:
            if "functionCall" in part:
                calls.append(part["functionCall"])
    except (KeyError, IndexError):
        pass
    return calls


# ---------------------------------------------------------------------------
# View
# ---------------------------------------------------------------------------


class TextField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class HistoryEntrySerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = TextField(max_length=2000)


class ChatSerializer(serializers.Serializer):
    message = TextField(max_length=500)
    history = HistoryEntrySerializer(many=True, max_length=10, required=False, default=list)


class AssistantThrottle(AnonRateThrottle):
    scope = "assistant"
    rate = "15/min"


class AssistantChatView(APIView):
    """Public chat endpoint for the AI shopping assistant powered by Gemini."""

    permission_classes = [AllowAny]
    throttle_classes = [AssistantThrottle]
    authentication_classes = []

    def get_throttles(self):
        # Availability probes make no provider calls and must not consume chat quota.
        return [] if self.request.method == "GET" else super().get_throttles()

    def get(self, request):
        return Response({"available": bool(os.getenv("GEMINI_API_KEY", "").strip())})

    def post(self, request):
        payload = ChatSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            return Response(
                {"reply": "El asistente no está disponible en este momento."}, status=503
            )
        message = payload.validated_data["message"]
        history = payload.validated_data["history"]

        contents = _build_contents(message, history)

        try:
            response = _call_gemini(api_key, contents)
            referenced_products: dict[str, dict] = {}

            # Bound upstream calls to fit within the web request timeout.
            for round_number in range(2):
                fn_calls = _extract_function_calls(response)
                if not fn_calls:
                    break

                # Append the model's function-call turn
                contents.append(response["candidates"][0]["content"])

                # Execute each function call and collect results
                function_parts = []
                for fc in fn_calls:
                    fn_name = fc["name"]
                    fn_args = fc.get("args", {})
                    handler = TOOL_DISPATCH.get(fn_name)
                    if handler:
                        result = handler(**fn_args)
                        if isinstance(result, list):
                            for product in result:
                                if isinstance(product, dict) and product.get("slug"):
                                    referenced_products[product["slug"]] = {
                                        "name": product.get("name", ""),
                                        "slug": product["slug"],
                                        "is_available": bool(product.get("is_available")),
                                    }
                        elif isinstance(result, dict) and result.get("slug"):
                            referenced_products[result["slug"]] = {
                                "name": result.get("name", ""),
                                "slug": result["slug"],
                                "is_available": bool(result.get("is_available")),
                            }
                    else:
                        result = {"error": f"Función desconocida: {fn_name}"}
                    function_parts.append(
                        {
                            "functionResponse": {
                                "name": fn_name,
                                **({"id": fc["id"]} if "id" in fc else {}),
                                "response": {"result": result},
                            }
                        }
                    )

                contents.append({"role": "user", "parts": function_parts})
                response = _call_gemini(api_key, contents, include_tools=round_number == 0)

            text = _extract_text(response)
            if text:
                return Response({"reply": text, "products": list(referenced_products.values())})

            return Response({"reply": FALLBACK_REPLY}, status=503)

        except (HTTPError, URLError, TimeoutError) as exc:
            logger.warning("Gemini API error: %s", type(exc).__name__)
            return Response({"reply": FALLBACK_REPLY}, status=503)
        except Exception:
            logger.exception("Unexpected error in assistant chat")
            return Response({"reply": FALLBACK_REPLY}, status=503)
