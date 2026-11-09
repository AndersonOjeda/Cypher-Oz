# Sprint 8 — Verificación para entrega académica

Fecha: 09/11/2026. Presentación prevista: 10/11/2026.
Alcance: aplicación completa, incremento de confianza/reseñas y expediente de
evidencias. La aprobación del profesor y la revisión del responsable de producto
se registran cuando ocurran; las pruebas automáticas no sustituyen esa aceptación.

## Correcciones de esta entrega

- Corregido lint/formato del HTML de verificación y recuperación de contraseña.
- Las configuraciones `test` y `e2e` desactivan Brevo y usan correo en memoria,
  aunque el `.env` local contenga una clave activa. Las pruebas específicas de
  transporte Brevo lo habilitan expresamente y simulan la respuesta HTTP.
- El botón Reintentar vuelve a consultar reseñas. El formulario conserva el texto
  ante errores, asocia mensajes al campo, muestra contador de 1.000 caracteres y
  confirma el guardado. La edición se comprueba mediante Tab y Enter.
- Añadidas pruebas de concurrencia PostgreSQL para reseña única, reporte activo
  único y moderación idempotente; casos negativos, privacidad, redondeo, variantes,
  paginación estable y protección de campos internos.
- La CI incluye los artefactos de Sprint 8. Se conserva evidencia histórica
  separada de los resultados actuales.
- La demo usa cuentas y base locales, envía correo a consola y comprueba errores
  al detener procesos. Su guía está en [Presentación](presentacion-2026-11-10.md).

## Resultados registrados

| Verificación | Resultado y evidencia |
|---|---|
| Backend completo PostgreSQL | 403 aprobadas; [JUnit](evidence/sprint-8/backend-2026-11-09.xml). Se ejecutó antes de ampliar los casos de reseñas. Advertencia de caché pytest sin efecto en los resultados. |
| Frontend | 143 aprobadas; [JUnit vigente](evidence/sprint-8/frontend-2026-11-09.xml); incluye reintento y contenido HTML mostrado como texto inerte. |
| Reseñas PostgreSQL ampliadas | 24 aprobadas; [JUnit focalizado](evidence/sprint-8/reviews-postgres-2026-11-09.xml). Se solapa con la suite general: no sumar sus cifras. |
| E2E integral | 66 comprobaciones aprobadas, 0 fallidas; [JUnit](evidence/sprint-8/e2e-2026-11-09.xml). Windows bloqueó el cierre de servidores: se cerraron únicamente sus árboles de procesos identificados; el comando inicial terminó con salida 1 por limpieza. |
| E2E final de Sprint 8 | 3 aprobadas en móvil/tablet/escritorio, salida explícita 0; [JUnit](evidence/sprint-8/e2e-sprint8-2026-11-09.xml). Incluye edición por teclado, publicación, reporte, ocultación y restauración. |
| Lint, tipos y build | Ruff y formato backend, ESLint, TypeScript y build Next.js aprobados. `makemigrations --check --dry-run`: sin cambios. |
| Smoke remoto | 8/8 HTTP aprobados; [JSON](evidence/sprint-8/cloud-smoke-2026-11-09.json). El resultado global es INCOMPLETE porque no se solicitó SQL directo remoto. |
| Backup/restauración local | [JSON](evidence/sprint-8/local-recovery-2026-11-09.json): 36 tablas, 34 migraciones, 91 pedidos, 91 pagos y 3 reseñas. Restauración aislada; no cubre Render ni objetos de catálogo. |
| Comando de plazos en demo | [Dry-run](evidence/sprint-8/deadlines-dry-run-2026-11-09.json), sin fallos y sin candidatos. No acredita ejecución periódica remota. |
| Capturas | [Móvil](evidence/sprint-8/reviews-mobile.png), [tablet](evidence/sprint-8/reviews-tablet.png), [escritorio](evidence/sprint-8/reviews-desktop.png). Revisión visual de legibilidad y ausencia de desbordamiento, con datos sintéticos identificados. |

La última CI remota histórica documentada es [CI 149](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/41701949709),
commit `035a661`. No se atribuye esa ejecución a estas correcciones posteriores.
Render informó el 09/11 que su API está Live en `61e8258`, desplegada el 04/11;
el smoke confirma disponibilidad HTTP, sin certificar por sí solo una compra real.

## Trazabilidad de casos

| Casos | Evidencia principal |
|---|---|
| CP-REV-01/02/03 | `test_verified_review_public_summary_and_private_fields`, elegibilidad negativa, límites de puntuación/comentario e inyección de campos; E2E de pedido entregado y pagado. |
| CP-REV-04/05 | Creación concurrente, autoría, edición de oculta; prueba UI de script como texto inerte; edición E2E por teclado. |
| CP-REV-06/07/08/09 | Promedios 3,7 → 4,0 → 4,5, vacío, privacidad, variantes y paginado; capturas y consulta pública. |
| CP-REV-10/11/12/13 | Reporte concurrente único, rechazo anónimo, permisos administrativos, motivo obligatorio, moderación auditada/idempotente y edición de oculta. |
| CP-CONF-01/02 | Producto/checkout en E2E y diferenciación Reportado/Confirmado; interfaz pública legible. |
| CP-CONF-03/04 | `test_configuration.py`: tarifa/umbral vigentes y canal deshabilitado; E2E de zona especial/garantía con datos sintéticos. Contenido comercial final requiere aprobación del responsable. |
| Casos críticos del MVP | `test_orders.py`, `test_inventory.py`, `test_order_expiration.py`, `test_auth.py`, `test_sprint_completion.py` y E2E de sprints anteriores: transacciones, última unidad, permisos, idempotencia, restitución, T1/T2 y flujo de entrega. |

## Jira y aceptación

Sprint 8 conserva su planificación sin fechas; no se reescribe el historial de
sprints. El estado de las actividades debe reflejar las evidencias enlazadas en
cada issue. Las historias CO-184–CO-187 y épica CO-183 requieren además demostrar
el resultado al responsable de producto. CO-197 requiere resolver contenido
comercial aprobado; la demo señala expresamente sus datos ficticios.

CO-45 dispone de regresión y matriz de casos, pero sus criterios de salida incluyen
aceptación de historias y recuperación antes de operación real. CO-46 mantiene
pendientes scheduler y recuperación remotos. CO-47 debe enlazar el commit/PR de
esta entrega y conservar separadas la aceptación académica y la operación real.
CO-200 dispone de integración y pruebas simuladas; la revisión de Brevo encontró
un remitente activo y ningún dominio propio autenticado en la cuenta conectada.
La revisión visual/recepción real y la rotación de credenciales expuestas siguen
requiriendo evidencia propia; no se enviaron correos reales en esta sesión.

## Decisión de alcance del usuario

Anderson indicó el 09/11 que presenta mañana y que no necesita extender ni comprar
servicios. No se realizaron compras, cambios de plan ni se activó un cron de pago.
Render confirmó PostgreSQL Free disponible y vencimiento **13/11/2026**. La demo
local permite presentar sin depender de su continuidad. Esta decisión no convierte
el respaldo local en respaldo remoto ni certifica operación comercial permanente.

La plantilla independiente `my-extension` se creó con Docker Extension Init y su
UI compiló. No está instalada/publicada ni conectada a la tienda. Su dependencia
de desarrollo Vite/Jest trae avisos que requieren modernización antes de usarla
como producto; no afecta los paquetes de la aplicación TTI.
