# Sprint 1 vigente: entrega y demostración

Fecha de verificación: 6 de octubre de 2026, America/Bogota.
Jira: [Sprint 1, tablero CO](https://cypher-oz.atlassian.net/jira/software/projects/CO/boards/2/backlog),
id **71**, nombre **CO Sprint 1 | 29 sep 2026**, **48 SP** tras ampliación autorizada.

La funcionalidad base, checkout y creación de pedidos están implementados y probados
localmente. Se añadió el reporte mínimo de pago con T2 y el usuario confirmó las
políticas comerciales el 06/10/2026. NO se declara cierre al 100%: quedan
publicación PR/CI y aceptación. No se presenta el sprint antiguo id 1 como
evidencia del sprint vigente. Consultar la [matriz actual de 96 actividades](sprint-1-expanded.md).

El usuario autorizó adelantar HU-11 (CO-58, 8 SP) y HU-12 (CO-39, 13 SP), junto
con sus seis subtareas. Sprint 1: siete HU + EN-01, 24 subtareas y 96 actividades,
además de cuatro apoyos CO-28/29/31/73. Las 27 nuevas comprobaciones cubren las
24 actividades añadidas y las tres dependencias de direcciones que estaban pendientes.
Consulta directa del tablero el 6 de octubre de 2026: el sprint 71 está ACTIVO,
iniciado por el usuario; los sprints 72 a 77 permanecen futuros. Los 10 elementos
principales de la línea base pasaron a 12: 11 En curso, 1 Por hacer (CO-28), 0 Listo. El fin configurado
sigue siendo 6 de octubre a las 00:00 de America/Bogota; iniciar el sprint no
actualizó ese plazo. No se cambiaron fechas ni se cerró el sprint.

## Abrir para el profesor

Desde la raíz, con dependencias y `.env` ya preparados según README:

```powershell
./scripts/start-sprint1.ps1
```

Web: **http://localhost:3002**. Backend: **http://127.0.0.1:8002**.
Base exclusiva: **tti_sprint1_demo**. Se crea y migra automáticamente; requiere
PostgreSQL local con permiso CREATEDB. No se borran datos al reiniciar.

Cuenta didáctica local: `admin@sprint1.example` / `Demo-Sprint1!Clase8472`.
Esta cuenta se crea solo en la base demo y nunca en la base normal/producción.
Para mostrar un cliente, registrarlo en pantalla con un correo nuevo de ejemplo.
Incluye el producto didáctico `DEMO-CHECKOUT-01` a 40.000 COP y diez unidades
iniciales. Reiniciar NO repone unidades consumidas. Como ADMIN se pueden registrar
entradas justificadas en `/admin/inventario`. No es una oferta comercial real.

Detener con `./scripts/stop-sprint1.ps1`. Los logs quedan en `.runtime/`.
El inicio falla claramente si los puertos de la demo están ocupados.
No ejecutar dos instancias sobre esos puertos ni usar la cuenta de ejemplo fuera
de esta demostración local.

## Recorrido de exposición, uno por uno

| Paso | Jira | Acción del profesor | Resultado verificable |
| --- | --- | --- | --- |
| 1 | CO-30 / CO-73 | Abrir /health/ desde la web | status ok y database postgresql |
| 2 | CO-36, HU-01 | Registrar nombre, correo y contraseña válida | Cuenta creada; datos persistidos |
| 3 | CO-36 | Repetir correo, incluso en mayúsculas; probar contraseña débil | Errores sin crear otra cuenta |
| 4 | CO-55, HU-02 | Login incorrecto, luego correcto; recargar cuenta | Error controlado, luego sesión persistente |
| 5 | CO-56, HU-03 | Cambiar nombre/correo y recargar | Perfil actualizado sin cambiar rol |
| 6 | CO-56 | Crear Casa y Oficina, elegir principal y editar dirección | Datos reales persistidos; solo una principal |
| 7 | CO-56 | Eliminar una dirección: cancelar primero y confirmar después | Cancelación conserva; confirmación elimina |
| 8 | CO-55 / CO-56 | Cerrar sesión y entrar con otro cliente | No puede ver ni modificar direcciones ajenas |
| 9 | CO-55 / CO-63 | Como cliente, abrir /admin/catalogo o /admin/configuracion | Acceso denegado también en API, 403 |
| 10 | CO-63, HU-20 | Login admin; Mi cuenta > Administrar catálogo > Categorías | Alta, duplicado, edición, activar/desactivar y borrar sin relaciones |
| 11 | CO-63 | Repetir con Marcas; consultar /api/v1/categories/ y /api/v1/brands/ | Listas paginadas; solo activas en público |
| 12 | CO-30 | Mi cuenta > Configuración; editar T1/T2, tarifa, umbral y TTL | Persisten al recargar, sin recompilar |
| 13 | CO-41, HU-30 | En la base demo habilitar número reservado 12025550123 y mensaje de prueba | Se muestra enlace wa.me con texto codificado; no hacer envío |
| 14 | CO-41 | Deshabilitar el canal | Botón desaparece; configuración comercial sigue sin inventarse |
| 15 | CO-55 | Cerrar sesión y volver a /cuenta | Redirige al login; API privada responde 401 |
| 16 | CO-29 / CO-31 | Abrir arquitectura y wireframes | Contratos, modelo y 28 vistas con estados y navegación |
| 17 | CO-58, HU-11 | Abrir /comprar, agregar producto, autenticarse y elegir dirección guardada | Conserva selección; dirección actualizada visible |
| 18 | CO-58 | Revisar total con domicilio urbano o recogida | Desglose COP del backend; preview no crea pedido ni descuenta stock |
| 19 | CO-58 | Seleccionar zona especial y revisar | Tarifa pendiente, sin total definitivo y sin confirmación habilitada |
| 20 | CO-39, HU-12 | Volver a urbano/recogida, revisar y confirmar | Pedido único con productos, total y Pedido/Pago Pendiente; stock descontado |
| 21 | CO-39 / CO-56 | Editar o eliminar dirección y consultar /pedidos | Pedido conserva el domicilio original; otros clientes no lo ven |
| 22 | CO-39 | Abrir instrucciones de pago desde pedido | Muestra texto configurado por ADMIN o estado explícito sin configuración |
| 23 | CO-39 | Como ADMIN abrir /admin/inventario, buscar SKU y consultar movimientos | SALE trazable y entradas con motivo/actor; no edición libre de saldo |
| 24 | CO-123 | Mostrar test de respuesta perdida, concurrencia y rollback | Reintento usa mismo pedido; última unidad no se sobrevende; fallo revierte todo |
| 25 | EN-01 / dependencia HU-14 | Desde instrucciones del pedido, reportar una referencia didáctica y recargar | Pago Reportado, no Confirmado; T1 suspendido; referencia y T2 persistentes |
| 26 | EN-01 | Cambiar T2 como ADMIN y reportar otro pedido | Nuevo reporte usa nuevo plazo; el anterior conserva su deadline |

La demostración de WhatsApp verifica enlace/habilitación. No envía mensajes ni
acredita que exista un canal comercial autorizado. En la primera instalación el
canal queda deshabilitado; reiniciar conserva la configuración del usuario.
Productos, variantes e inventario previos se reutilizan como dependencias mínimas.
Esto no declara completadas todas las historias de los sprints futuros.

## Trazabilidad de subtareas

| Historia | Backend / infraestructura | Frontend | Calidad |
| --- | --- | --- | --- |
| EN-01, CO-30 | CO-176: entornos/PostgreSQL; CO-177: parámetros tipados, auditoría y defaults | /admin/configuracion, /health/ integrado | CO-178: checks locales y CI configurada |
| HU-01, CO-36 | CO-89: hash, correo único, rol fijo | CO-90: registro y errores | CO-91: pruebas positivas/negativas |
| HU-02, CO-55 | CO-92: cookies, CSRF, refresh, logout/revocación | CO-93: sesión y acceso por rol | CO-94: permisos, expiración, replay y navegador |
| HU-03, CO-56 | CO-88: perfil y direcciones del propietario | CO-95: CRUD, confirmación, errores de campo | CO-96: integridad, aislamiento, concurrencia, persistencia |
| HU-20, CO-63 | CO-146: constraints, PROTECT, auditoría, visibilidad | CO-147: formularios/listas/estados/paginación | CO-148: API y navegador |
| HU-30, CO-41 | CO-170: configuración pública mínima | CO-171: enlace accesible y responsive | CO-172: habilitado/deshabilitado, destino y texto |
| HU-11, CO-58 | CO-118: preview autoritativo sin reservar | CO-119: entrega, dirección y revisión COP | CO-120: precios/promos, permisos, cambios y zona especial |
| HU-12, CO-39 | CO-121: transacción, snapshots, SALE, pago y T1 | CO-122: confirmación recuperable, pedido e instrucciones | CO-123: concurrencia, idempotencia, rollback e historia |

CO-95-A4, CO-88-A4 y CO-96-A4 ya tienen integración real y pruebas PostgreSQL/API/
navegador en este Sprint 1 ampliado. El [informe histórico](sprint-1-audit.md)
conserva el diagnóstico previo, no el estado vigente.

## Resultados ejecutados

| Verificación | Resultado |
| --- | --- |
| Backend PostgreSQL, pytest completo | **196 passed**, incluye 48 casos de checkout/pedidos/reporte y reglas confirmadas |
| Frontend Vitest | **35 passed**, 8 archivos |
| Playwright completo | **33 passed**, móvil 390x844, tablet 768x1024 y escritorio 1440x900; ver [matriz actual](sprint-1-expanded.md) |
| Escenarios específicos Sprint 1 dentro de Playwright | 21: siete flujos x 3 tamaños, incluyendo checkout/pedido/inventario y recuperación tras respuesta perdida |
| Ruff check y format | Aprobados |
| ESLint, TypeScript, producción Next.js | Aprobados |
| Migraciones | Sin cambios pendientes de generar; aplicadas en bases aisladas |
| Demo local | Health, login admin, cuenta, configuración, categorías, preview y consulta de inventario aprobados en 390/1440 px |
| Wireframes CO-31 | 28 vistas, navegación móvil/escritorio, sin overflow, recuperación de error y pago Reportado verificados |
| Dependencias de producción | npm audit --omit=dev: 0 vulnerabilidades reportadas |

La instalación actualizó Next.js de 16.3.4 a 16.3.8 y sus dependencias compatibles.
Quedan cinco avisos npm de desarrollo derivados de `braces` en ESLint; npm propone
una degradación incompatible para resolverlos. No se aplicó esa degradación.
No hay ejecución nueva de GitHub Actions vinculada a estos cambios locales.

Comandos de repetición:

```powershell
# backend/
.venv/Scripts/python -m pytest -q
.venv/Scripts/ruff check .
.venv/Scripts/ruff format --check .
.venv/Scripts/python manage.py makemigrations --check --dry-run
# frontend/
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e -- sprint1
node scripts/verify-wireframes.mjs
node scripts/verify-sprint1-demo.mjs
```

Playwright requiere el storage de la instalación existente (`docker compose --profile media up -d`).
El informe interactivo completo está en `frontend/playwright-report/index.html`.
El navegador integrado falló por un problema de entorno; se usó Chromium/Playwright real.

El paso 25 es una demostración con datos ficticios: no realizar transferencias reales.
La pantalla muestra explícitamente cuando no hay instrucciones bancarias configuradas.
Vencimiento automático, revisión administrativa de fondos y cancelación no forman
parte de este incremento de T2; dependen de CO-130 y de los sprints posteriores.

## Artefactos de la entrega

- [Arquitectura y contratos](architecture-current.md).
- [Wireframes navegables de las 28 vistas](wireframes.html).
- [Cuenta móvil](evidence/sprint-1-current/account-390.png) y [escritorio](evidence/sprint-1-current/account-1440.png).
- [Configuración móvil](evidence/sprint-1-current/settings-390.png) y [escritorio](evidence/sprint-1-current/settings-1440.png).
- [Categorías móvil](evidence/sprint-1-current/categories-390.png) y [escritorio](evidence/sprint-1-current/categories-1440.png).
- [Wireframes móvil](evidence/sprint-1-current/wireframes-390.png) y [escritorio](evidence/sprint-1-current/wireframes-1440.png).
- [Checkout móvil](evidence/sprint-1-current/checkout-mobile.png), [pedido](evidence/sprint-1-current/order-mobile.png) e [inventario](evidence/sprint-1-current/inventory-mobile.png).
- [Pago reportado móvil](evidence/sprint-1-current/payment-mobile.png), [tablet](evidence/sprint-1-current/payment-tablet.png) y [escritorio](evidence/sprint-1-current/payment-desktop.png).
- Regresión vigente: [backend JUnit](evidence/sprint-1-current/backend-t2-junit.xml), [frontend JUnit](evidence/sprint-1-current/frontend-t2-junit.xml) y [Playwright JUnit](evidence/sprint-1-current/playwright-t2-junit.xml).

## Conservar cada sprint para exponer

Ejecutar `./scripts/export-sprint.ps1 -Sprint 1` desde la raíz al terminar la
verificación. Produce un ZIP fechado en `.runtime/entregas/` con código, pruebas,
documentación y `ENTREGA.json` con commit base y hashes. Incluye cambios locales
sin commit; excluye secretos, dependencias instaladas y bases de datos. Extraerlo
en otra carpeta, preparar `.env` e instalar desde los lockfiles permite recuperar
esa entrega aunque el desarrollo continúe. Conservar también su informe Playwright.

| Sprint vigente | Incremento que se deberá demostrar |
| --- | --- |
| 1 | Configuración, registro/sesión, perfil/direcciones, categorías/marcas, WhatsApp, checkout, pedidos y reporte mínimo para verificar T2 |
| 2 | Productos/imágenes, variantes/precios e inventario trazable |
| 3 | Promociones, catálogo público, detalle, búsqueda y carrito anónimo |
| 4 | Completar HU-09/10/28/19 y su integración con checkout adelantado; 21 SP |
| 5 | Automatización/reversión de inventario, instrucciones y reporte de pago; 16 SP |
| 6 | Resolución de pago, seguimiento, preparación y cancelación |
| 7 | Entrega, WhatsApp contextual, comparador y aceptación integral |

Para cada siguiente sprint: ejecutar su recorrido y regresión de los anteriores,
guardar evidencias nuevas y exportar otro ZIP con su número. La exportación por sí
sola no acredita pruebas ni cierre. La validación del profesor se registra después
de que revise el incremento correspondiente.
