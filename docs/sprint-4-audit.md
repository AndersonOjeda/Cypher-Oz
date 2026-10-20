# Auditoría independiente del Sprint 4

Fecha: 19 de octubre de 2026, America/Bogota.
Repositorio evaluado: `feature/CO-65-sprint-4`, commit
`96708c77b8952947738a02356a14b9baa26f762a`.

**Dictamen inicial sobre `96708c7`: el cierre administrativo existía, pero había
pendientes técnicos que impedían respaldar el informe de cierre.**
La primera fase fue de solo lectura. Los hallazgos siguientes documentan esa
versión; la resolución posterior autorizada por el usuario figura al final.

## Hallazgos ordenados por prioridad

### P1 — Las comprobaciones obligatorias de CI fallan

`ruff check backend` encontró 8 errores, incluido `F821` por `true` no definido en
`backend/apps/configuration/views.py:111`. La rama condicional normalmente evita
evaluar ese identificador, pero Ruff lo rechaza igualmente. Hay también imports
sin ordenar y líneas largas. `ruff format --check backend` señala 10 archivos,
incluidos archivos de las mejoras de rendimiento anteriores.

`npm run lint` falla con 4 errores y 9 advertencias. Los errores están en
`product-detail.tsx:37`, `cart-validator.tsx:78`, `delivery-selector.tsx:61` y
`customer-list.tsx:45`, por sincronización de estado desde efectos. La CI exige
ambos linters y el formato en `.github/workflows/ci.yml:45` y `:65`.
Por tanto, una compilación exitosa no equivale a una CI aprobada.

### P1 — El contrato de revalidación acepta datos inválidos o devuelve HTTP 500

`backend/apps/orders/views.py:145–155` recorre datos sin un serializer que limite
tipo, tamaño, cantidades y estructura de cada línea. Se reprodujo en PostgreSQL
aislado:

| Petición a `/api/v1/checkout/validate/` | Esperado | Observado |
|---|---|---|
| `{"items":[null]}` | HTTP 400 | HTTP 500, `AttributeError` |
| Cantidad `"abc"` con variante válida | HTTP 400 | HTTP 500, comparación de tipos |
| Cantidad `-10` con variante válida | HTTP 400 | HTTP 200, estado `ok` |

Además, hace hasta tres consultas por línea y no limita el número de líneas.
Debe reutilizar límites y reglas del checkout, validar antes de consultar y
cargar variantes/stock/promociones en lotes.

### P1 — Categoría o marca inactiva no se consideran al revalidar

La consulta de `backend/apps/orders/views.py:160` solo verifica actividad de
variante y producto. Una variante con producto activo, pero categoría desactivada,
devuelve `status=ok`; se reprodujo ese caso. La actividad de marca tampoco se
incluye en esa consulta, aunque ese caso concreto no se ejecutó como probe.

