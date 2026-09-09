"""Start an isolated local E2E database/server. Never touches the normal tti database."""

import os
import subprocess
import sys
from pathlib import Path

import dj_database_url
import psycopg
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
config = dj_database_url.parse(os.environ["DATABASE_URL"])
if config["HOST"] not in {"127.0.0.1", "localhost"}:
    raise RuntimeError("E2E only accepts a local PostgreSQL server.")
with psycopg.connect(
    host=config["HOST"],
    port=config["PORT"],
    user=config["USER"],
    password=config["PASSWORD"],
    dbname="postgres",
    autocommit=True,
) as conn:
    if not conn.execute("SELECT 1 FROM pg_database WHERE datname='tti_e2e'").fetchone():
        conn.execute("CREATE DATABASE tti_e2e")
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.e2e"
subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], cwd=root, check=True)
subprocess.run([sys.executable, "manage.py", "prepare_catalog_storage"], cwd=root, check=True)
sys.path.insert(0, str(root))
import django  # noqa: E402

django.setup()
from apps.configuration.models import StoreSetting  # noqa: E402
from apps.users.models import User  # noqa: E402

admin, _ = User.objects.get_or_create(email="admin@tti.example", defaults={"name": "Admin E2E"})
admin.role = "ADMIN"
admin.set_password("E2e-Only!TestPassword8472")
admin.save()
for key, value in {
    "whatsapp_enabled": True,
    "whatsapp_number": "12025550123",
    "whatsapp_message": "Hola & gracias ¿TTI?",
}.items():
    StoreSetting.objects.update_or_create(key=key, defaults={"value": value})
subprocess.run(
    [sys.executable, "manage.py", "runserver", "127.0.0.1:8001", "--noreload"], cwd=root, check=True
)
