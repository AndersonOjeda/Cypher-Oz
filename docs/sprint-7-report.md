# Sprint 7: verificación de la entrega y operación

20/10/2026, America/Bogota. Tablero 2, Sprint 77, «Sprint 07 | Cierre del MVP».
Alcance: HU-29 (CO-71), HU-31 (CO-72), HU-07 (CO-35), 16 SP; nueve subtareas.

Se conserva la implementación de Antigravity `eef7aa5` y se corrigen los defectos
de aceptación en `71ffb29`. [PR #22](https://github.com/AndersonOjeda/Cypher-Oz/pull/22).
El código funcional está validado localmente; **no se declara cierre operativo del
MVP mientras falten despliegue, scheduler y recuperación remotos acreditados**.

## Implementación y correcciones

| Historia | Resultado comprobado |
|---|---|
| CO-71 / CO-167–169 | Snapshot de destinatario/dirección, permisos ADMIN, filtro de modalidad, detalle y acciones de despacho con pago confirmado. |
| CO-72 / CO-173–175 | WhatsApp contextual desde pedido propio, identificador codificado, canal configurable, sin modificar pedido ni pago. |
| CO-35 / CO-106–108 | Comparación pública de 2–4 productos compatibles; atributos faltantes N/A, precios/stock, selección y eliminación. IDs inválidos, vacíos y duplicados devuelven 400. |

Las acciones de pagos, transiciones y cancelación usan el cliente compartido con
CSRF, renovación de sesión y errores normalizados. Las bandejas tienen paginación,
protección frente a respuestas antiguas y ruta real `/admin/pedidos/[number]`.
Los diálogos nativos gestionan foco y Escape. El seguimiento distingue pago
Pendiente, Reportado, Rechazado y Confirmado; no llama «Verificado» a PENDING.

El rechazo guarda motivo y concede las **24 horas de corrección autorizadas por el
usuario**. Confirmación/cancelación bloquean pedido → pago → inventario. No se
cancelan automáticamente pagos confirmados. El comando `process_payment_deadlines`
procesa T1, correcciones vencidas y alertas T2 idempotentes sin cancelar REPORTED.
[Política y límites](payment-resolution-policy.md), [operación](operations.md).

## Evidencia ejecutada

| Comprobación | Resultado local |
|---|---|
| Backend completo PostgreSQL | 335 aprobadas; cero fallos/errores; 614,74 s |
| Regresiones de corrección/CSRF/T2/concurrencia y comparación 3/4 productos | 15 aprobadas; incluye dos casos añadidos después de la suite completa |
| Vitest completo | 113 aprobadas, 23 archivos |
| ESLint, TypeScript y build Next.js | Aprobados |
| Ruff lint/formato y migraciones por generar | Aprobados; ninguna migración pendiente de generar |
| Playwright integrado | 45/48 aprobados; los tres restantes buscaban un enlace anterior; corregidos y repetidos 3/3 |
| Recorrido nuevo Sprint 6/7 | Aprobado en móvil, tableta y escritorio contra PostgreSQL/MinIO aislados, con sesiones y CSRF reales |
| DevTools MCP | Comparador/API, tabla visible, sin overflow, ID `²` rechazado con 400 |
| Backup/restauración local aislada | 32 migraciones, 40 pedidos y 40 pagos restaurados; cero CANCELLED/CONFIRMED |

No se suman ejecuciones repetidas como pruebas diferentes. La ejecución completa
de CI del commit publicado es la referencia integrada:
[GitHub Actions](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/39489770805).
Los primeros intentos fallidos de localizadores y los diagnósticos originales no
se presentan como aprobaciones. [Evidencias conservadas](evidence/sprint-7/).

## Jira y servicios remotos

La lectura inicial confirmó Sprint 77 cerrado y 16 elementos Listo, pero con
86 casillas sin verificar. Se reabrieron **CO-45, CO-46 y CO-47** y se registraron
los resultados y pendientes reales. Los estados administrativos no sustituyen CI,
criterios verificados ni aceptación operativa. Se conservan fechas y calendario.

La consulta inicial de Render mostró API `tti-staging-api` ejecutando `1b1c171`
(15/10/2026), sin cron en el inventario de servicios. Vercel tenía preview READY de
`eef7aa5`, que no certificaba una API equivalente. Supabase confirmó el bucket
privado `cypher-oz-catalog`. La base de negocio configurada es Render PostgreSQL;
Docker contiene únicamente los entornos locales. Las consultas no expusieron secretos.

Pendientes operativos: publicar versiones compatibles frontend/API, verificar
scheduler y alertas, y probar recuperación de base y objetos remotos. La restauración
local no acredita la remota. No se crearon servicios de pago durante esta revisión.
La capacidad de 50 productos/1.000 usuarios sigue sin certificarse; no se ejecutó
nueva carga ni Lighthouse. [Mediciones anteriores](performance-50-products-1000-users.md).
