# Sprint 2 — Reporte de implementación

Fecha de ejecución: 8 de septiembre de 2026 (America/Bogota).
Fechas planificadas: pendientes de un rango concreto del usuario.

| Historia | Alcance | SP |
|---|---|---:|
| [CO-63](https://cypher-oz.atlassian.net/browse/CO-63) | Categorías y marcas | 5 |
| [CO-42](https://cypher-oz.atlassian.net/browse/CO-42) | Productos e imágenes | 8 |

Implementación local de las dos historias completada y validación responsive
aprobada. El cierre formal del Sprint 2 en Jira no
está realizado: las historias siguen En curso y no tienen sprint nativo asignado.
La consulta de sprints del tablero 2 sigue fallando con `INVALID_ARGUMENT`.

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
ha fusionado. La publicación y CI remota se registrarán al verificarlas.

Para cerrar formalmente: crear o identificar CO Sprint 2 en el tablero 2, asignar
CO-63 y CO-42, registrar las fechas reales de planificación e iniciar el sprint
antes de pasar ambas historias a Listo. El fallo del conector requiere completar
las operaciones del sprint desde Jira mientras persista.
