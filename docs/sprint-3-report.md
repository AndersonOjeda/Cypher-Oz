# Sprint 3 — Reporte final

Ejecución: 8 de septiembre de 2026, America/Bogota. Duración planificada: una semana.
Alcance oficial: 11 SP. Sprint 2 cerrado por el usuario y verificado en Jira antes
de comenzar: `completeDate=2026-09-09T01:51:40.019Z`.

**SPRINT INCOMPLETO**: implementación y validación local terminadas. Falta la
asignación formal al Sprint 3 y resolver la aceptación de las verificaciones
integradas que dependen de compra/pedidos. La CI remota está aprobada.

## Historias, Jira y Story Points

| Historia | SP | Implementación | Estado Jira |
|---|---:|---|---|
| [CO-64 — HU-22 Variantes](https://cypher-oz.atlassian.net/browse/CO-64) | 8 | Implementada y probada | En curso |
| [CO-68 — HU-26 Precios](https://cypher-oz.atlassian.net/browse/CO-68) | 3 | Implementada y probada | En curso |

**11/11 SP implementados; 0/11 SP en historias Done.** Épicas CO-26 y CO-52
reutilizadas; prioridad Highest conforme P0, responsable Ander Ojeda. El campo
Sprint sigue vacío en la última consulta. El conector de sprints devuelve
`INVALID_ARGUMENT`; se solicitó al usuario asignar las historias e iniciar Sprint 3
en el tablero 2. No se inventó un identificador ni se duplicaron historias.

## Backend y PostgreSQL

Variantes con SKU único, precio Decimal(12,2), estado y nombre estándar inicial.
Atributos de categoría y valores de variante normalizados con restricciones de
unicidad, claves foráneas y rangos. SKU y precio obligatorios, sin valores comerciales
inventados en migraciones. Cero es válido; negativos, NaN y precisión excedida se
rechazan. El precio JSON es una cadena decimal; backend y PostgreSQL son autoritativos.

Permisos ADMIN, CSRF y respuestas privadas sin caché. Escrituras y auditoría atómicas,
bloqueo del producto antes de leer relaciones, colisiones de SKU con 409, rollback
ante fallos y relaciones protegidas. No se permite mover una variante a otro producto
ni editar inventario. La desactivación conserva sus referencias.

La visibilidad del Sprint 2 se conserva; una política adicional de disponibilidad
exige variante activa con producto, categoría y marca activos. No representa stock.
Los cambios de categoría incompatibles con atributos existentes se rechazan.

## Frontend y API

Panel `/admin/catalogo`: variante estándar o con atributos, listado paginado,
crear/editar, precio COP, activar/desactivar y disponibilidad actualizada sin perder
el formulario del producto ni sus imágenes. Feedback de carga/éxito/error y errores
anidados legibles; reintentos y datos conservados ante validaciones fallidas.

Prefijo `/api/v1/admin/`:

| Método | Ruta |
|---|---|
| GET, POST | `products/{id}/variants/` |
| GET, PATCH | `variants/{id}/` |
| GET, POST | `categories/{id}/attributes/` |
| PATCH | `attributes/{id}/` |

## Migraciones

`catalog/0002_categoryattribute_variant_variantattributevalue_and_more` aplicada
en PostgreSQL local y E2E. Regresión pytest inicia una base de pruebas limpia.
`makemigrations --check --dry-run`: No changes detected. La migración crea las
tres tablas nuevas sin alterar datos comerciales de productos existentes.

## Pruebas nuevas y regresión completa

| Comprobación | Resultado |
|---|---|
| Backend Sprint 3 | 52 passed |
| Backend completo, sprints 1–3 | **123 passed, 0 failed**, 152.37 s |
| Frontend completo | **30 passed, 0 failed**, 9 pruebas nuevas |
| E2E completo | **21 passed, 0 failed**, 1.6 min; 6 nuevos recorridos |
| Ruff check y format | PASS |
| ESLint | PASS |
| TypeScript | PASS |
| Next.js production build | PASS |
| Migraciones / Django check | PASS |
| CI remota, commit a1c4ce4 | **PASS**, todos los pasos incluidos E2E y artefactos |

Se cubren precio cero/máximo/inválido, atributos duplicados o de otra categoría,
campos desconocidos, paginación, estándar, persistencia, disponibilidad,
401/403/CSRF, conflictos 409, 404, auditoría y rollback. Tres pruebas concurrentes
PostgreSQL verifican SKU duplicado, cambio categoría/atributos y auditoría serializada
de precios. No se eliminaron pruebas ni se relajaron expectativas para lograr PASS.

## Verificación real y responsive

Navegador → Next.js → Django → PostgreSQL; MinIO real para regresión de imágenes.
Health directo y vía Next.js aprobado. Se inspeccionaron Home y acceso administrativo
de visitante con agent-browser. Playwright ejecutó login ADMIN → producto → variante
estándar con precio cero → precio 12345.67 → SKU duplicado 409 → atributo Color →
edición → recarga → persistencia → desactivar → disponibilidad false → reactivar.
Visitante y cliente rechazados en los endpoints nuevos. Ningún pedido se simula.

Viewports **390×844, 768×1024 y 1440×900**, sin overflow horizontal. Capturas
inspeccionadas: [móvil](evidence/sprint-3/mobile-variants.png),
[tablet](evidence/sprint-3/tablet-variants.png),
[escritorio](evidence/sprint-3/desktop-variants.png).
Consola del recorrido nuevo sin errores JS/hydration y sin respuestas 500.
Los logs contienen los 401/403/409 esperados y conexiones cerradas al parar E2E.
Reportes completos locales en `.runtime/sprint3-*.log` y `frontend/playwright-report/`.

## Bugs encontrados y solucionados

| Jira | Defecto | Corrección y evidencia |
|---|---|---|
| [CO-75](https://cypher-oz.atlassian.net/browse/CO-75) | 404 espurio al cambiar categoría concurrentemente | Listo: bloqueo de Product sin JOIN; prueba concurrente y regresión local/CI PASS |
| [CO-76](https://cypher-oz.atlassian.net/browse/CO-76) | Patrón HTML inválido bajo bandera Unicode v de Chromium | Listo: guion escapado; checkValidity y consola E2E local/CI PASS |

El primer recorrido E2E terminó 1 failed/1 passed por CO-76; el flujo funcional
había pasado. Se corrigió el patrón y la regresión final completa quedó aprobada.
La primera suite backend descubrió CO-75; además se corrigió el harness de NaN para
ejercitar PostgreSQL directamente, ya que Django lo rechazaba antes de llegar a BD.

## Git, PR y CI

- Rama `feature/CO-64-sprint-3`, basada en `feature/CO-63-sprint-2`.
- [PR #3](https://github.com/AndersonOjeda/Cypher-Oz/pull/3), borrador dependiente de PR #2.
- `8fcf407`: modelos, API, auditoría y pruebas backend; corrección CO-75.
- `89a380d`: UI y regresión navegador; corrección CO-76.
- `a1c4ce4`: arquitectura, README y capturas.
- [CI remota aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/34301969262),
  job 102310582820: todos los pasos success sobre a1c4ce4.
  Las actualizaciones posteriores de reporte/README solo contienen documentación.

## Pendientes de aceptación y cierre

1. Asignar las dos historias al Sprint 3 nativo e iniciar/cerrar según corresponda;
   verificar el estado devuelto por Jira.
2. Confirmar la aceptación del alcance administrativo probado. HU-22 exige impedir
   compra de variante inactiva y HU-26 preservar pedidos antiguos. Sus políticas se
   implementan ahora, pero compra y snapshots son de sprints posteriores según el
   propio Documento Maestro. Se pidió al usuario aceptar esa separación, sin presumir
   respuesta. Seguimiento explícito registrado en [CO-57/Sprint 7](https://cypher-oz.atlassian.net/browse/CO-57)
   y [CO-39/Sprint 10](https://cypher-oz.atlassian.net/browse/CO-39).
3. Una vez aceptado el alcance, completar las transiciones y cierre formal en Jira.
   CI y evidencias finales ya están registradas; CO-75 y CO-76 están Listo.

No se implementó Sprint 4 ni se desplegó producción. La aplicación puede ejecutarse
localmente con las instrucciones del README; los datos ficticios E2E permanecen
exclusivamente en `tti_e2e` y su bucket aislado.
