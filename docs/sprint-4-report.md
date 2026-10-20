# Sprint 4 — Cierre y verificación técnica

Fecha: 19 de octubre de 2026, America/Bogota.
Rama: `feature/CO-65-sprint-4`. Base auditada: `96708c77b8952947738a02356a14b9baa26f762a`.

El sprint 74 está cerrado en Jira desde `2026-10-20T01:37:41.533Z`
(19 de octubre, 20:37 en Bogotá). Sus cuatro historias y doce subtareas están
en **Listo**, con **21 SP**. La revisión posterior encontró y corrigió defectos
que impedían respaldar el informe original. La versión corregida supera todas
las comprobaciones locales exigidas por CI.

## Alcance y trazabilidad

| Historia | SP | Subtareas |
|---|---:|---|
| [CO-57 — HU-09, revalidación del carrito](https://cypher-oz.atlassian.net/browse/CO-57) | 8 | CO-112, CO-113, CO-114 |
| [CO-37 — HU-10, autenticación tardía](https://cypher-oz.atlassian.net/browse/CO-37) | 5 | CO-115, CO-116, CO-117 |
| [CO-70 — HU-28, condiciones de entrega](https://cypher-oz.atlassian.net/browse/CO-70) | 5 | CO-164, CO-165, CO-166 |
| [CO-62 — HU-19, consulta de clientes](https://cypher-oz.atlassian.net/browse/CO-62) | 3 | CO-143, CO-144, CO-145 |

Tablero CO board, id 2. Sprint CO Sprint 4, id 74.
No se duplican puntos del checkout adelantado al Sprint 1.

## Correcciones verificadas

- **Carrito:** validación estricta de estructura, identificadores, cantidades y
  precios finitos; máximo 100 líneas, cantidades de 1 a 10.000 y sin duplicados.
  Las entradas inválidas devuelven 400. Se verifica actividad de variante,
  producto, categoría y marca; promociones vigentes y stock. Las consultas se
  hacen por lotes: una regresión comprueba tres consultas SQL para once líneas.
- **Precio observado:** detalle y compra conservan `unit_price` y lo envían al
  validador. Un cambio exige aceptación explícita y una nueva revisión del total.
  Los conflictos y errores bloquean la revisión e invalidan cotizaciones previas.
  Los carritos antiguos sin precio siguen siendo legibles; el total definitivo
  siempre se obtiene del servidor. Se conservan idempotencia, snapshots y
  comprobación transaccional de inventario al confirmar.
- **Entrega:** `DeliverySelector` integrado en `/comprar`, recogida gratis,
  tarifa y umbral urbanos configurables, y zona especial con tarifa pendiente
  y continuación bloqueada. Los números inválidos devuelven 400; un PATCH
  inválido no modifica parcialmente la configuración ni su auditoría.
- **Clientes:** acceso exclusivo ADMIN, datos mínimos y paginación real
  `{count,next,previous,results}`: 20 por defecto y máximo 100. Pantalla con
  búsqueda, orden estable, navegación de páginas y estados de carga/vacío/error.
- **Frontend y calidad:** se ignoran respuestas obsoletas, la selección de
  variante ya no se reinicia ante nuevas referencias del mismo producto, y se
  corrigen lint, formato y desbordamientos móviles de pestañas y búsqueda.
- **Evidencia:** nueva prueba integrada `frontend/e2e/sprint4.spec.ts`, sin
  simular respuestas API del flujo. CI conserva las capturas de Sprint 4.

## Resultados locales anteriores a integrar main

| Comprobación | Resultado |
|---|---|
| Backend completo, PostgreSQL aislado `test_tti_performance` | **259/259**, 448,32 s |
| Frontend completo, 19 archivos, dos workers | **80/80** |
| Playwright completo, móvil/tableta/escritorio | **42/42**, 235,62 s |
| Ruff lint y formato | Aprobados, 83 archivos con formato correcto |
| ESLint y TypeScript | Aprobados |
| Next.js build de producción | Aprobado |
| Migraciones pendientes | `No changes detected` |
| Wireframes, teclado/foco, contraste, estados y overflow | **28 vistas**, aprobado |
| Chrome DevTools sobre build de producción | Precio observado conservado; validación 200; entrada `[null]` rechazada con 400 |

El flujo real cubre carrito anónimo, retorno del login, stock cambiado durante
autenticación, aceptación de precio nuevo, inactividad de las cuatro entidades,
agotamiento, recogida, bloqueo de zona especial, pedido persistido con total del
servidor, invalidación de sesión y privacidad del listado administrativo.
Playwright usa PostgreSQL y MinIO aislados: `tti_e2e` y `tti-catalog-e2e`.

```powershell
cd backend
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m ruff format --check .
.venv/Scripts/python manage.py makemigrations --check --dry-run --settings=config.settings.performance_test
.venv/Scripts/python -m pytest --ds=config.settings.performance_test -q --junitxml=../.runtime/sprint4-audit/backend-final.xml
cd ../frontend
npm run lint
npm run typecheck
npm test -- --maxWorkers=2 --reporter=junit --outputFile=../.runtime/sprint4-audit/frontend-final.xml
npm run build
$env:PLAYWRIGHT_JUNIT_OUTPUT_NAME='../.runtime/sprint4-audit/browser-final.xml'
npm run test:e2e -- --reporter=list,junit
node scripts/verify-wireframes.mjs
```

## Evidencias y límites

Capturas: [evidence/sprint-4](evidence/sprint-4/).
Auditoría original y resolución: [sprint-4-audit.md](sprint-4-audit.md).
JUnit y registros locales: `.runtime/sprint4-audit/`.
Se adjuntan el informe y el paquete de evidencia a Jira, con referencias desde
las historias y subtareas. La conciliación conserva estimaciones, responsables,
estado Listo, cierre del sprint e historial de planificación.

Las correcciones se publicaron en
[PR #20](https://github.com/AndersonOjeda/Cypher-Oz/pull/20), tras integrar
`main` (`1b1c171`) conservando las correcciones de correo, autenticación y
almacenamiento. La integración se realiza en una copia de trabajo aislada para
preservar la rama de Sprint 5 abierta en la carpeta compartida.

Después de integrar main pasan 21 regresiones de catálogo/correo/administrador,
ESLint, TypeScript y **82/82 pruebas frontend**. La validación completa del
resultado integrado está en las comprobaciones del PR y en
[GitHub Actions](https://github.com/AndersonOjeda/Cypher-Oz/actions).
Este informe conserva los resultados locales anteriores como evidencia histórica;
el resultado de entrega se contrasta con el SHA y la ejecución remota del PR.

Las pruebas funcionales no certifican 1.000 usuarios concurrentes; las
mediciones y sus límites constan en
[el informe de rendimiento](performance-50-products-1000-users.md).
