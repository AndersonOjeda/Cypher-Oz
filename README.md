# TTI — Tienda Tecnológica Inteligente

Monorepo del Sprint 1: Next.js + TypeScript + Tailwind, Django/DRF y PostgreSQL.
Fuente de verdad: `TTI_Documento_Maestro_Ingenieria_Software_v3.0_COMPLETO.docx`.
Historias: CO-36 (registro), CO-55 (login/logout) y CO-41 (WhatsApp).

## Ejecutar en Windows

Requisitos: Python 3.14, Node.js 24 y Docker Desktop con motor Linux iniciado.

1. Copiar `.env.example` a `.env` y definir una contraseña local de PostgreSQL.
2. Copiar `backend/.env.example` a `backend/.env`. Completar DATABASE_URL con la
   misma contraseña y crear DJANGO_SECRET_KEY aleatoria (no compartir ni versionar).
3. Desde la raíz:

```powershell
docker compose up -d --wait
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
cd backend
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py runserver 127.0.0.1:8000
```

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abrir http://localhost:3000. El health check está disponible en
http://127.0.0.1:8000/health/ y http://localhost:3000/health/; ambos consultan
PostgreSQL. Usar `localhost:3000` para la web, acorde con FRONTEND_URL.
Si cambia el backend, copiar `frontend/.env.example` a `.env.local` y ajustar
DJANGO_URL. En Linux sustituir `.venv/Scripts/python` por `.venv/bin/python`.

## Cuenta administradora y WhatsApp

No se crea ninguna cuenta administrativa ni contraseña comercial por defecto.
Crear un administrador de forma interactiva:

```powershell
cd backend
.venv/Scripts/python manage.py createsuperuser
```

El registro público siempre crea CLIENT. El comando anterior crea ADMIN; no existe
un tercer rol. Acceder mediante `/login` y consultar `/cuenta`.

WhatsApp comienza deshabilitado hasta disponer del número autorizado. Configurar
el número internacional real, sin `+` ni espacios, sustituyendo el marcador:

```powershell
.venv/Scripts/python manage.py configure_whatsapp --number NUMERO_REAL --message "Hola, quiero recibir asesoria sobre TTI."
.venv/Scripts/python manage.py configure_whatsapp --disable
```

También existe GET/PATCH `/api/v1/admin/settings/` restringido a ADMIN y protegido
por CSRF. Los cambios quedan auditados. El endpoint público expone solamente las
claves del canal WhatsApp. Nunca se envían mensajes automáticamente.

## API del Sprint 1

| Método | Ruta | Acceso |
|---|---|---|
| GET | /health/ | Público, comprueba BD |
| GET | /api/v1/auth/csrf/ | Público, prepara CSRF |
| POST | /api/v1/auth/register/ | Público + CSRF |
| POST | /api/v1/auth/login/ | Público + CSRF |
| POST | /api/v1/auth/refresh/ | Refresh cookie + CSRF |
| POST | /api/v1/auth/logout/ | CSRF, revoca sesión y limpia cookies |
| GET | /api/v1/users/me/ | CLIENT/ADMIN |
| GET | /api/v1/settings/public/ | Público |
| GET/PATCH | /api/v1/admin/settings/ | ADMIN; PATCH requiere CSRF |

Registro válido: 201. Correo duplicado: 409. Validación: 400. Sin sesión/credenciales
inválidas: 401. Sin permisos/CSRF inválido: 403. Logout: 204. Exceso de frecuencia: 429.
Errores REST: `{code, message, details}`. JWT exclusivamente en cookies HttpOnly;
Secure en producción. Nunca guardar tokens en localStorage.

## Pruebas

```powershell
cd backend
.venv/Scripts/ruff check .
.venv/Scripts/ruff format --check .
.venv/Scripts/python -m pytest -q
.venv/Scripts/python manage.py makemigrations --check --dry-run
```

```powershell
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Los E2E levantan Django en 8001 y Next.js en 3001, crean/migran la base **tti_e2e**
en el PostgreSQL local y usan datos ficticios exclusivos de prueba. No modifican
la base normal `tti`. Se requiere un usuario local con CREATEDB. Los puertos deben
estar libres. El número 12025550123 y la cuenta `admin@tti.example` existen solo
en el entorno aislado. La prueba verifica el enlace sin contactar a ese número.
Playwright cierra los servidores al terminar y genera capturas/reporte en
`frontend/playwright-report/` y `frontend/test-results/` (no versionados).

La CI en `.github/workflows/ci.yml` ejecuta PostgreSQL, migraciones, lint, tests,
typecheck, build y E2E; publica el reporte como artefacto. La ejecución remota
se debe distinguir de los resultados locales.

## Producción

Usar `DJANGO_SETTINGS_MODULE=config.settings.production`, claves propias,
DATABASE_URL de producción, DJANGO_ALLOWED_HOSTS y FRONTEND_URL HTTPS. Servir Django
con un servidor WSGI y terminación TLS correctamente configurados; `runserver` es
solo desarrollo. No usar `config.settings.e2e` en producción. Next.js:
`npm run build` y `npm start`, con DJANGO_URL definido al construir.
No se realizó despliegue de producción en este Sprint.

Ver [decisiones y trazabilidad](docs/architecture-sprint-1.md) y
[reporte del Sprint 1](docs/sprint-1-report.md).
