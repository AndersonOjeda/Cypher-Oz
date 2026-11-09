# Expediente de cierre — 03/11/2026

## Trabajo comprobado

- La integración continua CI 149 pasó backend/PostgreSQL, almacenamiento aislado, verificaciones frontend y Playwright. Evidencia: [CI 149](sprint-8/ci-149.md) y [run de GitHub Actions](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/41701949709). Commit asociado: `035a661060b5d39e7a6e77f4a6fe2e8041d623b0`.
- El backend de Render `tti-staging-api` está Live en `61e8258a1799b504d031f2485317084ccbf816c0`. La producción oficial Vercel quedó `READY` en `dpl_Cjci5Xp5oNqhMo6xqw19jbBVPL22`, también en el commit `61e8258a1799b504d031f2485317084ccbf816c0`. Los smoke checks HTTP anteriores dieron 8/8.
- La suite E2E integral, con caché local de Next regenerada, terminó **66/66 pruebas aprobadas, 0 fallidas, 0 errores**, repartidas en móvil, tablet y escritorio. Informe JUnit: [e2e-full-regression-2026-11-03.xml](sprint-8/e2e-full-regression-2026-11-03.xml). El cambio del escenario de reseñas pasó en los tres tamaños. Capturas: [móvil](sprint-8/reviews-mobile.png), [tablet](sprint-8/reviews-tablet.png), [escritorio](sprint-8/reviews-desktop.png). La corrida específica de Sprint 8 también está en [su JUnit](sprint-8/e2e-sprint8-2026-11-03.xml).
- Se identificó que los 404 intermitentes anteriores venían del manifiesto de rutas obsoleto en `.next-e2e`; al eliminar solo esa caché ignorada y regenerarla, la ruta de pago devolvió 200 y la regresión limpia pasó. El JUnit final es la evidencia autoritativa.
- PostgreSQL y MinIO de Docker estaban activos. En la base sintética local se creó un `pg_dump` en formato custom, se restauró en una base aislada y se verificaron 36 tablas (70 productos, 39 pedidos, 13 reseñas); se eliminó la base temporal al terminar. MinIO superó una operación de carga/lectura/borrado de un objeto sintético. Esto prueba el ciclo local, no el backup/restauración del staging.
- La suite backend `tests/test_reviews.py` se pudo descubrir (4 casos), pero no se completó: la configuración local apunta a PostgreSQL `127.0.0.1:54329`, sin listener; al reorientarla al PostgreSQL E2E de `55432`, falló la inicialización de su base de prueba. Por eso no se reporta como pasada. El flujo backend sí fue ejercitado por la suite E2E de 66 casos.
- Brevo está integrado en el commit desplegado `61e8258`; el usuario confirmó la recepción anterior de un enlace de recuperación. La revisión visual de la nueva plantilla HTML queda para revisión manual.

## Situación Jira y sprints

- Sprints 1–6 aparecen cerrados en Jira.
- Sprint 7 está cerrado administrativamente, pero las tareas CO-45 (QA), CO-46 (operación) y CO-47 (documentación) necesitan evidencia y/o cierre operativo registrado.
- Sprint 8 permanece en Futuro y sin fechas por instrucción del usuario. CO-183 y CO-184–CO-199 conservan sus estados; no se cambian fechas ni estados para simular aceptación.
- CO-200 (Brevo) requiere comprobación final de la plantilla/remitente en el correo recibido.
- El filtro de vencimientos se revisó el 03/11/2026 y no mostró issues vencidas.

## Pendientes técnicos/operativos externos a la aceptación

- El PostgreSQL de staging es Free y vence el 13/11/2026. Render no ofrece backups gestionados ni PITR para ese plan; hace falta migrar a un plan con respaldo o acordar una exportación y destino externo. La prueba sintética local no cubre esos datos. [Política de recuperación y backups de Render](https://render.com/docs/postgresql-backups).
- Se comprobó el recurso PostgreSQL remoto por Render MCP, pero la consulta SQL de solo lectura fue rechazada porque su allowlist está vacía y Render MCP no publica una IP de salida que se pueda permitir. No se abrió la base a `0.0.0.0/0`.
- No hay servicio Cron de backup configurado en Render. El plan mínimo de Cron tiene un costo recurrente de USD 1/mes más ejecución. No se creó porque supone un cargo. [Precios y funcionamiento de Render Cron](https://render.com/docs/cronjobs).
- Render MCP verificó que el API `tti-staging-api` está configurado con auto deploy activo y `autoDeployTrigger: commit`, rama `main`, URL `https://tti-staging-api.onrender.com` y servicio no suspendido. El archivo `render.yaml` en GitHub aún declara `autoDeploy: true`; la configuración del servicio está activa aunque el Blueprint use el campo anterior.
- El frontend oficial es Vercel; no debe tomarse el servicio web auxiliar de Render como despliegue de aceptación.

## Aceptación restante

La regresión E2E automatizada pasó y la evidencia está guardada en el workspace. Quedan la revisión manual de interfaz, teclado, reseñas/moderación y presentación visual del correo, y la aceptación del profesor. Además, el respaldo operativo del PostgreSQL remoto sigue sin comprobarse: el plan Free no incluye backups administrados y no se pudo consultar desde Render MCP por la allowlist vacía. Render Cron tampoco está configurado y tiene costo recurrente; no se asumieron cargos. La llamada HTTP de verificación al endpoint de recuperación de contraseña agotó el tiempo de espera, por lo que no se afirma que se haya enviado un correo nuevo.
