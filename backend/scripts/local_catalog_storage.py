"""Provision only the loopback development store and append missing local settings."""

import secrets
from pathlib import Path

from dotenv import dotenv_values, set_key

root = Path(__file__).resolve().parents[2]
env = root / ".env"
values = dotenv_values(env)
access = values.get("CATALOG_S3_ACCESS_KEY") or "local-catalog"
secret = values.get("CATALOG_S3_SECRET_KEY") or secrets.token_hex(24)


def append_missing(path, additions):
    existing = dotenv_values(path)
    for key, value in additions.items():
        if not existing.get(key):
            set_key(str(path), key, value, quote_mode="never")


append_missing(env, {"CATALOG_S3_ACCESS_KEY": access, "CATALOG_S3_SECRET_KEY": secret})
append_missing(
    root / "backend" / ".env",
    {
        "CATALOG_S3_ENDPOINT": "http://127.0.0.1:9000",
        "CATALOG_S3_ACCESS_KEY": access,
        "CATALOG_S3_SECRET_KEY": secret,
        "CATALOG_S3_REGION": "us-east-1",
        "CATALOG_S3_BUCKET": "tti-catalog-local",
    },
)
print("Local storage settings prepared; no credentials printed.")
