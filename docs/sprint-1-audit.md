# Auditoría del Sprint 1 activo

> Registro histórico ANTERIOR a la ampliación autorizada el 06/10/2026.
> El estado vigente, con checkout y pedidos adelantados, está en
> [Sprint 1 ampliado](sprint-1-expanded.md). No usar el conteo 67/72 como estado actual.

Fecha: 6 de octubre de 2026, America/Bogota. Fuente consultada directamente:
[tablero CO](https://cypher-oz.atlassian.net/jira/software/projects/CO/boards/2/backlog),
sprint **71**, no los sprints históricos 1/2/3.

## Dictamen

**No se cumplen todavía todas las historias y actividades para cerrar el sprint.**
Hay funcionalidad real de registro, sesión, perfil/direcciones, categorías/marcas,
configuración y enlace WhatsApp, con pruebas locales. Eso no elimina los pendientes
de integración, publicación y aceptación.

- Sprint 71: ACTIVO. Objetivo y alcance conservados: 5 HU + EN-01, 27 SP.
- 10 elementos principales: 9 En curso, CO-28 Por hacer, 0 Listo.
- 18 subtareas En curso: **67 actividades marcadas de 72 (93,1%)**.
- El 93,1% es conteo de casillas de subtareas, NO porcentaje de aceptación del sprint.
- CO-28/29/31/73 son apoyos adicionales; sus criterios no están incluidos en esas 72.
- Las casillas de aceptación/DoD de las historias siguen abiertas en Jira. El apéndice
  de pruebas no equivale a aprobación del profesor ni a cierre de esas casillas.
- Fin configurado: **06/10/2026 00:00 -05:00**, ya pasado al consultar. Iniciar el
  sprint no ajustó las fechas. No se cambió su calendario ni se cerró el sprint.

La guía CO-28 se actualizó para dejar de afirmar que todos los sprints están sin
iniciar. No se movieron actividades a otros sprints ni se quitaron requisitos.

## Pendientes que impiden afirmar 100%

| Jira / actividad | Falta | Evidencia requerida para cerrar |
| --- | --- | --- |
| CO-178 / EN-01-T03-A4 | PR y CI de la entrega actual | URL de PR y ejecución verde del commit exacto; README/arquitectura vinculados |
| CO-91 / HU-01-T03-A4 | PR y evidencias publicadas | PR y reportes de registro vinculados a CO-36 |
| CO-95 / HU-03-T02-A4 | Selección real de dirección en checkout | E2E que cambie una dirección y compruebe el checkout guardado |
| CO-88 / HU-03-T01-A4 | Preservación de snapshot de dirección del pedido | Crear pedido, editar/borrar dirección y comprobar snapshot inmutable |
| CO-96 / HU-03-T03-A4 | Prueba de snapshot cuando exista pedido | Prueba PostgreSQL/API de conservación; los datos inválidos sí se probaron |

**Inconsistencia de planificación:** Jira prevé checkout en Sprint 4 (74) y pedidos
en Sprint 5 (75), pero incluye estas tres comprobaciones en Sprint 1. Documentar
esa dependencia no equivale a cumplirla. Se necesita acordar formalmente la secuencia
sin esconder el pendiente, o implementar esas dependencias antes del cierre.

EN-01 tiene además un criterio sobre cambios de T1/T2/envío/TTL que afectan
operaciones futuras: hoy se acredita administración/persistencia/configuración
central, no deadlines de pagos ni cotizaciones de pedidos aún inexistentes.

## Evidencia ejecutable

| Referencia | Archivos y comprobaciones |
| --- | --- |
| AUTH | [test_auth.py](../backend/tests/test_auth.py): registro con hash/CLIENT, duplicado case-insensitive, inválidos, cookies/CSRF, refresh, expiración, logout/replay, rol y concurrencia |
| AUTH-UI | [auth-form.test.tsx](../frontend/src/features/auth/auth-form.test.tsx), [account.test.tsx](../frontend/src/features/auth/account.test.tsx), [sprint1.spec.ts](../frontend/e2e/sprint1.spec.ts) |
| API-UI | [api.test.ts](../frontend/src/services/api.test.ts): renovación y errores del cliente API |
| PROFILE | [test_profile.py](../backend/tests/test_profile.py) y test_auth.py: validaciones, propietario, CRUD, default atómico, rollback y concurrencia |
| PROFILE-UI | [account.tsx](../frontend/src/features/auth/account.tsx), account.test.tsx y sprint1-current.spec.ts |
| TAX | [test_catalog.py](../backend/tests/test_catalog.py) y [test_public_taxonomy.py](../backend/tests/test_public_taxonomy.py): CRUD, auditoría, permisos, PROTECT, duplicados, visibilidad y paginación |
| TAX-UI | [taxonomy-manager.test.tsx](../frontend/src/features/catalog/taxonomy-manager.test.tsx), [taxonomy-manager.tsx](../frontend/src/features/catalog/taxonomy-manager.tsx), sprint1-current.spec.ts |
| CFG | [test_configuration.py](../backend/tests/test_configuration.py), [views.py](../backend/apps/configuration/views.py), [models.py](../backend/apps/configuration/models.py): health PostgreSQL, configuración pública mínima, permisos, validación, persistencia y auditoría |
| WA | [whatsapp-button.test.tsx](../frontend/src/components/whatsapp-button.test.tsx), [whatsapp-button.tsx](../frontend/src/components/whatsapp-button.tsx), sprint1.spec.ts |
| E2E | [sprint1-current.spec.ts](../frontend/e2e/sprint1-current.spec.ts), sprint1.spec.ts: 18 escenarios Sprint 1, seis flujos x móvil/tablet/escritorio; otros 12 son regresión histórica |
| INFRA | [README](../README.md), [CI](../.github/workflows/ci.yml), [inicio demo](../scripts/start-sprint1.ps1); tener workflow no demuestra ejecución remota de cambios sin publicar |
| ARQ | [Arquitectura y contratos](architecture-current.md); separa entidades actuales de contratos futuros |
| DEMO | [Revisión real en navegador](../frontend/scripts/verify-sprint1-demo.mjs), [captura móvil](evidence/sprint-1-current/account-390.png), [captura escritorio](evidence/sprint-1-current/account-1440.png) |
| GUION | [Guion de 16 pasos](sprint-1-current.md) para demostrar cada historia al profesor |

Los reportes de esta auditoría quedan en [backend-junit.xml](evidence/sprint-1-current/backend-junit.xml),
[frontend-junit.xml](evidence/sprint-1-current/frontend-junit.xml) y
[e2e-junit.xml](evidence/sprint-1-current/e2e-junit.xml). El
[informe visual Playwright](../frontend/playwright-report/index.html) permite
consultar casos, tiempos y tamaños. Las rutas son locales, no publicaciones accesibles desde Jira.

## Matriz de las 72 actividades

“Marcada” reproduce la casilla actual en Jira; la columna de evidencia permite
inspeccionar código/pruebas y sus límites. No afirma aceptación independiente
del docente ni cobertura exhaustiva de toda accesibilidad o seguridad.

| Jira | Actividad literal | Casilla Jira | Evidencia / límite |
| --- | --- | --- | --- |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A1: Definir addresses relacionada con users y sus validaciones. | Marcada | PROFILE |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A2: Implementar GET/PATCH /users/me/ y CRUD /users/me/addresses/. | Marcada | PROFILE, E2E |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A3: Restringir consultas y modificaciones al propietario. | Marcada | PROFILE |
| [CO-88](https://cypher-oz.atlassian.net/browse/CO-88) | HU-03-T01-A4: Preservar los snapshots de direcciones que ya pertenezcan a pedidos. | Pendiente | Pendiente: pedidos/snapshots no implementados; ARQ es diseño |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A1: Definir usuario, correo único y migración PostgreSQL. | Marcada | AUTH |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A2: Implementar POST /api/v1/auth/register/ con validación de campos y hash de contraseña. | Marcada | AUTH |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A3: Impedir que el registro público asigne el rol ADMIN. | Marcada | AUTH |
| [CO-89](https://cypher-oz.atlassian.net/browse/CO-89) | HU-01-T01-A4: Devolver creación, duplicado y validación con respuestas coherentes. | Marcada | AUTH |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A1: Diseñar los campos y mensajes de registro en móvil y escritorio. | Marcada | AUTH-UI, E2E |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A2: Integrar el formulario con la API y conservar datos corregibles ante error. | Marcada | AUTH-UI, E2E |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A3: Mostrar carga, éxito y errores sin exponer detalles internos. | Marcada | AUTH-UI |
| [CO-90](https://cypher-oz.atlassian.net/browse/CO-90) | HU-01-T02-A4: Permitir navegar entre registro e inicio de sesión. | Marcada | AUTH-UI, E2E |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A1: Comprobar registro válido y persistencia del usuario. | Marcada | AUTH |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A2: Rechazar correo duplicado, datos inválidos y escalamiento de rol. | Marcada | AUTH |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A3: Verificar formulario y errores en navegador. | Marcada | AUTH-UI, E2E |
| [CO-91](https://cypher-oz.atlassian.net/browse/CO-91) | HU-01-T03-A4: Vincular pruebas, PR y evidencia a la historia. | Pendiente | Pendiente: PR publicada y vinculación |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A1: Implementar login, refresh y logout según el contrato vigente. | Marcada | AUTH |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A2: Proteger tokens sensibles mediante cookies HttpOnly/Secure y controles CSRF/SameSite. | Marcada | AUTH |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A3: Validar permisos en Django y revocar el acceso según la estrategia de sesión. | Marcada | AUTH |
| [CO-92](https://cypher-oz.atlassian.net/browse/CO-92) | HU-02-T01-A4: Gestionar credenciales inválidas y sesiones vencidas. | Marcada | AUTH |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A1: Integrar pantalla de login y acción de logout. | Marcada | AUTH-UI, E2E |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A2: Presentar sesión vigente y navegación según el rol. | Marcada | AUTH-UI, E2E |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A3: Gestionar vencimiento, renovación y errores de autenticación. | Marcada | AUTH, API-UI |
| [CO-93](https://cypher-oz.atlassian.net/browse/CO-93) | HU-02-T02-A4: Mantener formularios accesibles y responsive. | Marcada | AUTH-UI, E2E |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A1: Comprobar login válido, credenciales inválidas y persistencia de sesión. | Marcada | AUTH, E2E |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A2: Verificar refresh y acceso protegido después de logout. | Marcada | AUTH, API-UI |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A3: Comprobar denegación de endpoints admin a clientes. | Marcada | AUTH, E2E |
| [CO-94](https://cypher-oz.atlassian.net/browse/CO-94) | HU-02-T03-A4: Registrar pruebas API, navegador y evidencia de seguridad. | Marcada | AUTH, E2E |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A1: Diseñar vistas de perfil, listado y formulario de direcciones. | Marcada | PROFILE-UI, DEMO |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A2: Integrar creación, edición y eliminación con confirmación. | Marcada | PROFILE-UI, E2E |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A3: Mostrar errores de campo y estados sin direcciones. | Marcada | PROFILE-UI |
| [CO-95](https://cypher-oz.atlassian.net/browse/CO-95) | HU-03-T02-A4: Reflejar cambios guardados al seleccionar dirección en checkout. | Pendiente | Pendiente: no existe selección real de dirección en checkout |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A1: Probar actualización y persistencia del perfil. | Marcada | PROFILE, E2E |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A2: Probar alta, edición y eliminación de dirección. | Marcada | PROFILE, E2E |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A3: Denegar acceso o modificación de direcciones ajenas. | Marcada | PROFILE |
| [CO-96](https://cypher-oz.atlassian.net/browse/CO-96) | HU-03-T03-A4: Verificar datos inválidos y conservación del snapshot cuando exista el pedido. | Pendiente | Parcial: datos inválidos probados; falta snapshot de pedido |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A1: Definir modelos, slugs únicos y relaciones protegidas. | Marcada | TAX |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A2: Implementar endpoints administrativos con validación y permisos ADMIN. | Marcada | TAX |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A3: Aplicar política de actividad y visibilidad del catálogo. | Marcada | TAX |
| [CO-146](https://cypher-oz.atlassian.net/browse/CO-146) | HU-20-T01-A4: Registrar cambios relevantes y respuestas de conflicto. | Marcada | TAX |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A1: Crear listados y formularios de alta y edición. | Marcada | TAX-UI, E2E |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A2: Integrar activación y desactivación según política vigente. | Marcada | TAX-UI, E2E |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A3: Mostrar errores conservando la información del formulario. | Marcada | TAX-UI |
| [CO-147](https://cypher-oz.atlassian.net/browse/CO-147) | HU-20-T02-A4: Incorporar paginación, carga, vacío y responsive. | Marcada | TAX-UI, DEMO |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A1: Probar creación, edición y valores duplicados. | Marcada | TAX, E2E |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A2: Verificar permisos y protección de relaciones existentes. | Marcada | TAX |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A3: Comprobar política de visibilidad por categoría y marca. | Marcada | TAX |
| [CO-148](https://cypher-oz.atlassian.net/browse/CO-148) | HU-20-T03-A4: Registrar pruebas API, PostgreSQL y navegador del alcance previsto. | Marcada | TAX, E2E |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A1: Leer habilitación, número y mensaje desde configuración vigente. | Marcada | CFG |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A2: Validar configuración sin inventar número comercial. | Marcada | CFG |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A3: Exponer únicamente los datos públicos necesarios para abrir el enlace. | Marcada | CFG |
| [CO-170](https://cypher-oz.atlassian.net/browse/CO-170) | HU-30-T01-A4: Mantener canal operativo deshabilitado hasta contar con número autorizado. | Marcada | CFG (default deshabilitado; demo puede modificarse) |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A1: Crear botón visible cuando el canal esté habilitado. | Marcada | WA |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A2: Formar enlace y texto codificados correctamente. | Marcada | WA |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A3: Abrir WhatsApp solo tras acción del usuario. | Marcada | WA |
| [CO-171](https://cypher-oz.atlassian.net/browse/CO-171) | HU-30-T02-A4: Evitar superponer controles en móvil y ofrecer etiqueta accesible. | Marcada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A1: Probar canal habilitado con configuración controlada y canal deshabilitado. | Marcada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A2: Verificar destino y mensaje del enlace. | Marcada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A3: Revisar accesibilidad y responsive sin superposición. | Marcada | WA, E2E |
| [CO-172](https://cypher-oz.atlassian.net/browse/CO-172) | HU-30-T03-A4: Registrar que las pruebas no equivalen a habilitación comercial ni envío automático. | Marcada | GUION (no envío real ni autorización comercial) |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A1: Crear estructura frontend, backend, docs y configuración CI. | Marcada | INFRA |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A2: Conectar Django/DRF con PostgreSQL y migraciones. | Marcada | INFRA, CFG |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A3: Iniciar Next.js y consumir health del backend. | Marcada | CFG, DEMO |
| [CO-176](https://cypher-oz.atlassian.net/browse/CO-176) | EN-01-T01-A4: Documentar variables sin secretos y ejecución reproducible. | Marcada | INFRA |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A1: Crear store_settings con claves únicas y validación de tipos. | Marcada | CFG |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A2: Implementar lectura central y administración protegida de parámetros. | Marcada | CFG |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A3: Definir defaults de referencia para T1, T2, tarifa, umbral y TTL sin tratarlos como política inmutable. | Marcada | CFG, E2E |
| [CO-177](https://cypher-oz.atlassian.net/browse/CO-177) | EN-01-T02-A4: Documentar que los módulos futuros persisten deadlines y snapshots por operación. | Marcada | ARQ (contrato futuro, no pedido implementado) |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A1: Ejecutar pruebas base con PostgreSQL y health integrado. | Marcada | CFG |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A2: Configurar lint, typecheck y build reproducibles. | Marcada | INFRA (checks de la ejecución anterior) |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A3: Verificar secretos fuera del repositorio y entornos separados. | Marcada | INFRA (separación de entornos; no auditoría exhaustiva de secretos) |
| [CO-178](https://cypher-oz.atlassian.net/browse/CO-178) | EN-01-T03-A4: Vincular README, arquitectura, PR y CI registrados como cierre del enabler. | Pendiente | Pendiente: PR y CI remota de estos cambios |

## Apoyos adicionales del sprint

| Elemento | Evidencia disponible | Límite pendiente |
| --- | --- | --- |
| CO-28, guía | Plan de 7 sprints, alcance, orden y estado activo corregido en Jira | Sigue Por hacer; resolver formalmente dependencias cruzadas y aceptación |
| CO-29 A1-A4 | Arquitectura modular, entidades/relaciones, API/permisos, contratos e idempotencia en Jira y architecture-current.md | Casillas siguen abiertas para revisión; contratos futuros no son implementación |
| CO-31 A1-A3 | [28 wireframes](wireframes.html), [script de revisión](../frontend/scripts/verify-wireframes.mjs), capturas móvil/escritorio | Son prototipos, no checkout/pedidos funcionales |
| CO-31 A4 y criterios UX | Navegación, ausencia de overflow, recuperación de errores y pago Reportado comprobados en 390/1440 px | No hay informe exhaustivo de contraste/teclado/lector de pantalla ni aprobación de UX |
| CO-73, instalación | Entornos separados, migraciones en base vacía, health real PostgreSQL y pruebas | La revisión previa acredita instalación local, no despliegue/CI de la entrega publicada |

## Cómo presentar sin confundir avances

Abrir http://localhost:3002 y seguir el guion por historia. Mostrar después los
reportes y esta matriz. No presentar los wireframes como funcionalidad futura ya
desarrollada ni los sprints históricos del repositorio como cierre de los nuevos.

La demo conserva datos entre reinicios. Su configuración actual puede diferir de
los defaults: el smoke test compara UI con API y no los restablece. WhatsApp
habilitado en esa base no acredita número comercial autorizado; no se enviaron mensajes.

Antes de cerrar: resolver los cinco pendientes, revisar los criterios/DoD y los
apoyos, publicar evidencias asociadas al mismo código y registrar aceptación real.
No marcar Listo solamente porque las pruebas existentes pasan.
