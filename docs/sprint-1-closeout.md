# Cierre del Sprint 1 vigente

Fecha: 6 de octubre de 2026, America/Bogota. Sprint Jira **71**, no el sprint
histórico id 1. Cierre técnico autorizado por el usuario y confirmado por Jira a
las **12:58:07** (`2026-10-06T17:58:07.255Z`). No acredita evaluación del profesor.

## Resultado

- **48 SP**, siete historias + EN-01, 24 subtareas y cuatro apoyos.
- **36 elementos Listo**, **96/96 actividades** de subtareas verificadas.
- Criterios técnicos y DoD de historias revisados; CO-28/29/31/73 con evidencia.
- [PR #4](https://github.com/AndersonOjeda/Cypher-Oz/pull/4) abierta, **sin merge**.
- [CI verde 37505844409](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/37505844409).
- Commit funcional: `dbc3101f42abc13244138d62217a71da79542f72`.
- Merge temporal probado por Actions: `0b132dc1dc8a884d75eab50cf7adc90373641a61`.
  Es el checkout de prueba de una PR, no un merge a main.

Se preservó el fin planificado (06/10/2026 00:00 -05:00), aunque el cierre fue
posterior. Sprints 72 a 77 permanecen futuros; no se inició Sprint 2. Los estados
fueron leídos de nuevo después de las transiciones y del cierre.

## Evidencia ejecutada

| Comprobación | Resultado | Evidencia remota conservada |
| --- | --- | --- |
| PostgreSQL / backend | 196 aprobadas, cero fallos | [JUnit CI](evidence/sprint-1-current/ci-backend.xml) |
| Frontend / Vitest | 35 aprobadas, ocho archivos | [JUnit CI](evidence/sprint-1-current/ci-frontend.xml) |
| Playwright completo | 33 aprobadas; móvil, tablet y escritorio | [JUnit CI](evidence/sprint-1-current/ci-browser.xml) |
| Calidad e instalación limpia | Ruff, migraciones, ESLint, tipos y build aprobados | [Job validate](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/37505844409/job/112414173993) |
| Wireframes | 28 vistas, teclado/foco, contraste básico, estados y navegación | [Comprobación local](evidence/sprint-1-current/wireframes-checks.json), repetida y aprobada en CI |
| Almacenamiento compilado | S3 create/put/get/delete aprobados en contenedor temporal local; E2E de imágenes aprobado en CI | `infra/minio/Dockerfile`, mismo código fuente y compilador fijados |

[Artefacto completo de CI](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/37505844409/artifacts/11431802483),
con HTML Playwright, JUnit y capturas. Retención remota hasta 20/10/2026. Se descargó
en `.runtime/entregas/sprint-1-ci-37505844409.zip` y se verificó su SHA256:
`ec60408ed8e4815fe9ec9c75825d632ec13c43f26804e68a37bb68c776744aed`.
Los tres JUnit remotos quedan también versionados, sin depender de esa caducidad.

## Trazabilidad por historia

| Jira | Resultado demostrado |
| --- | --- |
| CO-30 / EN-01 | Configuración central y auditada, parámetros validados, T1/T2/envío/TTL futuros; instalación y CI reproducibles |
| CO-36 / HU-01 | Registro válido, rechazo de duplicados/inválidos, rol CLIENT y contraseñas protegidas |
| CO-55 / HU-02 | Login, refresh, logout con revocación y permisos por rol |
| CO-56 / HU-03 | Perfil, direcciones propias, principal, CRUD y snapshots de pedidos |
| CO-63 / HU-20 | Categorías/marcas, duplicados, relaciones protegidas y visibilidad |
| CO-41 / HU-30 | WhatsApp habilitable, enlace/configuración y responsive; sin envío real |
| CO-58 / HU-11 | Dirección y entrega, total COP autoritativo, revisión y revalidación |
| CO-39 / HU-12 | Pedido atómico/idempotente, snapshots, SALE único, concurrencia y rollback |
| CO-28/29/31/73 | Plan actualizado, arquitectura/API, 28 prototipos revisados e instalación limpia con resultados |

La [matriz de las 96 actividades](sprint-1-expanded.md) relaciona subtareas y
pruebas. [Auditoría del cierre](evidence/sprint-1-current/jira-expanded-audit.json).
Cada elemento de Jira tiene su verificación técnica, enlaces de PR/CI y evidencia.

## Incidencia resuelta en CI

La [primera ejecución](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/37505099041)
aprobó backend, pero falló al descargar `minio/minio`: acceso denegado. Quay y la
descarga binaria tampoco resolvieron la instalación limpia. Se añadió compilación
desde la revisión oficial `7aac2a2c5b7c882e68c1ce017d8256be2feea27f`, con imagen
del compilador fijada por digest. Compose y CI usan la misma receta. No se tocaron
los volúmenes locales existentes ni se publicaron imágenes a un registro externo.

El [repositorio oficial](https://github.com/minio/minio) documenta distribución
desde fuente y está archivado. Este almacenamiento es para desarrollo/CI: antes
de producción debe seleccionarse una solución S3 mantenida. El fallo original se
conserva como antecedente; no se presenta como validación aprobada.

## Exposición y límites

Abrir **http://localhost:3002**; para reiniciar, `./scripts/start-sprint1.ps1` desde
la raíz. [Guion de 26 pasos, cuenta demo y capturas](sprint-1-current.md).
Exportar una copia con `./scripts/export-sprint.ps1 -Sprint 1` y conservar el ZIP
de CI para mostrar este incremento aunque continúe el desarrollo.

El cierre corresponde al incremento de Sprint 1, no al MVP completo. No declara
terminadas las historias futuras ni HU-14 integral frente a scheduler. No incluye
confirmación real de fondos, cancelación/restitución, vencimientos automáticos,
STAGING ni operación comercial. Recogida, envío, umbral neto, zonas especiales
bloqueadas y promociones fijas sin acumulación fueron confirmados por el usuario.
La aceptación académica y cualquier merge posterior son actos separados.
