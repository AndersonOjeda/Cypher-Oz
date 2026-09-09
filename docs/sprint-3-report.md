# Sprint 3 — Reporte final

Ejecución: 8 de septiembre de 2026, America/Bogota. Duración planificada: una semana.
Alcance oficial: 11 SP. Sprint 2 cerrado por el usuario y verificado en Jira antes
de comenzar: `completeDate=2026-09-09T01:51:40.019Z`.

**SPRINT COMPLETADO**: alcance administrativo aceptado, implementado y probado;
11/11 SP en Listo, con CI remota aprobada. Cierre formal verificado en Jira:
`state=closed`, `completeDate=2026-09-09T02:28:21.805Z`
(8 de septiembre de 2026, 21:28:21 America/Bogota).

## Historias, Jira y Story Points

| Historia | SP | Implementación | Estado Jira |
|---|---:|---|---|
| [CO-64 — HU-22 Variantes](https://cypher-oz.atlassian.net/browse/CO-64) | 8 | Implementada, probada y aceptada | Listo |
| [CO-68 — HU-26 Precios](https://cypher-oz.atlassian.net/browse/CO-68) | 3 | Implementada, probada y aceptada | Listo |

**11/11 SP implementados, aceptados y en historias Done.** Épicas CO-26 y CO-52
reutilizadas; prioridad Highest conforme P0, responsable Ander Ojeda.
`CO Sprint 3`, id **3**, tablero **2**, identificado mediante el campo Sprint
de CO-64. Las dos historias y los bugs CO-75/CO-76 están asignados al mismo sprint.
Consulta completa `project = CO AND sprint = 3`: cuatro issues, todas Listo.
Los bugs no añaden SP a los 11 oficiales. El usuario inició y completó el sprint
desde Jira, debido al error `INVALID_ARGUMENT` del conector de gestión de sprints.
Se verificó la asignación, el estado y las fechas mediante el campo Sprint de
las cuatro incidencias: `closed`, `startDate=2026-09-09T02:26:40.644Z`,
`endDate=2026-09-15T05:00:00.000Z`, `completeDate=2026-09-09T02:28:21.805Z`.
Las historias se restauraron a Listo después del inicio y antes de completar.
Estas fechas reflejan la regularización administrativa del trabajo ya ejecutado;
no se usan para presentar la duración del sprint como tiempo de desarrollo.

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
| CI remota, commit ff731b6 | **PASS**, ejecución completada con success |
| CI remota, commit 26d40ef | **PASS**, job y todos sus pasos success |

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
- [CI posterior aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/34302348108)
  sobre ff731b6, verificada durante el cierre formal.
- [CI del registro de aceptación aprobada](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/34302997556)
  sobre 26d40ef, job 102313747032 y todos sus pasos success.
  Las actualizaciones posteriores del reporte solo contienen documentación.

## Decisión de aceptación y cierre

Después de presentar las evidencias y proponer el traslado de las comprobaciones
integradas, el usuario indicó **«prosigamos con el cierre formal»**. Se registra
la aceptación del alcance administrativo de variantes/precios probado en Sprint 3.
La decisión, los criterios ajustados, la Definition of Done y las evidencias están
registrados en CO-64 y CO-68, antes de sus transiciones a Listo.

- **CO-64:** exclusión de variantes inactivas probada en la política de disponibilidad.
  La comprobación de impedir continuar la compra con una variante inactiva, incluso
  retenida en el carrito, queda como criterio pendiente en
  [CO-57/Sprint 7](https://cypher-oz.atlassian.net/browse/CO-57).
- **CO-68:** edición y auditoría del precio probadas. Los snapshots de pedidos se
  implementarán en Sprint 10. **CP-HIST-001**, crear un pedido, editar SKU/nombre/precio
  y comprobar que sus datos y totales históricos se conservan, queda pendiente en
  [CO-39/Sprint 10](https://cypher-oz.atlassian.net/browse/CO-39).

CO-57 y CO-39 conservan estado Por hacer y sus estimaciones; los recorridos de compra
y pedidos históricos no se declaran probados. Los criterios originales se mantienen
trazables y no se modificó silenciosamente el Documento Maestro.

## Corrección del orden de cierre en Jira

El usuario informó que Sprint 3 aparecía vacío. La consulta confirmó que las cuatro
incidencias seguían asignadas correctamente, pero todas estaban Listo mientras el
sprint todavía era futuro. Haberlas terminado antes del inicio es compatible con
la ocultación del trabajo terminado en el backlog; la configuración del tablero
no pudo inspeccionarse porque el conector también falla en esa lectura.

Se registró la explicación en CO-64 y CO-68 y se devolvieron temporalmente a En curso
para permitir iniciar el sprint desde la interfaz. Sus criterios, aceptación y
resultados de pruebas permanecen completos; no se ha reabierto ningún defecto.
El usuario respondió «ya lo inicie»; se verificó `active` y se restauraron ambas
historias a Listo. Después indicó «ya le di a completar»; la consulta de las cuatro
incidencias confirmó `state=closed` y `completeDate=2026-09-09T02:28:21.805Z`.
La reapertura administrativa y el cierre formal están resueltos.

No se implementó Sprint 4 ni se desplegó producción. La aplicación puede ejecutarse
localmente con las instrucciones del README; los datos ficticios E2E permanecen
exclusivamente en `tti_e2e` y su bucket aislado.
