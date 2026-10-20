# Auditoría independiente del Sprint 5

Fecha: 20/10/2026, America/Bogota. Rama: `review/sprint-5-verification`.
Revisión de las entregas de Antigravity `fc9dfa4` y `3ae0a3c`, integradas con `origin/main`.

El cierre administrativo de Sprint 75 no acredita por sí solo su aceptación técnica.
Se encontraron defectos reales y afirmaciones incorrectas en los informes previos.
La auditoría anterior que declaraba «100% sin pendientes» queda sustituida por este documento.

## Hallazgos y correcciones

| Hallazgo | Corrección y comprobación |
|---|---|
| Cancelación pública de pedidos PENDING/PREPARING sin política aprobada de pagos/cancelación | Retirados endpoint y botón adelantados. CO-156 prepara un servicio interno; CO-157 exige validar la UI con HU-18 en Sprint 6. No se decide qué pedidos pagados pueden cancelarse. |
| Un balance inexistente se omitía y el pedido igualmente quedaba cancelado | Restitución rechaza balances inexistentes y desbordamiento de INTEGER, con rollback. |
| CANCELLATION no enlazaba la venta original | Nueva migración `inventory.0002`: `StockMovement.reversal_of`, OneToOne nullable con PROTECT. La relación OrderItem → SALE → reversión identifica pedido y origen y garantiza como máximo una reversión por venta. |
| Reintento protegido solo por estado del pedido | Servicio `restore_cancelled_order_inventory` bloquea pedido/balances, valida origen y devuelve el resultado existente sin duplicar saldo. Pruebas concurrentes usan conexiones PostgreSQL independientes. |
| Riesgo de duplicar cancelaciones históricas sin enlace | El servicio rechaza los movimientos antiguos con el prefijo de pedido conocido; exige conciliación, no inventa enlaces ni vuelve a sumar unidades. |
| Copia al portapapeles fallaba silenciosamente | Mensaje accesible de error con copia manual; eliminado temporizador innecesario. |
| Informe describía T1 recalculado y acceso administrativo | Corregido: GET devuelve T1 persistido e instrucciones vigentes; solo propietario, incluido rechazo a admin ajeno. |
| E2E «configurado» se presentó como evidencia de aprobación | Reescrito y ejecutado el escenario real: creación, reintento, instrucciones, copia, reporte/recarga, privacidad, un SALE y conciliación de movimientos. |
| Jira tenía todas las casillas sin marcar aunque las tareas estaban en Listo | Actualización con evidencias verificadas. CO-60 y CO-129 reabiertos por el punto pendiente descrito abajo. |

## Contrato del servicio de restitución

`restore_cancelled_order_inventory(user, number, reason)` requiere que el llamador haya
autorizado y cambiado el pedido a CANCELLED **en la misma transacción exterior**.
El servicio no decide la política, no cambia estados del pedido/pago ni registra la
transición que corresponde al llamador. HU-18/scheduler deben integrar esa transición,
su auditoría y la restitución como una única operación. No existe una API pública nueva
para evitar esa responsabilidad. Se comprueban origen SALE, variante y cantidad; se
conservan los snapshots. Pedidos con balances o ledger inconsistentes fallan y requieren
conciliación. La migración es aditiva y no modifica movimientos históricos.

## Trazabilidad y aceptación

| Historia / tareas | Evidencia | Resultado |
|---|---|---|
| CO-67 / CO-155 | `test_orders.py`: checkout real, snapshots, idempotencia, última unidad concurrente y rollback | Descuento inicial reutilizado, sin segundo SALE |
| CO-156 | `test_sprint5_backend.py`: origen enlazado, replay, estado autorizado, permisos, balance faltante, overflow, legado y origen incoherente | Servicio interno corregido |
| CO-157 | PostgreSQL: reversión concurrente única y rollback con transacción del llamador; E2E compara suma del ledger y SALE único | UI de cancelación queda expresamente para HU-18 |
| CO-59 / CO-124–126 | Pruebas API de propiedad/anonimato y GET sin cambios; E2E en tres tamaños, instrucciones vigentes con total/T1 históricos y copia | Verificado localmente |
| CO-60 / CO-127–128 | Referencias, permisos/CSRF, T1/T2, estados, auditoría, replay, rollback y reportes concurrentes; UI/recarga/reintento | Implementación de reporte verificada |
| CO-129 A4 | No existe proceso de vencimiento automático de pedidos/pagos en `backend/apps` | **Pendiente**: concurrencia real reporte–scheduler según política CO-130 |

Las pruebas de frontera T1 y dos reportes simultáneos no equivalen a una carrera contra
un scheduler real. No se marca esa actividad ni se declara HU-14 aceptada al 100%.
CO-60 y CO-129 quedan En curso. Se conserva Sprint 75 cerrado, sus fechas y sus 16 SP;
no se inicia otro sprint ni se alteran estimaciones para ocultar el pendiente.

## Desarrollo, pruebas y operación

Resultados reproducibles y XML en [evidencias](evidence/sprint-5/README.md).
Las pruebas locales usan PostgreSQL y almacenamiento aislados; no se crean pedidos ni
se envían pagos en producción. La cuenta/configuración de pago del E2E es sintética.
Ruff, migraciones, Django check, ESLint, tipos y build se comprueban además de las suites.
Se revisaron hooks, estados, accesibilidad y límites cliente/servidor con la guía React.

Chrome DevTools MCP comprobó `/catalogo` en el entorno E2E: API 200, sin alertas de UI
ni desbordamiento horizontal. Es una comprobación funcional, no Lighthouse ni carga.

El 20/10 se volvió a comprobar el frontend público (HTTP 200) y `/health/` de la API
de staging (HTTP 200, PostgreSQL ok). Esto resuelve la indisponibilidad observada en
la revisión anterior a nivel de ese chequeo puntual, no certifica todos los flujos
privados remotos ni demuestra que esta rama esté desplegada.

El objetivo anterior de 50 productos/1.000 usuarios sigue **sin certificarse**.
El informe [de rendimiento](performance-50-products-1000-users.md) registra la carga
fallida original y mejoras posteriores: solo hasta 50 usuarios pasaron escalones
locales cortos, y 100 no cumplió el objetivo. No se volvió a ejecutar carga ni
Lighthouse durante esta auditoría funcional; no se atribuyen resultados antiguos a
la nueva rama. Repetir carga representativa con generador separado sigue pendiente.
