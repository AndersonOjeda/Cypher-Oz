"""Prepare a persistent, isolated classroom database and serve it on loopback."""

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
    raise RuntimeError("The classroom demo only accepts local PostgreSQL.")
with psycopg.connect(
    host=config["HOST"],
    port=config["PORT"],
    user=config["USER"],
    password=config["PASSWORD"],
    dbname="postgres",
    autocommit=True,
    connect_timeout=5,
) as conn:
    if not conn.execute("SELECT 1 FROM pg_database WHERE datname='tti_sprint1_demo'").fetchone():
        conn.execute("CREATE DATABASE tti_sprint1_demo")
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.demo"
subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], cwd=root, check=True)
sys.path.insert(0, str(root))
import django  # noqa: E402

django.setup()
from apps.users.models import User  # noqa: E402

admin, created = User.objects.get_or_create(
    email="admin@sprint1.example",
    defaults={"name": "Administrador demo", "role": "ADMIN"},
)
if created:
    admin.set_password("Demo-Sprint1!Clase8472")
    admin.save()
from seed_checkout_demo import seed  # noqa: E402

seed()
print("Classroom demo: http://localhost:3002 (isolated tti_sprint1_demo database)")
subprocess.run(
    [sys.executable, "manage.py", "runserver", "127.0.0.1:8002", "--noreload"],
    cwd=root,
    check=True,
)
