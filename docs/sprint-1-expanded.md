# Sprint 1 ampliado: evidencia y estado real

Verificado el 6 de octubre de 2026, America/Bogota.
[Jira, tablero CO](https://cypher-oz.atlassian.net/jira/software/projects/CO/boards/2/backlog),
sprint 71 ACTIVO. Fuente: consulta directa de los 12 elementos principales y de las
24 subtareas por sus padres; no se infiere el estado del sprint a partir de las tareas.

## Dictamen

**Checkout y creación de pedidos ya funcionan localmente y quedaron adelantados al
Sprint 1 en Jira por autorización del usuario. No se declara el sprint cerrado.**

- Alcance: 7 HU + EN-01, **48 SP**, 24 subtareas / 96 actividades.
- Jira confirma **94 casillas técnicas marcadas / 96**; no equivale a 97,9% de
  aceptación ni cuenta los criterios de los cuatro apoyos CO-28/29/31/73.
- Los 12 elementos principales: 11 En curso, CO-28 Por hacer; 0 Listo.
  Las 24 subtareas permanecen En curso, sujetas a revisión.
- Las tres dependencias anteriores CO-88-A4, CO-95-A4 y CO-96-A4 ya están probadas
  con pedidos reales: dirección actualizada en checkout y snapshots históricos.
- Sprint 4 queda en 21 SP / 12 subtareas / 48 actividades. Sprint 5 queda en
  16 SP / 9 subtareas / 36 actividades. Total del proyecto: 193 SP sin duplicación.
- Fechas intactas: Sprint 1 termina según Jira el **06/10/2026 00:00 -05:00**, ya
  pasado. No se cerró ni se amplió el plazo automáticamente.

## Continuación: reporte de pago y T2

El usuario confirmó las reglas comerciales el 06/10/2026. Se añadió el reporte
mínimo de pago para verificar el criterio de configuración futura de EN-01:
propietario/CSRF, referencia, cambio a Reportado, suspensión de T1 y T2 persistido.
No confirma fondos ni amplía el deadline ante reintentos. HU-14 sigue planificada
en Sprint 5 para su validación integral y su interacción con scheduler; no se
declara trasladada ni terminada de forma implícita. La matriz de 96 actividades
no cambia y PR/CI siguen pendientes. La regresión completa vigente es 196/35/33,
registrada abajo; sustituye al corte anterior de 178/32/33.

Reglas confirmadas: recogida gratis; tarifa urbana configurable; umbral gratuito
sobre el total descontado; zona especial bloqueada hasta cotizar; promoción fija
sin acumulación. T2 y estas reglas ya no son pendientes de implementación local.

## Pendientes de cierre

| Pendiente | Qué falta |
| --- | --- |
| CO-91 / HU-01-T03-A4 | Publicar PR y evidencias vinculadas a la historia |
| CO-178 / EN-01-T03-A4 | PR y CI remota verde del commit entregado; README/arquitectura vinculados |
| Aceptación | Revisión del profesor/usuario y criterios/DoD de historias y apoyos; las casillas técnicas no sustituyen esa aprobación |

El usuario autorizó publicar una rama y PR sin merge el 06/10/2026, incluyendo
inventario preexistente necesario para pedidos. Se inicia la publicación y validación
remota; sus enlaces y resultados se registrarán al finalizar, sin anticipar éxito.
No se inventa una CI ni una aprobación. Las reglas comerciales ya se confirmaron; no se
cargaron promociones, cuentas bancarias ni instrucciones comerciales reales.

## Resultados y reproducción

| Verificación | Resultado / archivo |
| --- | --- |
| PostgreSQL / pytest completo | **196 passed**, incluye 48 casos de checkout/pedidos/reporte; [JUnit](evidence/sprint-1-current/backend-t2-junit.xml) |
| Frontend / Vitest | **35 passed**, 8 archivos; [JUnit](evidence/sprint-1-current/frontend-t2-junit.xml) |
| Sprint 1 / navegador | 21 escenarios aprobados: 7 flujos x móvil, tablet y escritorio, incluidos pedido y entradas de inventario |
| Regresión Playwright completa | **33 passed**, 6,6 minutos; móvil 390x844, tablet 768x1024 y escritorio 1440x900; [JUnit](evidence/sprint-1-current/playwright-t2-junit.xml) |
| Calidad | Ruff, migraciones sin cambios pendientes, ESLint, TypeScript y build de producción aprobados |
| Demo persistente | Health, login, cuenta, configuración, categorías, preview y consulta de inventario: PASS en 390/1440 px, sin crear pedido |
| Wireframes | 28 vistas verificadas en móvil/escritorio; prototipo, no implementación de funcionalidades futuras |

[Comandos y guion de 26 pasos](sprint-1-current.md).
[Reporte interactivo Playwright](../frontend/playwright-report/index.html).
Los XML son evidencia local ejecutada; no son GitHub Actions.
`e2e-junit.xml` y `orders-junit.xml` conservan ejecuciones anteriores
(28 E2E aprobadas / 5 fallidas y 27 casos focalizados aprobados).
`orders-t2-junit.xml` conserva una corrida inicial de 46 aprobadas / 1 fallida por
un fixture incompleto, corregido antes de la regresión final. La primera regresión
completa de T2 también detectó que el test de throttling dependía de la duración
real del hash; se fijó el reloj solo en ese test, sin modificar el límite productivo.
Los tres reportes vigentes son los enlazados arriba: 196/35/33, cero fallos.
No sumar pruebas repetidas entre reportes.
Los fallos intermedios provenían de búsquedas limitadas a la primera página del
catálogo en los tests y de un selector de alerta que también encontraba el anunciador
de rutas de Next.js. Se corrigieron los localizadores y se repitió la suite completa:
33/33 aprobadas, sin limpiar la base de pruebas para ocultar la paginación.

## Casos críticos nuevos

| Requisito | Prueba real |
| --- | --- |
| No reservar stock en preview | test_preview_uses_saved_address_and_does_not_reserve |
| Envío y promoción | test_shipping_threshold, test_pickup_and_special_zone, test_promotion_expiry_revalidation_and_snapshot |
| Precios manipulados, dirección ajena, CSRF | test_ownership_csrf_and_manipulated_amounts |
| Precio/dirección/stock cambian tras revisar | test_change_after_review_requires_new_review y token vencido/manipulado |
| Última unidad concurrente | test_concurrent_last_unit_and_idempotency, dos clientes y mismo usuario |
| Misma clave, un pedido | test_idempotent_replay_and_conflicting_key; E2E pierde respuesta, recarga y recupera mismo pedido |
| Rollback completo | test_order_rollback_covers_all_writes: pedido, pago, entrega, historiales, stock y SALE |
| Historia inmutable | test_order_snapshots_survive_catalog_address_and_settings_changes y E2E que elimina dirección/cambia SKU/precio |
| T1/configuración | test_config_changes_apply_to_new_orders_only |
| T2 y reintentos | test_payment_report_persists_t2_and_suspends_t1, test_t2_change_only_affects_new_reports_and_replay_never_extends |
| Reporte seguro y atómico | test_payment_report_ownership_csrf_and_auth, test_payment_report_rejects_at_t1_boundary, test_payment_report_rollback, test_concurrent_payment_reports_record_one_transition |
| Umbral neto y no acumulación | test_confirmed_discounted_shipping_threshold_and_no_promotion_stacking |
| Instrucciones y privacidad | test_payment_instructions_and_public_purchase_data, test_order_list_and_detail_are_owner_scoped |
| Inventario ADMIN | E2E registra entrada y comprueba saldo/ledger; cliente recibe acceso denegado |

Capturas del reporte real de pago: [móvil](evidence/sprint-1-current/payment-mobile.png),
[tablet](evidence/sprint-1-current/payment-tablet.png),
[escritorio](evidence/sprint-1-current/payment-desktop.png).

## Límites de la ampliación

Se reutilizó el inventario local existente. Se implementaron únicamente las
dependencias necesarias para comprar: selección de variantes/carrito, autenticación
tardía, cotización, modelos de promoción, entradas de inventario y consulta de pedido.
No se declara completo el CRUD de promociones, ajustes de inventario, tarifa especial,
cancelación/restitución, confirmación de pago, scheduler, STAGING ni sprints 2-7.
Los pagos comienzan Pendiente y pueden pasar a Reportado mediante el nuevo paso
mínimo; nunca se simula una confirmación financiera.

## Índice de evidencia

Las referencias AUTH, AUTH-UI, API-UI, PROFILE, PROFILE-UI, TAX, TAX-UI, CFG, WA,
E2E, INFRA, ARQ, DEMO y GUION conservan los archivos descritos en el
[índice de la auditoría base](sprint-1-audit.md#evidencia-ejecutable), con los resultados
actualizados de este informe.

- ORDER: [test_orders.py](../backend/tests/test_orders.py),
  [servicios](../backend/apps/orders/services.py) y [modelos](../backend/apps/orders/models.py).
- ORDER-UI: [E2E checkout/pedido/inventario](../frontend/e2e/sprint1-orders.spec.ts),
  [checkout](../frontend/src/features/orders/purchase.tsx), rutas /pedidos y /admin/inventario.
- Capturas: [checkout móvil](evidence/sprint-1-current/checkout-mobile.png),
  [pedido móvil](evidence/sprint-1-current/order-mobile.png),
  [inventario móvil](evidence/sprint-1-current/inventory-mobile.png),
  [checkout escritorio](evidence/sprint-1-current/checkout-desktop.png),
  [demo real](evidence/sprint-1-current/demo-checkout-1440.png).
- Snapshot de esta consulta: [jira-expanded-audit.json](evidence/sprint-1-current/jira-expanded-audit.json).
  Las rutas locales indicadas en Jira no son enlaces públicos.

## Matriz de 96 actividades

Verificada = implementación/prueba local evidenciada; Pendiente = no acreditada.
Se conserva el texto literal de cada actividad de Jira.

| Jira | Actividad | Descripción | Estado técnico | Evidencia |
| --- | --- | --- | --- | --- |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A1 | Definir addresses relacionada con users y sus validaciones. | Verificada | PROFILE |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A2 | Implementar GET/PATCH /users/me/ y CRUD /users/me/addresses/. | Verificada | PROFILE, E2E |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A3 | Restringir consultas y modificaciones al propietario. | Verificada | PROFILE |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A4 | Preservar los snapshots de direcciones que ya pertenezcan a pedidos. | Verificada | PROFILE, ORDER, ORDER-UI |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A1 | Definir usuario, correo único y migración PostgreSQL. | Verificada | AUTH |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A2 | Implementar POST /api/v1/auth/register/ con validación de campos y hash de contraseña. | Verificada | AUTH |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A3 | Impedir que el registro público asigne el rol ADMIN. | Verificada | AUTH |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A4 | Devolver creación, duplicado y validación con respuestas coherentes. | Verificada | AUTH |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A1 | Diseñar los campos y mensajes de registro en móvil y escritorio. | Verificada | AUTH-UI, E2E |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A2 | Integrar el formulario con la API y conservar datos corregibles ante error. | Verificada | AUTH-UI, E2E |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A3 | Mostrar carga, éxito y errores sin exponer detalles internos. | Verificada | AUTH-UI |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A4 | Permitir navegar entre registro e inicio de sesión. | Verificada | AUTH-UI, E2E |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A1 | Comprobar registro válido y persistencia del usuario. | Verificada | AUTH |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A2 | Rechazar correo duplicado, datos inválidos y escalamiento de rol. | Verificada | AUTH |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A3 | Verificar formulario y errores en navegador. | Verificada | AUTH-UI, E2E |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A4 | Vincular pruebas, PR y evidencia a la historia. | Pendiente | Pendiente: PR publicada y vinculación |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A1 | Implementar login, refresh y logout según el contrato vigente. | Verificada | AUTH |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A2 | Proteger tokens sensibles mediante cookies HttpOnly/Secure y controles CSRF/SameSite. | Verificada | AUTH |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A3 | Validar permisos en Django y revocar el acceso según la estrategia de sesión. | Verificada | AUTH |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A4 | Gestionar credenciales inválidas y sesiones vencidas. | Verificada | AUTH |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A1 | Integrar pantalla de login y acción de logout. | Verificada | AUTH-UI, E2E |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A2 | Presentar sesión vigente y navegación según el rol. | Verificada | AUTH-UI, E2E |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A3 | Gestionar vencimiento, renovación y errores de autenticación. | Verificada | AUTH, API-UI |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A4 | Mantener formularios accesibles y responsive. | Verificada | AUTH-UI, E2E |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A1 | Comprobar login válido, credenciales inválidas y persistencia de sesión. | Verificada | AUTH, E2E |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A2 | Verificar refresh y acceso protegido después de logout. | Verificada | AUTH, API-UI |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A3 | Comprobar denegación de endpoints admin a clientes. | Verificada | AUTH, E2E |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A4 | Registrar pruebas API, navegador y evidencia de seguridad. | Verificada | AUTH, E2E |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A1 | Diseñar vistas de perfil, listado y formulario de direcciones. | Verificada | PROFILE-UI, DEMO |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A2 | Integrar creación, edición y eliminación con confirmación. | Verificada | PROFILE-UI, E2E |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A3 | Mostrar errores de campo y estados sin direcciones. | Verificada | PROFILE-UI |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A4 | Reflejar cambios guardados al seleccionar dirección en checkout. | Verificada | PROFILE, ORDER, ORDER-UI |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A1 | Probar actualización y persistencia del perfil. | Verificada | PROFILE, E2E |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A2 | Probar alta, edición y eliminación de dirección. | Verificada | PROFILE, E2E |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A3 | Denegar acceso o modificación de direcciones ajenas. | Verificada | PROFILE |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A4 | Verificar datos inválidos y conservación del snapshot cuando exista el pedido. | Verificada | PROFILE, ORDER, ORDER-UI |
| [CO-118](https://cypher-oz.atlassian.net/browse/CO-118) | HU-11-T01-A1 | Implementar POST /checkout/preview/ para el cliente autenticado. | Verificada | ORDER, ORDER-UI |
| [CO-118](https://cypher-oz.atlassian.net/browse/CO-118) | HU-11-T01-A2 | Validar propiedad de dirección y modalidad de entrega. | Verificada | ORDER, ORDER-UI |
| [CO-118](https://cypher-oz.atlassian.net/browse/CO-118) | HU-11-T01-A3 | Calcular precios, promociones, cantidades y envío con decimales seguros. | Verificada | ORDER, ORDER-UI |
| [CO-118](https://cypher-oz.atlassian.net/browse/CO-118) | HU-11-T01-A4 | Impedir total definitivo si falta resolver la tarifa especial. | Verificada | ORDER, ORDER-UI |
| [CO-119](https://cypher-oz.atlassian.net/browse/CO-119) | HU-11-T02-A1 | Integrar dirección, modalidad y resumen de compra. | Verificada | ORDER, ORDER-UI |
| [CO-119](https://cypher-oz.atlassian.net/browse/CO-119) | HU-11-T02-A2 | Mostrar desglose COP calculado por backend. | Verificada | ORDER, ORDER-UI |
| [CO-119](https://cypher-oz.atlassian.net/browse/CO-119) | HU-11-T02-A3 | Permitir corregir datos y aceptar cambios del total. | Verificada | ORDER, ORDER-UI |
| [CO-119](https://cypher-oz.atlassian.net/browse/CO-119) | HU-11-T02-A4 | Separar revisión y confirmación del pedido con feedback claro. | Verificada | ORDER, ORDER-UI |
| [CO-120](https://cypher-oz.atlassian.net/browse/CO-120) | HU-11-T03-A1 | Comprobar cálculos con y sin promoción y envío gratuito. | Verificada | ORDER, ORDER-UI |
| [CO-120](https://cypher-oz.atlassian.net/browse/CO-120) | HU-11-T03-A2 | Rechazar dirección ajena, cantidades inválidas y precios manipulados. | Verificada | ORDER, ORDER-UI |
| [CO-120](https://cypher-oz.atlassian.net/browse/CO-120) | HU-11-T03-A3 | Verificar revisión ante cambio de precio o promoción vencida. | Verificada | ORDER, ORDER-UI |
| [CO-120](https://cypher-oz.atlassian.net/browse/CO-120) | HU-11-T03-A4 | Probar zona especial sin tarifa y ausencia de pedido durante preview. | Verificada | ORDER, ORDER-UI |
| [CO-121](https://cypher-oz.atlassian.net/browse/CO-121) | HU-12-T01-A1 | Definir orders, order_items, payment e historiales con constraints. | Verificada | ORDER, ORDER-UI |
| [CO-121](https://cypher-oz.atlassian.net/browse/CO-121) | HU-12-T01-A2 | Implementar POST /orders/ e Idempotency-Key. | Verificada | ORDER, ORDER-UI |
| [CO-121](https://cypher-oz.atlassian.net/browse/CO-121) | HU-12-T01-A3 | Bloquear balances en PostgreSQL, revalidar, descontar stock y registrar SALE en la misma transacción. | Verificada | ORDER, ORDER-UI |
| [CO-121](https://cypher-oz.atlassian.net/browse/CO-121) | HU-12-T01-A4 | Persistir snapshots comerciales y de entrega, PENDING/PENDING y report_deadline_at. | Verificada | ORDER, ORDER-UI |
| [CO-122](https://cypher-oz.atlassian.net/browse/CO-122) | HU-12-T02-A1 | Enviar confirmación con clave de idempotencia estable para reintentos. | Verificada | ORDER, ORDER-UI |
| [CO-122](https://cypher-oz.atlassian.net/browse/CO-122) | HU-12-T02-A2 | Mostrar número, productos, total y estados separados de pedido y pago. | Verificada | ORDER, ORDER-UI |
| [CO-122](https://cypher-oz.atlassian.net/browse/CO-122) | HU-12-T02-A3 | Permitir acceso a instrucciones de pago y pedido propio. | Verificada | ORDER, ORDER-UI |
| [CO-122](https://cypher-oz.atlassian.net/browse/CO-122) | HU-12-T02-A4 | Manejar conflicto de stock, red y doble clic sin duplicar pedidos. | Verificada | ORDER, ORDER-UI |
| [CO-123](https://cypher-oz.atlassian.net/browse/CO-123) | HU-12-T03-A1 | CP-ORDER-CONC-001: dos clientes compran última unidad, solo uno obtiene pedido. | Verificada | ORDER, ORDER-UI |
| [CO-123](https://cypher-oz.atlassian.net/browse/CO-123) | HU-12-T03-A2 | CP-ORDER-IDEM-001: misma clave genera un único pedido. | Verificada | ORDER, ORDER-UI |
| [CO-123](https://cypher-oz.atlassian.net/browse/CO-123) | HU-12-T03-A3 | CP-ROLLBACK-001: fallo intermedio revierte pedido, stock y movimiento. | Verificada | ORDER, ORDER-UI |
| [CO-123](https://cypher-oz.atlassian.net/browse/CO-123) | HU-12-T03-A4 | CP-HIST-001: editar catálogo, SKU, precio y dirección no cambia snapshots; criterio trasladado de CO-68. | Verificada | ORDER, ORDER-UI |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A1 | Definir modelos, slugs únicos y relaciones protegidas. | Verificada | TAX |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A2 | Implementar endpoints administrativos con validación y permisos ADMIN. | Verificada | TAX |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A3 | Aplicar política de actividad y visibilidad del catálogo. | Verificada | TAX |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A4 | Registrar cambios relevantes y respuestas de conflicto. | Verificada | TAX |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A1 | Crear listados y formularios de alta y edición. | Verificada | TAX-UI, E2E |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A2 | Integrar activación y desactivación según política vigente. | Verificada | TAX-UI, E2E |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A3 | Mostrar errores conservando la información del formulario. | Verificada | TAX-UI |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A4 | Incorporar paginación, carga, vacío y responsive. | Verificada | TAX-UI, DEMO |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A1 | Probar creación, edición y valores duplicados. | Verificada | TAX, E2E |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A2 | Verificar permisos y protección de relaciones existentes. | Verificada | TAX |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A3 | Comprobar política de visibilidad por categoría y marca. | Verificada | TAX |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A4 | Registrar pruebas API, PostgreSQL y navegador del alcance previsto. | Verificada | TAX, E2E |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A1 | Leer habilitación, número y mensaje desde configuración vigente. | Verificada | CFG |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A2 | Validar configuración sin inventar número comercial. | Verificada | CFG |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A3 | Exponer únicamente los datos públicos necesarios para abrir el enlace. | Verificada | CFG |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A4 | Mantener canal operativo deshabilitado hasta contar con número autorizado. | Verificada | CFG (default deshabilitado; demo puede modificarse) |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A1 | Crear botón visible cuando el canal esté habilitado. | Verificada | WA |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A2 | Formar enlace y texto codificados correctamente. | Verificada | WA |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A3 | Abrir WhatsApp solo tras acción del usuario. | Verificada | WA |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A4 | Evitar superponer controles en móvil y ofrecer etiqueta accesible. | Verificada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A1 | Probar canal habilitado con configuración controlada y canal deshabilitado. | Verificada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A2 | Verificar destino y mensaje del enlace. | Verificada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A3 | Revisar accesibilidad y responsive sin superposición. | Verificada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A4 | Registrar que las pruebas no equivalen a habilitación comercial ni envío automático. | Verificada | GUION (no envío real ni autorización comercial) |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A1 | Crear estructura frontend, backend, docs y configuración CI. | Verificada | INFRA |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A2 | Conectar Django/DRF con PostgreSQL y migraciones. | Verificada | INFRA, CFG |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A3 | Iniciar Next.js y consumir health del backend. | Verificada | CFG, DEMO |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A4 | Documentar variables sin secretos y ejecución reproducible. | Verificada | INFRA |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A1 | Crear store_settings con claves únicas y validación de tipos. | Verificada | CFG |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A2 | Implementar lectura central y administración protegida de parámetros. | Verificada | CFG |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A3 | Definir defaults de referencia para T1, T2, tarifa, umbral y TTL sin tratarlos como política inmutable. | Verificada | CFG, E2E |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A4 | Documentar que los módulos futuros persisten deadlines y snapshots por operación. | Verificada | ARQ, ORDER (snapshots y T1/T2 implementados y probados) |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A1 | Ejecutar pruebas base con PostgreSQL y health integrado. | Verificada | CFG |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A2 | Configurar lint, typecheck y build reproducibles. | Verificada | INFRA (checks de la ejecución anterior) |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A3 | Verificar secretos fuera del repositorio y entornos separados. | Verificada | INFRA (separación de entornos; no auditoría exhaustiva de secretos) |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A4 | Vincular README, arquitectura, PR y CI registrados como cierre del enabler. | Pendiente | Pendiente: PR y CI remota de estos cambios |
