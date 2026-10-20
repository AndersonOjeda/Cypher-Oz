# Sprint 5: resolución del cierre funcional

20 de octubre de 2026, America/Bogota. Tablero CO (2), Sprint 75,
«CO Sprint 5 | 27 oct 2026». Alcance: HU-25, HU-13 y HU-14, 16 SP.

La entrega inicial de Antigravity se cerró administrativamente con defectos y evidencia
insuficiente. La auditoría reabrió CO-60/129 y preparó PR #21. El usuario autorizó
completar lo pendiente antes de continuar. Se conserva ese historial y se completa
ahora la carrera real con el vencimiento T1, sin adelantar la resolución T2 de Sprint 6.

| Elemento | Implementación y evidencia |
|---|---|
| CO-67, CO-155/156/157 | SALE inicial único, restitución transaccional idempotente enlazada al movimiento original, validación de balances/origen/overflow y rollback. UI/política de cancelación voluntaria se mantienen en HU-18. |
| CO-59, CO-124/125/126 | Instrucciones vigentes, acceso propio, total/T1 históricos, COP, copia y tratamiento de errores. |
| CO-60, CO-127/128 | Reporte REPORTED con T1 suspendido lógicamente, T2 persistido, auditoría y replay sin extender el plazo ni confirmar fondos. |
| CO-129 A4 | Runner real T1 contra reporte: ambos órdenes de carrera con locks PostgreSQL observados; vencimiento/restock/auditoría atómicos, sin resurrección ni doble devolución. |

`expire_unpaid_orders` procesa solo PENDING/PENDING con T1 persistido vencido. Exige
un actor ADMIN activo existente, admite dry-run/límite y devuelve error ante pedidos
que requieren conciliación. Cada pedido tiene una transacción; un fallo no oculta
el error ni deja cancelación o stock parciales. REPORTED, REJECTED, CONFIRMED y T2
quedan excluidos. [Contrato y operación](order-expiration-t1.md).

La suite adicional pasa 20/20 pruebas PostgreSQL. Se conserva el primer XML fallido
por un fixture cacheado y su repetición correcta. Las suites completas y la entrega
integrada están vinculadas a [PR #21](https://github.com/AndersonOjeda/Cypher-Oz/pull/21)
y a sus comprobaciones de CI; las cifras históricas anteriores no sustituyen el
resultado del SHA finalmente integrado. [Evidencias](evidence/sprint-5/README.md).

El cierre de Jira se aplica después de regresión e integración satisfactorias,
marcando los criterios verificados y conservando fechas, estimaciones e historial.
CO-130, resolución administrativa/T2 y HU-18 permanecen en Sprint 6. El cron remoto,
sus alertas y la operación integral corresponden al despliegue operativo; este cambio
incorpora y prueba el runner ejecutable sin afirmar que se activó un cron remoto.

La [auditoría](sprint-5-audit.md) recoge la trazabilidad y correcciones. La capacidad
de 1.000 usuarios no forma parte de los criterios funcionales de estas tres historias
y sigue sin certificarse en el [informe de rendimiento](performance-50-products-1000-users.md).
Completar Sprint 5 no equivale a certificar todos los requisitos operativos del MVP.
