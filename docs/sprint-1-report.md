# Sprint 1 — Reporte final

Fecha: 8 de septiembre de 2026. Duración planificada: una semana. Alcance: 12 SP.

**SPRINT INCOMPLETO**: implementación y validaciones locales terminadas; pendiente
asignación formal al Sprint 1 en Jira. La herramienta de sprints falla y el campo
Sprint permanece vacío. No se declara cerrado un sprint que Jira no permite verificar.

## Historias y Story Points

| Jira | Historia | SP | Implementación | Estado formal |
|---|---|---:|---|---|
| [CO-36](https://cypher-oz.atlassian.net/browse/CO-36) | HU-01 Registro | 5 | Implementada y validada | En curso, cierre pendiente |
| [CO-55](https://cypher-oz.atlassian.net/browse/CO-55) | HU-02 Login/logout | 5 | Implementada y validada | En curso, cierre pendiente |
| [CO-41](https://cypher-oz.atlassian.net/browse/CO-41) | HU-30 WhatsApp general | 2 | Implementada y validada | En curso, cierre pendiente |

**12/12 SP implementados y probados; 0/12 SP formalmente cerrados.**
Épicas existentes reutilizadas: CO-24/EP-01 y CO-54/EP-12. SP comprobados en el campo
customfield_10016; customfield_10020 (Sprint) vacío en las tres historias.
Prioridad P0 de registro/login reflejada como Highest; WhatsApp corresponde a P1.

## Backend y PostgreSQL

Django 5.2.17, DRF 3.18.1 y PostgreSQL 17. Usuario por email con CLIENT/ADMIN,
hash Django, validación de contraseñas, normalización y unicidad case-insensitive
garantizada en PostgreSQL. Registro rechaza campos no permitidos y duplicados
con error controlado incluso ante colisión en persistencia.

JWT access/refresh en cookies HttpOnly; Secure en producción, SameSite=Lax y
CSRF obligatorio. Sesiones persistidas y revocables: logout invalida tokens
copiados, refresh rota bajo bloqueo transaccional y dos refresh simultáneos
producen un 200 y un 401. Django autoriza cada recurso por rol.

Configuración central en store_settings, endpoint público mínimo y acceso
administrativo protegido. Cambios de configuración auditados en SettingChange.
Health ejecuta SELECT 1 y devuelve 503 controlado si PostgreSQL falla.

## Frontend

Next.js 16.3.4, React 19, TypeScript, Tailwind, React Hook Form y Zod.
Home pública, registro, login, cuenta de solo consulta y logout. Estados de carga,
errores de campo, feedback de registro y sesión persistente al recargar. Cliente HTTP
con credenciales, CSRF y renovación automática ante access vencido.

WhatsApp flotante: número/mensaje/habilitación desde PostgreSQL, mensaje escapado,
etiqueta accesible, nueva pestaña protegida y CTA sin superposición en los viewports
probados. La base normal conserva el canal **deshabilitado** porque no se recibió
el número comercial. Los E2E usan un número ficticio en una base separada y no
envían mensajes ni contactan terceros.

## API

GET /health/; GET /api/v1/auth/csrf/; POST /api/v1/auth/register/;
POST /api/v1/auth/login/; POST /api/v1/auth/refresh/;
POST /api/v1/auth/logout/; GET /api/v1/users/me/;
GET /api/v1/settings/public/; GET/PATCH /api/v1/admin/settings/.

## Migraciones

Cuatro migraciones propias: users/0001 y configuration/0001, 0002, 0003.
Aplicadas en PostgreSQL local. Bases limpias creadas por pytest y por el entorno
E2E; migraciones completas aprobadas. `makemigrations --check --dry-run`:
**No changes detected**.

## Pruebas nuevas y regresión completa

| Validación ejecutada | Resultado local |
|---|---|
| Backend pytest | **41 passed, 0 failed**; 56.55 s |
| Frontend Vitest/Testing Library | **18 passed, 0 failed** |
| E2E Playwright real | **9 passed, 0 failed**; 44.7 s |
| Ruff check y format --check | PASS |
| ESLint | PASS |
| TypeScript / next typegen | PASS |
| Next.js production build | PASS |
| Migraciones / comprobación de cambios | PASS |
| PostgreSQL y health directo/vía Next.js | PASS |
| CI GitHub Actions, commit 9128ccf | PASS, incluye E2E Linux |

Cobertura: registro válido, email duplicado/inválido, contraseña inválida y hash,
escalamiento de rol, integridad UNIQUE/CHECK, login válido/inválido/inexistente,
usuario inactivo, cookies, CSRF/origen, permisos, refresh/expiración/concurrencia,
logout y replay, frecuencia de login, configuración pública/restringida/validada,
fallo de BD, formularios/carga/errores, cliente HTTP, URL y accesibilidad de WhatsApp.

No se omitieron pruebas ni se relajaron expectativas. Se corrigieron dos errores
de preparación del runner: cookies del cliente concurrente y selector de alertas
que coincidía también con el anunciador de rutas de Next.js.

## Verificación real y responsive

Browser → Next.js → Django → PostgreSQL, sin mocks del recorrido E2E.
Home → Registro (201) → Duplicado (409) → Login incorrecto (401) → Login correcto
→ Cuenta → Recarga → Refresh (200) → Logout (204) → Recurso protegido rechazado
(401). Cliente contra administración: 403. Administrador: 200. Visitante: 401.

Los tres escenarios E2E se ejecutaron en **390×844**, **768×1024** y **1440×900**.
Sin overflow horizontal ni superposición del botón de WhatsApp con el CTA principal
en Home, Registro y Login. Sin errores JS/hydration ni HTTP 500 en los recorridos.
Los logs muestran los 401/403/409 esperados y avisos de conexiones cerradas al
detener los servidores E2E; no excepciones funcionales. El navegador integrado
falló por un error del entorno; se verificó con agent-browser y Playwright local.

Capturas inspeccionadas:

- [Registro móvil](evidence/sprint-1/mobile-registration.png)
- [Home tablet](evidence/sprint-1/tablet-home.png)
- [Login escritorio](evidence/sprint-1/desktop-login.png)

El reporte completo local está en frontend/playwright-report/index.html.

## Bugs encontrados y solucionados

| Jira | Hallazgo | Solución |
|---|---|---|
| [CO-73](https://cypher-oz.atlassian.net/browse/CO-73) | Setup Sprint 0 ausente; remoto solo contenía README | Listo: monorepo, PostgreSQL, Django/Next, entornos, health, pruebas y CI preparados |
| [CO-74](https://cypher-oz.atlassian.net/browse/CO-74) | Caracteres españoles dañados por pipe de PowerShell | Listo: escritura UTF-8 corregida, DOM inspeccionado y título comprobado en E2E |

Sin defectos críticos conocidos en el alcance probado. CO-30 se reutilizó y quedó
Listo para el setup; no se duplicaron las historias oficiales.

## Git, PR, CI y Jira

- Rama: feature/CO-36-sprint-1.
- [PR #1, borrador](https://github.com/AndersonOjeda/Cypher-Oz/pull/1).
- 1e9845f: backend, autenticación y pruebas PostgreSQL.
- 788c946: frontend, WhatsApp y pruebas UI/E2E.
- 9128ccf: CI, README y fuente documental.
- Evidencia local publicada en comentarios de CO-36, CO-55 y CO-41.
- [CI remota completa aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/34274950496)
  sobre commit 9128ccf: todos los pasos, incluido E2E, finalizaron en success.
  Los commits posteriores solo incorporan documentación y capturas.
- La herramienta Atlassian disponible para issues permite leer y escribir. La
  operación listJiraBoards y el acceso al conector que gestiona sprints devuelven
  INVALID_ARGUMENT. El navegador Jira pide login. Se solicitó reconexión, sin
  inventar un sprint ni asignar un identificador supuesto.

## Pendientes para cierre formal

1. Recuperar acceso a gestión de sprints; identificar o crear Sprint 1 de una
   semana y asignar CO-36, CO-55 y CO-41; verificar su planificación.
2. Cerrar las historias tras verificar la coherencia y asignación en Jira. La CI
   y las evidencias técnicas ya están aprobadas.
3. Configurar el número comercial cuando se proporcione; el canal permanece
   deshabilitado en la base normal, conforme al criterio «visible cuando habilitado».

No se implementó Sprint 2 ni se realizó despliegue de producción.
