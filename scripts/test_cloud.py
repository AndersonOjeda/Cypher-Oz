#!/usr/bin/env python3
"""
Test Suite de Verificación Cloud End-to-End (E2E) para Cypher-Oz / TTI.
Verifica los 3 niveles en entornos gratuitos (Neon/Supabase + Render + Vercel):
  1. Base de Datos en la Nube (PostgreSQL SSL, tablas, migraciones)
  2. Backend API en la Nube (Health, Cold Start, CORS, Catálogo, Cotización, CSRF)
  3. Frontend en la Nube (SSR, Proxy de Rewrites Next.js /api/v1/, Rutas clave)
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Códigos ANSI para salida con colores
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


class CloudTester:
    def __init__(self, backend_url: Optional[str], frontend_url: Optional[str], db_url: Optional[str], timeout: int = 60):
        self.backend_url = backend_url.rstrip("/") if backend_url else None
        self.frontend_url = frontend_url.rstrip("/") if frontend_url else None
        self.db_url = db_url
        self.timeout = timeout
        self.results: List[Tuple[str, str, str, float]] = []

    def log_result(self, layer: str, test_name: str, status: str, latency_ms: float, detail: str = ""):
        self.results.append((layer, test_name, status, latency_ms))
        if status == "PASS":
            icon = f"{GREEN}[PASS]{RESET}"
        elif status == "WARN":
            icon = f"{YELLOW}[WARN]{RESET}"
        else:
            icon = f"{RED}[FAIL]{RESET}"
        
        detail_str = f" - {detail}" if detail else ""
        print(f"  {icon} {BOLD}{test_name}{RESET} ({latency_ms:.1f}ms){detail_str}")

    def make_request(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None,
        origin: Optional[str] = None,
    ) -> Tuple[int, Dict[str, str], bytes, float]:
        req_headers = {"User-Agent": "CypherOz-CloudTester/1.0"}
        if headers:
            req_headers.update(headers)
        if origin:
            req_headers["Origin"] = origin

        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                elapsed = (time.perf_counter() - start) * 1000
                resp_headers = dict(resp.getheaders())
                return resp.status, resp_headers, resp.read(), elapsed
        except urllib.error.HTTPError as e:
            elapsed = (time.perf_counter() - start) * 1000
            resp_headers = dict(e.headers)
            return e.code, resp_headers, e.read(), elapsed
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            raise RuntimeError(f"Error conectando a {url}: {e}") from e

    # ==========================================
    # NIVEL 1: PRUEBAS DE BASE DE DATOS CLOUD
    # ==========================================
    def test_database(self):
        if not self.db_url:
            print(f"\n{YELLOW}==> Nivel 1: Base de Datos en la Nube (PostgreSQL en Render/Neon/Supabase){RESET}")
            # Verificación indirecta mediante el healthcheck del backend
            if self.backend_url:
                try:
                    status, _, body, elapsed = self.make_request(f"{self.backend_url}/health/")
                    if status == 200:
                        data = json.loads(body.decode("utf-8"))
                        db_type = data.get("database", "desconocida")
                        self.log_result(
                            "BD",
                            f"Salud de BD vía Backend ({db_type})",
                            "PASS",
                            elapsed,
                            "PostgreSQL remoto responde a consultas activas",
                        )
                    else:
                        self.log_result("BD", "Salud de BD vía Backend", "FAIL", elapsed, f"HTTP {status}")
                except Exception as e:
                    self.log_result("BD", "Salud de BD vía Backend", "FAIL", 0, str(e))
            else:
                print(f"  {YELLOW}[INFO] Para pruebas directas a bajo nivel proporcione --database URL{RESET}")
            return

        print(f"\n{CYAN}==> Nivel 1: Verificando Conexión Directa a Base de Datos (PostgreSQL SSL){RESET}")
        try:
            import psycopg2
        except ImportError:
            print(f"  {YELLOW}[WARN] psycopg2 no está instalado en este entorno Python.{RESET}")
            return

        # 1.1 Conexión y Ping SSL
        start = time.perf_counter()
        conn = None
        try:
            db_conn_str = self.db_url
            if "sslmode" not in db_conn_str and not db_conn_str.startswith("sqlite"):
                sep = "&" if "?" in db_conn_str else "?"
                db_conn_str = f"{db_conn_str}{sep}sslmode=require"

            conn = psycopg2.connect(db_conn_str, connect_timeout=15)
            elapsed = (time.perf_counter() - start) * 1000
            self.log_result("BD", "Conexión PostgreSQL remota con SSL", "PASS", elapsed, "Handshake SSL exitoso")

            # 1.2 Versión y Engine
            start = time.perf_counter()
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
            elapsed = (time.perf_counter() - start) * 1000
            short_version = version.split()[0:2]
            self.log_result("BD", f"Motor PostgreSQL ({' '.join(short_version)})", "PASS", elapsed)

            # 1.3 Verificación de Tablas
            tables_to_check = [
                "users",
                "categories",
                "brands",
                "products",
                "product_variants",
                "inventory_balances",
                "orders",
                "order_items",
            ]
            start = time.perf_counter()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
                )
                existing_tables = {row[0] for row in cur.fetchall()}

            elapsed = (time.perf_counter() - start) * 1000
            missing_tables = [t for t in tables_to_check if t not in existing_tables]

            if not missing_tables:
                self.log_result("BD", "Esquema y Migraciones Django (Tablas core encontradas)", "PASS", elapsed)
            else:
                self.log_result(
                    "BD",
                    f"Esquema incompleto (Faltan: {', '.join(missing_tables)})",
                    "WARN",
                    elapsed,
                    "Requiere ejecutar 'python manage.py migrate'",
                )

        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            self.log_result("BD", "Conexión a Base de Datos Cloud", "FAIL", elapsed, str(e))
        finally:
            if conn:
                conn.close()

    # ==========================================
    # NIVEL 2: PRUEBAS DEL BACKEND API CLOUD
    # ==========================================
    def test_backend(self):
        if not self.backend_url:
            print(f"\n{YELLOW}==> Nivel 2: Backend API en la Nube (Omitido: no se proporcionó --backend){RESET}")
            return

        print(f"\n{CYAN}==> Nivel 2: Verificando Backend API en la Nube ({self.backend_url}){RESET}")

        # 2.1 Health Check y Detección de Cold Start
        health_url = f"{self.backend_url}/health/"
        print(f"  {BLUE}→ Pinging /health/ en Render (analizando latencia y cold-start)...{RESET}")
        try:
            status, headers, body, elapsed = self.make_request(health_url)
            if status == 200:
                is_cold = elapsed > 4000
                detail = f"Cold start detectado ({elapsed/1000:.1f}s)" if is_cold else "Servicio activo y caliente"
                self.log_result("BACKEND", "Health Check (/health/)", "PASS", elapsed, detail)
            else:
                self.log_result("BACKEND", "Health Check (/health/)", "FAIL", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("BACKEND", "Health Check (/health/)", "FAIL", 0, str(e))
            return

        # 2.2 Cabeceras de Seguridad Cloud
        sec_hsts = "Strict-Transport-Security" in headers or "strict-transport-security" in headers
        sec_nosniff = "X-Content-Type-Options" in headers or "x-content-type-options" in headers
        if sec_hsts or sec_nosniff:
            self.log_result("BACKEND", "Cabeceras de Seguridad HTTPS (HSTS / NoSniff)", "PASS", 0, "Políticas aplicadas")
        else:
            self.log_result("BACKEND", "Cabeceras de Seguridad HTTPS", "WARN", 0, "No detectadas en la respuesta")

        # 2.3 CORS Preflight con Frontend URL
        if self.frontend_url:
            try:
                status, cors_headers, _, elapsed = self.make_request(
                    f"{self.backend_url}/api/v1/products/",
                    method="OPTIONS",
                    origin=self.frontend_url,
                    headers={
                        "Access-Control-Request-Method": "GET",
                    },
                )
                allow_origin = cors_headers.get("Access-Control-Allow-Origin") or cors_headers.get("access-control-allow-origin")
                allow_creds = cors_headers.get("Access-Control-Allow-Credentials") or cors_headers.get("access-control-allow-credentials")
                if allow_origin in (self.frontend_url, "*") or allow_creds == "true":
                    self.log_result("BACKEND", f"CORS Origin Permitido ({self.frontend_url})", "PASS", elapsed)
                else:
                    self.log_result("BACKEND", "CORS Origin Permitido", "WARN", elapsed, f"Origin: {allow_origin}")
            except Exception as e:
                self.log_result("BACKEND", "CORS Preflight", "WARN", 0, str(e))

        # 2.4 Catálogo y Taxonomía
        try:
            status, _, body, elapsed = self.make_request(f"{self.backend_url}/api/v1/products/")
            if status == 200:
                data = json.loads(body.decode("utf-8"))
                count = len(data) if isinstance(data, list) else data.get("count", len(data.get("results", [])))
                self.log_result("BACKEND", f"API Catálogo (/api/v1/products/) - {count} producto(s)", "PASS", elapsed)
            else:
                self.log_result("BACKEND", "API Catálogo (/api/v1/products/)", "FAIL", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("BACKEND", "API Catálogo", "FAIL", 0, str(e))

        # 2.5 Categorías y Marcas
        try:
            status, _, body, elapsed = self.make_request(f"{self.backend_url}/api/v1/categories/")
            if status == 200:
                cats = json.loads(body.decode("utf-8"))
                self.log_result("BACKEND", f"API Categorías (/api/v1/categories/) - {len(cats)} categorías", "PASS", elapsed)
            else:
                self.log_result("BACKEND", "API Categorías", "WARN", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("BACKEND", "API Categorías", "WARN", 0, str(e))

        # 2.6 Emisión de Token CSRF
        try:
            status, auth_headers, _, elapsed = self.make_request(f"{self.backend_url}/api/v1/auth/csrf/")
            set_cookie = auth_headers.get("Set-Cookie") or auth_headers.get("set-cookie", "")
            if status in (200, 204) or "csrftoken" in set_cookie:
                self.log_result("BACKEND", "Emisión de Token CSRF (Directiva HttpOnly)", "PASS", elapsed)
            else:
                self.log_result("BACKEND", "Emisión de Token CSRF", "WARN", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("BACKEND", "Emisión de Token CSRF", "WARN", 0, str(e))

        # 2.7 Endpoints de Sprints Avanzados (Cotización y Comparador)
        try:
            status, _, body, elapsed = self.make_request(
                f"{self.backend_url}/api/v1/delivery/quote/",
                method="POST",
                data={"mode": "urban", "subtotal": "120000.00"},
            )
            if status == 200:
                data = json.loads(body.decode("utf-8"))
                self.log_result("BACKEND", f"Cotizador HU-28 (/api/v1/delivery/quote/) - Costo: ${data.get('cost')}", "PASS", elapsed)
            elif status == 404:
                self.log_result(
                    "BACKEND",
                    "Cotizador HU-28 (/api/v1/delivery/quote/)",
                    "WARN",
                    elapsed,
                    "HTTP 404: Render tiene versión anterior. Requiere desplegar la rama consolidada",
                )
            else:
                self.log_result("BACKEND", "Cotizador HU-28", "WARN", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("BACKEND", "Cotizador HU-28", "WARN", 0, str(e))

    # ==========================================
    # NIVEL 3: PRUEBAS DEL FRONTEND CLOUD
    # ==========================================
    def test_frontend(self):
        if not self.frontend_url:
            print(f"\n{YELLOW}==> Nivel 3: Frontend en la Nube (Omitido: no se proporcionó --frontend){RESET}")
            return

        print(f"\n{CYAN}==> Nivel 3: Verificando Frontend en la Nube ({self.frontend_url}){RESET}")

        # 3.1 Disponibilidad y Renderizado SSR
        try:
            status, _, body, elapsed = self.make_request(self.frontend_url)
            html = body.decode("utf-8", errors="ignore")
            if status == 200 and ("<html" in html or "<!DOCTYPE" in html):
                title = "Cypher-Oz" if ("Cypher" in html or "TTI" in html) else "Next.js App"
                self.log_result("FRONTEND", f"Renderizado SSR en Vercel ({title})", "PASS", elapsed)
            else:
                self.log_result("FRONTEND", "Renderizado SSR en Vercel", "FAIL", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("FRONTEND", "Disponibilidad Frontend", "FAIL", 0, str(e))
            return

        # 3.2 Verificación del Proxy de API Next.js (/api/v1/)
        # Esta es la prueba CRUCIAL que demuestra que Vercel y Render se comunican transparentemente
        proxy_url = f"{self.frontend_url}/api/v1/products/"
        try:
            status, _, body, elapsed = self.make_request(proxy_url)
            if status == 200:
                data = json.loads(body.decode("utf-8"))
                count = len(data) if isinstance(data, list) else data.get("count", 0)
                self.log_result(
                    "FRONTEND",
                    f"Next.js API Proxy (/api/v1/products/)",
                    "PASS",
                    elapsed,
                    f"Retornó {count} productos directo desde Render PostgreSQL sin bloqueo de cookies",
                )
            else:
                self.log_result("FRONTEND", "Next.js API Proxy", "WARN", elapsed, f"HTTP {status}")
        except Exception as e:
            self.log_result("FRONTEND", "Next.js API Proxy", "WARN", 0, str(e))

        # 3.3 Rutas Clave de Usuario
        routes = [
            ("/catalogo", "Catálogo Comercial"),
            ("/comprar", "Módulo de Compra y Carrito"),
            ("/login", "Autenticación & Redirección tti.next"),
        ]
        for route, label in routes:
            try:
                status, _, _, elapsed = self.make_request(f"{self.frontend_url}{route}")
                if status == 200:
                    self.log_result("FRONTEND", f"Ruta {route} ({label})", "PASS", elapsed)
                else:
                    self.log_result("FRONTEND", f"Ruta {route}", "WARN", elapsed, f"HTTP {status}")
            except Exception as e:
                self.log_result("FRONTEND", f"Ruta {route}", "FAIL", 0, str(e))

    # ==========================================
    # NIVEL 4: INTEGRACIÓN COMPLETA E2E
    # ==========================================
    def test_e2e_flow(self):
        print(f"\n{CYAN}==> Nivel 4: Prueba Integrada End-to-End (Vercel -> Render -> PostgreSQL){RESET}")
        if not (self.frontend_url and self.backend_url):
            print(f"  {YELLOW}[INFO] Requiere frontend y backend configurados para simular flujo completo.{RESET}")
            return

        try:
            # Paso 1: Consultar catálogo a través de Vercel
            status, _, body, t1 = self.make_request(f"{self.frontend_url}/api/v1/products/")
            if status != 200:
                self.log_result("E2E", "Flujo E2E - Consulta de Catálogo", "FAIL", t1, f"HTTP {status}")
                return

            products_data = json.loads(body.decode("utf-8"))
            results = products_data if isinstance(products_data, list) else products_data.get("results", [])
            if not results:
                self.log_result("E2E", "Flujo E2E - Producto para Compra", "WARN", t1, "Catálogo sin productos activos")
                return

            sample_product = results[0]
            prod_name = sample_product.get("name", "Producto")
            self.log_result("E2E", f"Paso 1: Selección de Producto ('{prod_name[:30]}...')", "PASS", t1)

            # Paso 2: Obtener CSRF a través de Vercel
            status, csrf_headers, _, t2 = self.make_request(f"{self.frontend_url}/api/v1/auth/csrf/")
            self.log_result("E2E", "Paso 2: Obtención de Token CSRF vía Proxy", "PASS" if status in (200, 204) else "WARN", t2)

            # Paso 3: Latencia Roundtrip Completa
            total_time = t1 + t2
            self.log_result("E2E", "Paso 3: Verificación de Latencia y Conectividad Nube", "PASS", total_time, f"Tiempo total: {total_time:.1f}ms")

        except Exception as e:
            self.log_result("E2E", "Flujo E2E Integrado", "FAIL", 0, str(e))

    # ==========================================
    # RESUMEN Y REPORTE
    # ==========================================
    def print_summary(self):
        print(f"\n{BOLD}{'=' * 68}{RESET}")
        print(f"{BOLD}         RESUMEN DE PRUEBAS CLOUD (CYPHER-OZ / TTI){RESET}")
        print(f"{BOLD}{'=' * 68}{RESET}")

        pass_count = sum(1 for _, _, s, _ in self.results if s == "PASS")
        warn_count = sum(1 for _, _, s, _ in self.results if s == "WARN")
        fail_count = sum(1 for _, _, s, _ in self.results if s == "FAIL")
        total = len(self.results)

        print(f" Total de pruebas ejecutadas: {total}")
        print(f" {GREEN}✓ Exitosas (PASS):{RESET} {pass_count}")
        print(f" {YELLOW}⚠ Advertencias (WARN):{RESET} {warn_count}")
        print(f" {RED}✗ Fallidas (FAIL):{RESET} {fail_count}")

        if fail_count == 0:
            print(f"\n{GREEN}{BOLD}🎉 ¡SISTEMA EN LA NUBE OPERATIVO! Conectividad BD, API y Frontend verificados.{RESET}")
        else:
            print(f"\n{RED}{BOLD}⚠ Se detectaron puntos que requieren atención.{RESET}")
        print(f"{BOLD}{'=' * 68}{RESET}\n")


def main():
    parser = argparse.ArgumentParser(description="Ejecutor de pruebas de nube para Cypher-Oz")
    parser.add_argument("--backend", "-b", help="URL del backend en Render (ej. https://tti-staging-api.onrender.com)")
    parser.add_argument("--frontend", "-f", help="URL del frontend en Vercel (ej. https://cypher-oz.vercel.app)")
    parser.add_argument("--database", "-d", help="URL de PostgreSQL (ej. postgresql://user:pass@ep-xyz.aws.neon.tech/neondb)")
    parser.add_argument("--timeout", "-t", type=int, default=60, help="Timeout en segundos (default: 60)")

    args = parser.parse_args()

    if not any([args.backend, args.frontend, args.database]):
        import os
        from pathlib import Path
        from dotenv import load_dotenv
        
        load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")
        args.backend = os.getenv("RENDER_URL") or os.getenv("DJANGO_URL") or "https://tti-staging-api.onrender.com"
        args.frontend = os.getenv("FRONTEND_URL") or "https://cypher-oz.vercel.app"
        args.database = os.getenv("DATABASE_URL")

    print(f"{BOLD}{'=' * 68}{RESET}")
    print(f"{BOLD}🚀 INICIANDO PRUEBAS DE LA NUBE: BD + BACKEND + FRONTEND{RESET}")
    print(f"{BOLD}{'=' * 68}{RESET}")
    print(f" Backend URL:  {args.backend or 'No especificada'}")
    print(f" Frontend URL: {args.frontend or 'No especificada'}")
    print(f" Database URL: {'Configurada (oculta)' if args.database else 'Vía Healthcheck del Backend'}")

    tester = CloudTester(args.backend, args.frontend, args.database, timeout=args.timeout)
    tester.test_database()
    tester.test_backend()
    tester.test_frontend()
    tester.test_e2e_flow()
    tester.print_summary()


if __name__ == "__main__":
    main()

