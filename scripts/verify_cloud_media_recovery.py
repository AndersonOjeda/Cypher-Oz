"""Back up published catalog images and verify restoration to loopback object storage."""

import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
from uuid import uuid4

import boto3
from botocore.config import Config
from dotenv import dotenv_values
from PIL import Image


def read(url):
    with urlopen(url, timeout=60) as response:
        content = response.read(10_000_001)
    if len(content) > 10_000_000:
        raise ValueError("Response exceeds recovery verification limit")
    return content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-objects", type=int, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    config = dotenv_values(root / "backend/.env")
    endpoint = config.get("CATALOG_S3_ENDPOINT", "")
    if urlsplit(endpoint).hostname not in {"localhost", "127.0.0.1"}:
        raise ValueError("Recovery destination must be loopback storage")
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=config.get("CATALOG_S3_ACCESS_KEY"),
        aws_secret_access_key=config.get("CATALOG_S3_SECRET_KEY"),
        region_name=config.get("CATALOG_S3_REGION", "us-east-1"),
        config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=10),
    )
    bucket = config["CATALOG_S3_BUCKET"]
    client.head_bucket(Bucket=bucket)
    base = "https://tti-staging-api.onrender.com"
    page = base + "/api/v1/products/"
    products = []
    while page:
        if not page.startswith(base + "/api/v1/products/"):
            raise ValueError("Unexpected catalog pagination origin")
        data = json.loads(read(page))
        products.extend(data["results"])
        page = data.get("next")
    images = {}
    for product in products:
        data = json.loads(read(base + "/api/v1/products/" + product["slug"] + "/"))
        for item in data.get("images", []):
            address = urlsplit(item["url"])
            if address.scheme != "https" or address.hostname != (
                "xysidcajciqerxytstsd.storage.supabase.co"
            ):
                raise ValueError("Unexpected source storage origin")
            images[address.path] = item["url"]
    if not images or len(images) != args.expected_objects:
        raise ValueError("Published images do not match the expected storage inventory")
    stamp = (
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    )
    archive = root / ".runtime" / ("cloud-media-backup-" + stamp)
    archive.mkdir(parents=True, exist_ok=False)
    records = []
    recovery_map = []
    for index, (source_path, source_url) in enumerate(sorted(images.items()), 1):
        content = read(source_url)
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        digest = hashlib.sha256(content).hexdigest()
        (archive / f"{index}.bin").write_bytes(content)
        key = f"recovery-verification/{stamp}/{index}.bin"
        client.put_object(Bucket=bucket, Key=key, Body=content)
        body = client.get_object(Bucket=bucket, Key=key)["Body"]
        try:
            restored = body.read()
        finally:
            body.close()
        if hashlib.sha256(restored).hexdigest() != digest:
            raise RuntimeError("Restored object checksum differs")
        records.append(
            {
                "source_path_sha256": hashlib.sha256(source_path.encode()).hexdigest(),
                "bytes": len(content),
                "sha256": digest,
                "restored_sha256": digest,
            }
        )
        recovery_map.append(
            {
                "source_path": source_path,
                "backup_file": f"{index}.bin",
                "local_restore_key": key,
            }
        )
    (archive / "recovery-map.json").write_text(
        json.dumps(recovery_map, indent=2) + "\n", encoding="utf-8"
    )
    result = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Remote published catalog images restored to isolated local MinIO prefix",
        "expected_remote_objects": args.expected_objects,
        "published_products": len(products),
        "restored_objects": len(records),
        "objects": records,
        "result": "PASS",
        "remote_objects_modified": False,
        "source_urls_or_credentials_recorded": False,
        "limits": "Inventory must be confirmed separately; no PostgreSQL data is included",
    }
    (archive / "manifest.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    evidence = root / "docs/evidence/sprint-8/cloud-media-recovery-2026-11-10.json"
    evidence.write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - never print signed URLs from SDK/network exceptions
        # Network and SDK exceptions may contain signed URLs or credentials.
        raise SystemExit(
            f"Recovery failed ({type(exc).__name__}); no successful evidence written"
        ) from None
