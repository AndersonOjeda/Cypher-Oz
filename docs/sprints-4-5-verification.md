# Acta de cierre funcional de Sprint 4 y Sprint 5

20 de octubre de 2026, America/Bogota.

**Ambos sprints completaron su alcance funcional y sus criterios de aceptación.**
Las correcciones se integraron mediante PR #21 en `main`, commit
`603b8353edd406142c4b5f3ba83a041c25eacfb0`. La carpeta del IDE está en `main` y contiene
esa entrega, con la documentación de cierre publicada posteriormente. Se verificó
que el árbol del commit de código coincide exactamente con el probado por la CI:
`cc33f8b2271b771c0d946cc5e85a8632b255643e`.

## Desarrollo y aceptación

| Sprint | Alcance | Jira final |
|---|---|---|
| 4 / Sprint 74 | HU-09, HU-10, HU-28 y HU-19, 21 SP | 16/16 incidencias Listo, 76/76 casillas verificadas |
| 5 / Sprint 75 | HU-25, HU-13 y HU-14, 16 SP | 12/12 incidencias Listo, 56/56 casillas verificadas |

Los dos sprints permanecen cerrados, con 100% de sus historias en Listo en el tablero.
Se conservaron fechas, estimaciones, responsables, jerarquía e historial de reapertura.
La lectura final de Jira devolvió las 28 incidencias sin paginación pendiente:
28 Listo, 132/132 casillas, responsables y evidencias vinculadas.
[Snapshot final](evidence/sprints-4-5-verification.json).

Sprint 4 conserva sus correcciones integradas: contratos estrictos de carrito/entrega,
actividad de producto/variante/categoría/marca, precio observado y aceptación de cambios,
autenticación tardía, bloqueo de zona especial, privacidad y paginación de clientes.

Sprint 5 incorpora restitución transaccional e idempotente enlazada a SALE, validación
de balances/origen/overflow, conciliación de legado y rollback. Las instrucciones
usan configuración vigente con total/T1 históricos; el reporte persiste REPORTED/T2
y auditoría sin confirmar fondos ni extender el plazo mediante reintentos.

## Pendiente resuelto: CO-129 A4

El runner real `expire_unpaid_orders` resuelve únicamente PENDING/PENDING con T1
persistido vencido. Bloquea pedido → pago → balances; cancelación, historial del actor
y restitución se confirman juntos. Si gana el reporte válido, T1 no cancela REPORTED.
Si gana el vencimiento, el reporte tardío se rechaza. Dos runners superpuestos no
duplican saldo ni historial. Los fallos revierten íntegramente el pedido afectado.

Las 20 regresiones nuevas comprueban ambas carreras observando una espera real de
locks PostgreSQL, además de permisos, límite inclusivo, lotes, replay y rollback.
La pantalla de pago oculta instrucciones/copia y advierte que no se transfiera cuando
el pedido está cancelado o T1 venció sin reporte. CO-60 y CO-129 se cerraron después
de integrar y validar. [Contrato T1 y comando](order-expiration-t1.md).

## Evidencias de entrega

La CI final aprobó **301 backend, 91 frontend, 45 E2E y 28 wireframes**, junto con Ruff,
formato, migraciones, ESLint, tipos y build. Los E2E recorren móvil, tablet y escritorio
con PostgreSQL y almacenamiento aislados. No se alteraron pedidos de producción.

- [PR #21 fusionado](https://github.com/AndersonOjeda/Cypher-Oz/pull/21).
- [CI final aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/39450822723).
- [Artefacto final: XML y capturas](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/39450822723/artifacts/12277624186).
- [PR #20: entrega previa de Sprint 4](https://github.com/AndersonOjeda/Cypher-Oz/pull/20).
- [Auditoría de Sprint 5 y resolución](sprint-5-audit.md).

La regresión local backend también pasó 301/301, con cero errores/fallos, en 453,30 s;
su XML está en `.runtime/sprints45-completion/backend-local.xml`. Frontend local:
91/91. Los primeros intentos fallidos de fixtures se conservaron; la ejecución CI
final integrada es la evidencia de aprobación y no una suma de intentos parciales.
Las cifras antiguas de informes se mantienen identificadas como fases históricas.

Se actualizó la carpeta del IDE conservando los cambios locales preexistentes. La
copia anterior completa y su diff están en `.runtime/sprints45-before-integration/`
y `.runtime/sprints45-before-integration.patch`. No quedan conflictos de fusión ni
modificaciones funcionales sin integrar en backend o componentes frontend.

## Operación y trabajo posterior

Vercel registra despliegue correcto del commit integrado. Frontend respondió HTTP 200.
API health y proxy de catálogo respondieron HTTP 200 en la repetición final
(aproximadamente 0,60 y 0,53 s); health informó PostgreSQL ok. En el primer intento
de esa comprobación API/proxy habían agotado 20 s. El smoke puntual no certifica
disponibilidad continua ni todos los flujos privados remotos.

El runner T1 está implementado y probado. Su activación en el cron del entorno y sus
alertas pertenecen a la operación del despliegue; no se afirma haber activado un cron
remoto. CO-130/T2, resolución administrativa/rechazos y HU-18 continúan en Sprint 6.
No se marcaron esas actividades futuras como realizadas para cerrar estos sprints.

La capacidad de 50 productos/1.000 usuarios sigue sin certificarse. No se ejecutó
una nueva carga ni Lighthouse: el [informe de rendimiento](performance-50-products-1000-users.md)
mantiene las mediciones y limitaciones reales. Completar el alcance funcional de
Sprint 4/5 permite continuar Sprint 6; no certifica todos los requisitos operativos
del MVP ni elimina la validación de carga pendiente.