Contradice expresamente los criterios de
[CO-57](https://cypher-oz.atlassian.net/browse/CO-57), que requieren bloquear
productos, categorías, marcas y variantes inactivos. El checkout final sí consulta
`variant.catalog_available` en `apps/orders/services.py:100`; no se ha demostrado
que este fallo permita crear pedidos inválidos. El defecto confirmado está en la
respuesta de revalidación y la información mostrada antes de confirmar.

### P1 — Los cambios de precio no pueden detectarse en el flujo real del carrito

`frontend/src/features/orders/cart-validator.tsx:50` envía únicamente `variant_id`
y `quantity`. `CartLine` tampoco conserva el precio observado por el comprador.
El backend solo compara precios si recibe `unit_price`, en
`backend/apps/orders/views.py:201`.

Chrome DevTools confirmó en la aplicación compilada la petición real:

```json
{"items":[{"variant_id":1,"quantity":1}]}
```

La UI muestra «Disponibilidad y precios confirmados con la tienda», pero ese
contrato no puede informar `price_changed` frente al precio anterior. El test
backend que sí envía `unit_price` no demuestra integración con el frontend.
`Purchase` tampoco consume `onValidationComplete` para coordinar esos estados.
El total del pedido se vuelve a calcular mediante el checkout existente; no se
afirma que el cliente pueda fijar el precio final.

### P2 — La nueva API de entrega no valida correctamente valores numéricos

En `/api/v1/admin/delivery/settings/`, `urban_flat_shipping_rate="abc"` produce
HTTP 500 por `int(val)` en `apps/configuration/views.py:168`, en lugar de 400.
`/api/v1/delivery/quote/` acepta `subtotal="NaN"` con HTTP 200: el manejo de
`InvalidOperation` lo convierte en cero. Falta un contrato numérico estricto y
finito; no se demuestra manipulación del total final, que se calcula en checkout.

### P2 — La suite frontend completa no es estable

La primera ejecución completa registró **74/75** tests aprobados; la segunda,
sin la suite backend en paralelo, **73/75**. Fallan tests de selección de variantes
y aviso de añadido al carrito en `product-detail.test.tsx`. Ese archivo pasa
aisladamente (**4/4**). Se conserva como fallo dependiente de la ejecución, no como
regresión determinista ni como «100 % aprobado». Hace falta investigar la
sincronización del estado, el aislamiento y el timing de esos tests.

### P2 — Jira y el informe de cierre no reflejan la evidencia técnica

El tablero y los puntos están organizados correctamente, pero los criterios y
actividades permanecen sin marcar, con texto de trabajo pendiente:

- 4 historias: **28 casillas sin marcar**, ninguna marcada.
- 12 subtareas: **48 actividades sin marcar**, ninguna marcada.
- Los comentarios de cierre revisados en CO-37, CO-57, CO-62, CO-70 y CO-114 afirman
  finalización, pero no enlazan reportes, capturas o ejecuciones reproducibles.
- `docs/sprint-4-report.md:7` declara validación completa; sus cifras de 80 tests
  backend y 75 frontend aprobados no describen la auditoría actual.
- El informe referencia `DeliverySelector`, pero `rg` solo encuentra usos del
  componente en tests; `/comprar` mantiene el selector previo. No implica que las
  modalidades no funcionen: la cotización anterior sigue operativa. Sí implica
  que probar ese componente aislado no verifica su integración en compra.
- No hay archivo E2E específico de Sprint 4 en `frontend/e2e`. La auditoría no
  ejecutó toda la regresión Playwright y no certifica los casos que faltan.

No deben marcarse criterios automáticamente solo para hacer coincidir el texto
con «Listo»: primero corregir/verificar cada criterio y vincular su evidencia.

### P2 — La entrega remota y la CI no quedaron verificadas

`git ls-remote --heads origin feature/CO-65-sprint-4` no devuelve una rama remota.
La rama local tampoco muestra upstream en `git branch -vv`. La búsqueda mediante
el conector GitHub no encontró una PR con ese head. No se verificó una ejecución
de CI satisfactoria para el commit auditado.

La consulta de workflows del conector solo contempla eventos de PR y primera
página; un resultado vacío no demuestra ausencia de todo workflow del repositorio.
`gh` local no tiene autenticación. No se publicaron ramas ni PRs desde la auditoría.

## Jira: comprobaciones que sí coinciden

[Tablero CO, id 2](https://cypher-oz.atlassian.net/jira/software/projects/CO/boards/2).
Sprint **74**, `CO Sprint 4 | 20 oct 2026`, estado `closed`.
Cierre: `2026-10-20T01:37:41.533Z`, equivalente al **19 de octubre a las 20:37:41**
en Bogotá.

| Historia | SP | Estado | Subtareas |
|---|---:|---|---|
| [CO-57 — HU-09](https://cypher-oz.atlassian.net/browse/CO-57) | 8 | Listo | CO-112, CO-113, CO-114: Listo |
| [CO-37 — HU-10](https://cypher-oz.atlassian.net/browse/CO-37) | 5 | Listo | CO-115, CO-116, CO-117: Listo |
| [CO-70 — HU-28](https://cypher-oz.atlassian.net/browse/CO-70) | 5 | Listo | CO-164, CO-165, CO-166: Listo |
| [CO-62 — HU-19](https://cypher-oz.atlassian.net/browse/CO-62) | 3 | Listo | CO-143, CO-144, CO-145: Listo |

Total **21 SP**, cuatro historias y doce subtareas, todas asignadas a Ander Ojeda
y al sprint 74. La consulta JQL se leyó hasta `isLast=true`.

La habilidad de búsqueda de conocimiento de Atlassian permitió contrastar estos
criterios y estados con el código, en lugar de tomar el comentario de cierre como
prueba de cumplimiento técnico. No se enviaron mensajes ni comentarios.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Backend, suite completa, DB propia `test_tti_performance` | **237/237**, 329,29 s |
| Probes negativos adicionales, otra DB aislada | **6 fallos de contrato reproducidos** |
| Frontend completo, ejecución 1 | **74/75** |
| Frontend completo, ejecución 2 | **73/75** |
| Product detail aislado | **4/4** |
| Ruff lint | Falla, 8 errores |
| Ruff formato | Falla, 10 archivos |
| ESLint | Falla, 4 errores y 9 advertencias |
| Typecheck | Pasa |
| Build Next.js de producción | Pasa, incluye `/admin/clientes` |
| Migraciones pendientes | `No changes detected` |
| Regresión completa Playwright | No ejecutada |

### Comprobación manual con Chrome DevTools

Aplicación compilada en `http://localhost:3010`, backend aislado `tti_loadtest`,
contexto de navegador separado. Datos sintéticos; cuenta cliente de auditoría
creada solo en esa base. No se creó ningún pedido ni se reservó stock.

- Detalle de producto → añadir al carrito sin autenticación: correcto.
- Compra → login/registro con `next=/comprar`: correcto.
- Registro, inicio de sesión y retorno a compra conservando la línea: correcto.
- Identidad de cliente: HTTP 200; listado administrativo para ese cliente: HTTP 403.
- Recogida en tienda → revisar total: envío $0 y total $110.000, confirmación
  disponible tras la cotización. La prueba se detuvo antes de crear el pedido.
- Petición de revalidación inspeccionada: falta `unit_price`, como se describe arriba.

## Evidencias reproducibles y orden de corrección

Artefactos locales ignorados por Git en `.runtime/sprint4-audit/`:
`backend.xml`, `frontend.xml`, `frontend-rerun.xml`, `contract-probes.xml`,
`test_contract_probes.py` y `jira-snapshot.json`.

```powershell
cd backend
.venv/Scripts/python -m pytest --ds=config.settings.performance_test -q --junitxml=../.runtime/sprint4-audit/backend.xml
.venv/Scripts/python -m pytest --ds=config.settings.loadtest ../.runtime/sprint4-audit/test_contract_probes.py -q --tb=short
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m ruff format --check .
cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Primero corregir contrato/actividad/precio de revalidación y validadores numéricos;
después resolver lint/formato y estabilizar regresión frontend. Completar la prueba
integrada de Sprint 4, publicar la rama y obtener CI aprobada. Finalmente conciliar
criterios, actividades e informe con las evidencias reales en Jira.

## Resolución posterior a la auditoría

El usuario autorizó corregir lo necesario. Se incorporaron validadores estrictos,
consultas de carrito por lotes, actividad de categoría/marca, precios observados
persistidos, aceptación explícita y bloqueo ante conflictos. Se integró el
selector de entrega, se validaron sus entradas y se agregó la paginación exigida
por CO-143/144/145. También se corrigieron respuestas obsoletas, estabilidad de
selección, lint/formato y desbordamientos móviles observados con Chrome DevTools.

Validación final sobre las correcciones: **259/259 backend**, **80/80 frontend**,
**42/42 Playwright** en tres tamaños de pantalla. Pasan Ruff, formato, ESLint,
TypeScript, build y migraciones. La comprobación de los **28 wireframes** pasa.
Chrome DevTools confirmó sobre producción local que el precio observado se
conserva y se envía, y que `[null]` devuelve 400.

El [informe corregido](sprint-4-report.md) sustituye las cifras y afirmaciones
incorrectas del reporte original. Se concilian criterios y actividades en Jira
con evidencia adjunta, conservando el cierre administrativo y el historial.
No se afirma publicación de la rama, merge, despliegue ni CI remota aprobada.
La capacidad de 1.000 usuarios concurrentes sigue sujeta al informe de rendimiento.
