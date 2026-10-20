# Sprint 5: estado verificado

20 de octubre de 2026, America/Bogota. Tablero CO (2), Sprint 75,
«CO Sprint 5 | 27 oct 2026». Alcance: HU-25, HU-13 y HU-14, 16 SP.

El sprint fue cerrado por Antigravity el `2026-10-20T13:09:25.820Z` con tres historias
y nueve subtareas en Listo. La revisión independiente encontró defectos de inventario,
cancelación adelantada y evidencia insuficiente para declarar un cierre técnico total.
Este informe reemplaza las afirmaciones anteriores de «100% completitud».

| Elemento | Estado de aceptación |
|---|---|
| CO-67 HU-25 (8 SP), CO-155/156/157 | Descuento inicial reutilizado. Restitución interna corregida y probada; interfaz/política de cancelación reservada a HU-18. |
| CO-59 HU-13 (3 SP), CO-124/125/126 | Instrucciones vigentes, propietario, total/T1 persistidos, COP y copia con error accesible. |
| CO-60 HU-14 (5 SP), CO-127/128 | Reporte REPORTED, revisión humana, T1 suspendido lógicamente, T2 persistido, auditoría y reintentos verificados. Historia reabierta por QA pendiente. |
| CO-129 | En curso: A1–A3 verificables; A4 requiere carrera real con scheduler de vencimiento todavía inexistente y política CO-130. |

Las fechas y la pertenencia histórica al sprint se conservan. El estado administrativo
«closed» no significa que la aceptación pendiente haya sido ejecutada.

Cambios principales: `StockMovement.reversal_of` único y protegido; restitución con
bloqueos y rollback, validación de balances/origen/overflow; rechazo de legado sin
conciliar; retirada de API/botón de cancelación no aprobados. La cancelación autorizada,
su cambio de estado, su historial y la restitución deben compartir transacción cuando
HU-18 o el scheduler se integren. El servicio no modifica estados de pagos.

GET de instrucciones usa T1 guardado al crear el pedido, no recalcula el plazo a partir
de la configuración actual. Un admin ajeno tampoco obtiene el pedido del cliente por
esa API. Las instrucciones pueden cambiar sin alterar total o plazo históricos.

La [auditoría](sprint-5-audit.md) detalla defectos, correcciones y límites.
Las [evidencias](evidence/sprint-5/README.md) contienen resultados ejecutados, XML y
capturas. No se presentan pruebas solamente configuradas como pruebas aprobadas.
La certificación de carga de 1.000 usuarios sigue pendiente según el informe de
rendimiento existente. Esta revisión no despliega ni certifica una nueva versión remota.

Verificación local: 281 pruebas backend, 89 frontend, 42 E2E anteriores y tres E2E
de Sprint 5 aprobados en la repetición corregida; 28 wireframes aprobados. Ruff,
ESLint, tipos, build y consistencia de migraciones aprobados. El primer intento E2E
con tres fallos de fixture se conserva y explica en las evidencias.
