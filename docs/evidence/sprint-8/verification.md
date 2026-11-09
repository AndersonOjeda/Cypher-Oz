# Sprint 8 — Implementación y evidencia local

Este documento conserva el historial del 03/11/2026. Para el estado posterior,
consultar el [informe vigente del 09/11](../../sprint-8-report.md).

Fecha de revisión: 2026-11-03\
Jira: épica [CO-183](https://cypher-oz.atlassian.net/browse/CO-183), historias CO-184–CO-187, subtareas CO-188–CO-199. Sprint 8, tablero 2.

## Entrega implementada

- **HU-33 / CO-184:** reseñas únicas por cliente y producto, vinculadas a un artículo de pedido propio entregado y con pago confirmado; edición por autor, historial de cambios, validaciones y respuestas públicas sin datos de compra privados.
- **HU-34 / CO-185:** opiniones paginadas, resumen visible por producto y estrellas/conteo integrados al catálogo y detalle. Se mantuvo el límite de consultas del catálogo mediante agregados en la consulta de productos.
- **HU-35 / CO-186:** reporte autenticado, lista de revisión administrativa, ocultar/restaurar/descartar con motivo y registro de auditoría. Reportar no oculta una opinión ni retira por sí solo una calificación negativa.
- **HU-36 / CO-187:** información de pago, entrega, garantía y contacto basada en configuración, en detalle de producto y compra; zonas especiales y datos/canal pendientes se muestran como tales.

## Verificaciones ejecutadas

| Área | Comando / alcance | Resultado |
|---|---|---|
| Backend focalizado de reseñas/configuración/catálogo público | `pytest tests/test_reviews.py tests/test_configuration.py tests/test_public_catalog.py` | 26 pasaron |
| Backend ampliado | `pytest tests -q -x --tb=short -p no:cacheprovider -k 'not test_concurrent_upload_enforces_product_limit'` | 379 pasaron, 1 omitido; detuvo en `test_concurrent_refresh_only_one_succeeds` por `database table is locked: users_authsession` en SQLite |
| Frontend | `npm.cmd test -- --run` | 30 archivos, 141 pruebas pasaron |
| Tipos | `npm.cmd run typecheck` | Pasó |
| Lint frontend | `npm.cmd run lint` | Pasó |
| Lint Python de archivos modificados | Ruff sobre catálogo, configuración, reseñas, pedidos y pruebas | Pasó |
| Build frontend | `npm.cmd run build` | Pasó; rutas `/admin/resenas`, `/catalogo/[slug]` y `/comprar` incluidas |
| Diff | `git diff --check` | Sin errores de whitespace |

Las pruebas Django se ejecutaron con `DATABASE_URL=sqlite:///:memory:` porque el servicio Docker/PostgreSQL no estaba disponible en este entorno. La prueba preexistente `test_concurrent_upload_enforces_product_limit` no pudo correr (SQLite bloquea `product_images`); otra prueba de concurrencia preexistente, `test_concurrent_refresh_only_one_succeeds`, falló por bloqueo de `users_authsession` tras 379 pruebas aprobadas. Ambas deben correrse en PostgreSQL. La base SQLite no valida restricciones, bloqueos ni concurrencia específicos de PostgreSQL.

## Trabajo pendiente para aceptar y cerrar

- Terminar y registrar el resultado de la suite backend completa después del arreglo del presupuesto de consultas.
- Ejecutar migraciones y pruebas contra PostgreSQL real, incluidos los escenarios concurrentes de creación, reporte y moderación.
- Ejecutar recorrido E2E integrado con API: pedido entregado/pagado → reseña → consulta pública → reporte → moderación; recoger capturas reales.
- Revisar manualmente móvil/escritorio, teclado y estados de carga/error/vacío.
- Completar las 48 actividades y adjuntar resultados/capturas/CI a sus issues; revisión y aceptación del responsable del producto.
- Iniciar/planificar el Sprint 8: Jira todavía lo reporta futuro y sus fechas quedan pendientes por decisión del usuario.

**Decisión de estado:** las historias y tareas QA no deben marcarse `Listo` mientras falten PostgreSQL, E2E y evidencias de revisión. El código y la verificación local sí están respaldados por los resultados arriba.

## Verificación de publicación — 03/11/2026

El usuario confirmó Vercel como frontend oficial. El alias de producción
`cypher-oz.vercel.app` apunta a un deployment `READY` creado desde CLI el
29/10 (`dpl_3GMc4BgGWph6k8bqDMcEkVgXi2bL`), cuyo registro no contiene SHA de Git.
El deployment anterior ligado a `main` (`15ae3e63`) también está `READY` y su
check Vercel está en verde. El árbol de rutas del deployment más reciente no
incluye `frontend/src/app/admin/resenas`; los cambios revisados de Sprint 8
siguen sin commit. Por tanto, la implementación no se ha integrado ni se puede
considerar publicada. No se modificó el deployment de producción.

Jira conserva Sprint 8 en Futuro y sin fechas, según decisión del usuario.
CO-183 y CO-184–CO-199 siguen abiertos hasta integrar el código, ejecutar CI y
cerrar los pendientes de PostgreSQL, E2E, responsive/accesibilidad y aceptación.

## Actualización de entrega — 03/11/2026

- PR draft [#23](https://github.com/AndersonOjeda/Cypher-Oz/pull/23), rama `feature/sprint-8-trust-delivery`, último commit evaluado `077875d2`.
- El preview de Vercel para ese commit está `READY`; `/admin/resenas` responde HTTP 200 y muestra la pantalla de moderación.
- El mismo preview consulta el backend actual de Render. `/api/v1/settings/commercial/` y `/api/v1/products/test/reviews/` responden HTTP 404 (`x-render-origin-server: gunicorn`), por lo que la integración del backend aún no está desplegada.
- CI `TTI validation`, ejecución 141, llegó a PostgreSQL: 398 pruebas pasaron y 3 pruebas de `tests/test_reviews.py` fallaron porque `select_for_update()` intentaba bloquear una relación de pago nullable (`FOR UPDATE cannot be applied to the nullable side of an outer join`). La consulta se corrigió con `select_for_update(of=("self",))`; falta CI posterior para acreditar la corrección.
- El PR sigue draft y abierto. No se integró en `main` ni se alteró producción. Las fechas del Sprint 8 siguen pendientes.

La evidencia anterior sobre cambios sin commit corresponde al estado previo del PR; esta actualización registra el estado posterior.

## Resultado CI 143 — 03/11/2026

- Ruff, migraciones y suite backend PostgreSQL: aprobados; 401 pruebas pasaron.
- Almacenamiento aislado y verificaciones frontend (lint, tipos, 141 pruebas y build): aprobados.
- Regresión Playwright: falló con 21 casos (7 escenarios en móvil, tablet y escritorio). Los escenarios heredados de autenticación registran HTTP 401 al intentar entrar con usuarios que acaban de registrarse pero aún no verificaron el correo; hay además fallos de navegación/elementos derivados en los mismos recorridos. Incluye `sprints67.spec.ts` y escenarios anteriores de Sprint 1, 3, 4 y 5.
- CI global: fallido por Browser regression; evidencia y capturas disponibles como artefacto del run [41696182061](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/41696182061).

La suite frontend aprobada no sustituye una regresión integrada correcta. Ajustar los recorridos de E2E para verificar el correo (sin rebajar el requisito de producción) y volver a correr navegador sigue pendiente.
