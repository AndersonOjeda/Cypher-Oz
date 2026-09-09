# Sprint 2 — Reporte de implementación

Fecha de ejecución: 8 de septiembre de 2026 (America/Bogota).
Fechas planificadas en Jira: 25 de agosto a 1 de septiembre de 2026,
19:42:13 en ambos extremos (America/Bogota). Valores UTC:
`2026-08-26T00:42:13.000Z` a `2026-09-02T00:42:13.000Z`.
Estas fechas reflejan la planificación; la implementación se ejecutó el 8 de septiembre.

| Historia | Alcance | SP |
|---|---|---:|
| [CO-63](https://cypher-oz.atlassian.net/browse/CO-63) | Categorías y marcas | 5 |
| [CO-42](https://cypher-oz.atlassian.net/browse/CO-42) | Productos e imágenes | 8 |

Implementación del catálogo publicada y validación responsive aprobada. La regla
de exclusión de productos inactivos está probada; su uso en la compra se deberá
verificar en [CO-57/HU-09, Sprint 7](https://cypher-oz.atlassian.net/browse/CO-57),
donde se registró esa regresión. La casilla de compra de CO-42 sigue pendiente;
no se afirma una compra E2E antes de implementar checkout. El cierre formal del
Sprint 2 en Jira no está realizado: las historias siguen En curso.

La asignación nativa quedó verificada en **CO Sprint 2 (id 2, tablero 2)**:
CO-63 y CO-42, 13 SP en total. Estado del sprint al verificar: `future`, pendiente
de inicio. El usuario asignó CO-63 y se añadió CO-42 mediante el campo Sprint;
la consulta JQL `project = CO AND sprint = 2` devolvió exactamente ambas historias.
La consulta directa de sprints sigue fallando con `INVALID_ARGUMENT`; los campos
Sprint de las historias permitieron comprobar el identificador, fechas y estado.

## Entrega

- CRUD administrativo en `/admin/catalogo`, protegido por rol ADMIN y CSRF.
- Modelos PostgreSQL y migración `catalog/0001_initial`; índices de unicidad,
  claves foráneas protegidas, desactivación y regla central de visibilidad.
- Galería con carga real S3, validación, conversión WebP, orden y texto alternativo.
- Auditoría transaccional y recuperación de borrados/cargas de imágenes fallidas.
- MinIO local privado y CI configurada para verificar almacenamiento real en E2E.
- Configuración e instrucciones en README y `architecture-sprint-2.md`.

## Validación local

| Comprobación | Resultado |
|---|---|
| Backend: regresión Sprint 1 + catálogo | 71 passed |
| Frontend: Vitest/Testing Library | 21 passed |
| E2E Sprint 2, escritorio | 2 passed |
| E2E completo móvil/tablet/escritorio | 15 passed (1.2 min), 9 de Sprint 1 + 6 de Sprint 2 |
| Ruff, ESLint, TypeScript | PASS |
| Build de producción Next.js | PASS |
| Migración PostgreSQL local | Aplicada |
| Cambios de migraciones sin generar | No changes detected |
| CI GitHub del commit `20145d2` (push y PR) | SUCCESS |

Cobertura del backend: permisos visitante/cliente/admin, CSRF, entradas inválidas,
unicidad, relaciones, paginación, desactivación, archivos falsos/corruptos, MIME,
extensión, límites de tamaño/dimensiones, animación, recodificación, orden,
aislamiento entre productos, fallos de almacenamiento y concurrencia en el máximo
de imágenes. No se relajaron expectativas para obtener los resultados.

Se corrigió un defecto encontrado por las pruebas: el rechazo de campos desconocidos
debía devolver un diccionario de errores de DRF para evitar un 500. La prueba de
integridad de FK se corrigió para comprobar explícitamente las restricciones
diferidas de PostgreSQL dentro del bloque de rollback. Se corrigió también un
tipo de opción de Testing Library antes de aprobar el build.

La revisión final añadió casos de identificador inexistente/no numérico (404) y
orden máximo de imagen (32767). Se cambió al helper de búsqueda de DRF para
responder 404 ante identificadores mal formados; su prueba de regresión pasó
después del ajuste. El resto de las 30 pruebas de catálogo ya había pasado.

La prueba E2E realiza: login ADMIN → categoría → marca → producto → carga al bucket
privado → lectura de imagen firmada → edición/orden → recarga y persistencia →
archivo inválido rechazado → desactivación de categoría y visibilidad actualizada →
borrado relacionado rechazado → retirada de imagen y objeto remoto 404 → eliminación
controlada del producto y registros auxiliares. Usa `tti_e2e` y `tti-catalog-e2e`,
sin modificar productos de la base normal. Los fallos de storage se simulan en
pruebas API; el recorrido E2E usa el servicio MinIO real.

Evidencias visuales revisadas: [móvil 390 px](evidence/sprint-2/390-catalog.png),
[tablet 768 px](evidence/sprint-2/768-catalog.png) y
[escritorio 1440 px](evidence/sprint-2/1440-catalog.png).

## Límites y cierre administrativo

La integración S3 está validada localmente; falta configurar el proveedor y bucket
de producción al desplegar. No se hizo despliegue de producción. Rama
`feature/CO-63-sprint-2`, basada en `feature/CO-36-sprint-1`, cuyo PR aún no se
ha fusionado.

- [PR #2 — Sprint 2](https://github.com/AndersonOjeda/Cypher-Oz/pull/2), en borrador.
- [Commit de implementación 20145d2](https://github.com/AndersonOjeda/Cypher-Oz/commit/20145d24ce5ea07237e684444e1ec38c5755d3a1).
- [CI del PR aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/34298578484).
- [CI del push aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/34298560514).
- Todos los pasos de CI terminaron con éxito: lint/migraciones/backend,
  almacenamiento aislado, frontend/build, E2E y publicación de evidencias.

La CI anterior valida el commit de implementación; las actualizaciones
documentales posteriores tienen sus comprobaciones enlazadas desde el PR.

## Control de cierre

- [x] Código, pruebas y capturas guardados en GitHub.
- [x] PR separado, con dependencia del PR #1 explícita.
- [x] CI de la implementación aprobada.
- [x] Reporte técnico y arquitectura registrados.
- [x] Evidencias vinculadas y verificadas en ambas historias de Jira; responsable Ander Ojeda.
- [x] Seguimiento de aceptación integrado registrado en CO-42 y CO-57 (Sprint 7).
- [x] Sprint nativo identificado, con ambas historias asignadas y 13 SP.
- [x] Fechas planificadas verificadas en Jira: 25 de agosto a 1 de septiembre de 2026.
- [ ] Sprint iniciado (último estado verificado: future).
- [ ] Revisión de criterios, estado Listo y cierre formal verificado en Jira.

Siguiente paso administrativo: iniciar CO Sprint 2 desde el backlog del tablero 2,
conservando sus fechas planificadas. El cierre posterior debe reflejar los criterios
efectivamente aceptados: CO-42 mantiene pendiente la comprobación integrada de
compra registrada en CO-57. No se han pasado las historias a Listo ni cerrado el
sprint. El fallo del conector requiere realizar las operaciones de inicio/cierre
desde Jira mientras persista.
