"""Prepare 50 synthetic products or serve the isolated local load test."""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.loadtest"

import django

django.setup()

from django.conf import settings  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.db import transaction  # noqa: E402


def prepare():
    import psycopg

    db = settings.DATABASES["default"]
    if db["HOST"] not in {"localhost", "127.0.0.1"} or db["NAME"] != "tti_loadtest":
        raise RuntimeError("Only the local tti_loadtest database is allowed.")
    with psycopg.connect(
        host=db["HOST"], port=db["PORT"], user=db["USER"],
        password=db["PASSWORD"], dbname="postgres", autocommit=True,
        connect_timeout=5,
    ) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname='tti_loadtest'").fetchone():
            conn.execute("CREATE DATABASE tti_loadtest")
    call_command("migrate", interactive=False, verbosity=0)
    from apps.catalog.models import Brand, Category, Product, Variant
    from apps.inventory.models import InventoryBalance

    with transaction.atomic():
        if Product.objects.exclude(slug__startswith="load-product-").exists():
            raise RuntimeError("Unexpected data in the load-test database; refusing to alter it.")
        for index in range(1, 51):
            group = (index - 1) % 5 + 1
            category, _ = Category.objects.get_or_create(
                slug=f"load-category-{group}", defaults={"name": f"Categoría de prueba {group}"},
            )
            brand, _ = Brand.objects.get_or_create(
                slug=f"load-brand-{group}", defaults={"name": f"Marca de prueba {group}"},
            )
            product, _ = Product.objects.get_or_create(
                slug=f"load-product-{index:03}",
                defaults={"name": f"Portátil de prueba {index:03}",
                          "description": "Producto sintético para pruebas locales de rendimiento.",
                          "warranty": "Garantía ficticia de prueba", "category": category,
                          "brand": brand, "is_active": True},
            )
            variant, _ = Variant.objects.get_or_create(
                sku=f"LOAD-{index:03}", defaults={"product": product, "name": "Estándar",
                                               "price": str(100000 + index * 10000)},
            )
            InventoryBalance.objects.update_or_create(
                variant=variant, defaults={"available_quantity": 100},
            )
        if Product.objects.count() != 50:
            raise RuntimeError("Expected exactly 50 products.")
    print("Prepared tti_loadtest: exactly 50 products, 5 categories, 5 brands; no product images.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "serve"])
    parser.add_argument("--threads", type=int, choices=[8, 16, 32], default=16)
    args = parser.parse_args()
    if args.action == "prepare":
        prepare()
    else:
        from waitress import serve

        from config.wsgi import application

        serve(application, host="127.0.0.1", port=8010, threads=args.threads,
              connection_limit=1500, backlog=2048)
