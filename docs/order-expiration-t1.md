# Vencimiento T1: contrato y operación

Implementación mínima para CO-129 A4 / HU-14 y restitución HU-25. Fuente de requisitos:
documento maestro v3.0, RN-23–27, ALT-05, CP-T1-001 y arquitectura 17.5. Se aplica
cancelación con restitución a **pedido PENDING / pago PENDING con T1 persistido vencido**.
No se recalcula T1 desde configuración ni se extiende por reintentos.

## Transacción y carreras

El runner bloquea pedido → pago → balances ordenados, igual que el reporte bloquea
pedido → pago. Reevalúa estado y plazo después de adquirir los bloqueos.

- Si el reporte válido gana, queda REPORTED/T2; T1 no cancela ni restituye su stock.
- Si el vencimiento gana, estado CANCELLED, historial del actor y restitución enlazada
  al SALE se confirman juntos; el reporte tardío se rechaza y no resucita el pedido.
- Dos runners sobre el mismo pedido no duplican la cancelación ni la restitución.
- Fallos de balance, movimiento o auditoría revierten toda la operación del pedido.
  El lote continúa con los otros pedidos y termina con error si alguno requiere atención.

El pago conserva PENDING: el vencimiento no confirma ni rechaza fondos externos.
T1 permanece guardado y el motivo de vencimiento queda en el ledger; no se atribuye
la cancelación al cliente. Se exige un actor ADMIN activo existente para la auditoría.
La pantalla de pago oculta instrucciones/copia y advierte que no se transfiera
cuando el pedido está cancelado o T1 ya venció sin reporte. El backend sigue siendo
autoritativo al rechazar cualquier reporte fuera de plazo.

## Ejecución

Desde `backend`, con el entorno y base de datos que corresponda, primero inspeccionar:

```sh
python manage.py expire_unpaid_orders --actor-email "$ORDER_EXPIRY_ACTOR_EMAIL" --limit 100 --dry-run
```

Ejecutar el mismo comando sin `--dry-run` procesa un lote. Devuelve JSON con candidatos,
cancelados, omitidos y UUID de fallos; el código de salida es distinto de cero cuando
hay fallos o configuración inválida. El actor no se crea ni se promueve automáticamente.
El límite válido es 1–1000. Cada pedido tiene su propia transacción y los reintentos son
seguros. Los logs identifican pedidos con errores para conciliación, sin datos bancarios.

Ejemplo para el cron del entorno, cada minuto, usando ruta absoluta al repositorio,
al Python del entorno y un administrador técnico existente:

```cron
* * * * * cd /ruta/al/backend && /ruta/al/python manage.py expire_unpaid_orders --actor-email "$ORDER_EXPIRY_ACTOR_EMAIL" --limit 100
```

La programación del proveedor, credenciales/actor y alertas deben configurarse en el
entorno operativo correspondiente. Este cambio incorpora el runner y verifica su
ejecución y concurrencia reales con PostgreSQL; no declara activado un cron remoto.
No se añade un temporizador a cada worker web ni una API pública para ejecutar lotes.
No se requieren Celery, Redis ni un servicio distribuido.

## Límites de alcance

Actualización de Sprint 6/7: se conserva este comando T1 por compatibilidad.
Para cubrir también correcciones rechazadas y alertas T2, usar
`python manage.py process_payment_deadlines --actor-email <ADMIN activo> --limit 100`.
La [política vigente](payment-resolution-policy.md) define las 24 horas de corrección,
el vencimiento inclusivo y la alerta T2 sin cancelación de fondos reportados.
La programación remota sigue requiriendo verificación de ejecución y monitorización.

REPORTED, REJECTED y CONFIRMED quedan fuera de T1, aunque su deadline antiguo haya
vencido. El runner tampoco cancela PREPARING, SHIPPED, DELIVERED o CANCELLED.
Resolver T2, el plazo de corrección tras rechazo y la revisión administrativa siguen
en CO-130/HU-15, Sprint 6; no se marcan realizadas por completar CO-129.

Pruebas en `backend/tests/test_order_expiration.py`: comando/dry-run, límite inclusivo,
configuración histórica, permisos, estados/T2 excluidos, fallo/rollback, lotes y carreras.
Las carreras comprueban una espera real de bloqueo en `pg_stat_activity`, con conexiones
independientes; solo se controla el reloj para alcanzar ambos lados de T1.
