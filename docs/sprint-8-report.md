# Sprint 8 — Verificación para entrega académica

Fecha: 09/11/2026. Presentación prevista: 10/11/2026.
Alcance: aplicación completa, incremento de confianza/reseñas y expediente de
evidencias. La aprobación del profesor y la revisión del responsable de producto
se registran cuando ocurran; las pruebas automáticas no sustituyen esa aceptación.

## Correcciones de esta entrega

- Corregido lint/formato del HTML de verificación y recuperación de contraseña.
- Las configuraciones `test` y `e2e` desactivan Brevo y usan correo en memoria,
  aunque el `.env` local contenga una clave activa. Las pruebas específicas de
  transporte Brevo lo habilitan expresamente y simulan la respuesta HTTP.
- El botón Reintentar vuelve a consultar reseñas. El formulario conserva el texto
  ante errores, asocia mensajes al campo, muestra contador de 1.000 caracteres y
  confirma el guardado. La edición se comprueba mediante Tab y Enter.
- Añadidas pruebas de concurrencia PostgreSQL para reseña única, reporte activo
  único y moderación idempotente; casos negativos, privacidad, redondeo, variantes,
  paginación estable y protección de campos internos.
- La CI incluye los artefactos de Sprint 8. Se conserva evidencia histórica
  separada de los resultados actuales.
- La demo usa cuentas y base locales, envía correo a consola y comprueba errores
  al detener procesos. Su guía está en [Presentación](presentacion-2026-11-10.md).

## Resultados registrados

La [CI 159](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/42648321822)
terminó **aprobada** para el commit de código `98b1a535`: **423 backend, 143 frontend,
66 E2E y 28 wireframes**, además de lint, migraciones, tipos, build y almacenamiento
aislado. [Registro resumido](evidence/sprint-8/ci-159.json). Los commits posteriores
a `98b1a535` actualizan únicamente documentación/evidencias; no se atribuye a CI 159
un SHA distinto. El [PR #24](https://github.com/AndersonOjeda/Cypher-Oz/pull/24)
quedó **integrado en main**, por autorización de Anderson, en
`e91f29ed5bad70b4cbaa1cc6e8a523b8fb049b86`. La [CI 165](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/42650806499)
también aprobó el head final del PR `05b9f59`. Frontend Vercel READY y API Render Live
se verificaron en el commit de integración. [Registro de publicación](evidence/sprint-8/publication-2026-11-09.json).

Render no generó eventos ni un deploy automático después del merge, pese a mostrar
auto deploy activo; se comprobó que no había despliegues pendientes y se disparó
una sola publicación del commit aprobado. Terminó Live en
`dep-dbovbahsrm7s73d78tgg`. El [smoke posterior al merge](evidence/sprint-8/post-merge-cloud-smoke-2026-11-09.json)
aprobó 8/8 HTTP; el SQL directo remoto sigue sin comprobarse.
La [comprobación pública de seguridad](evidence/sprint-8/security-smoke-2026-11-09.json)
también pasó: CSRF Secure/HttpOnly, HSTS, nosniff, DENY y ausencia de página DEBUG.

Las plantillas de correo se renderizaron con enlaces inertes de ejemplo y se
revisaron visualmente en móvil, sin desbordamiento: [verificación](evidence/sprint-8/email-verification-mobile.png)
y [recuperación](evidence/sprint-8/email-reset-mobile.png). Estas capturas no acreditan
recepción real ni compatibilidad visual en todos los clientes de correo.

| Verificación | Resultado y evidencia |
|---|---|
| Backend completo PostgreSQL | 403 aprobadas; [JUnit](evidence/sprint-8/backend-2026-11-09.xml). Se ejecutó antes de ampliar los casos de reseñas. Advertencia de caché pytest sin efecto en los resultados. |
| Frontend | 143 aprobadas; [JUnit vigente](evidence/sprint-8/frontend-2026-11-09.xml); incluye reintento y contenido HTML mostrado como texto inerte. |
| Reseñas PostgreSQL ampliadas | 24 aprobadas; [JUnit focalizado](evidence/sprint-8/reviews-postgres-2026-11-09.xml). Se solapa con la suite general: no sumar sus cifras. |
| E2E integral | 66 comprobaciones aprobadas, 0 fallidas; [JUnit](evidence/sprint-8/e2e-2026-11-09.xml). Windows bloqueó el cierre de servidores: se cerraron únicamente sus árboles de procesos identificados; el comando inicial terminó con salida 1 por limpieza. |
| E2E final de Sprint 8 | 3 aprobadas en móvil/tablet/escritorio, salida explícita 0; [JUnit](evidence/sprint-8/e2e-sprint8-2026-11-09.xml). Incluye edición por teclado, publicación, reporte, ocultación y restauración. |
| Lint, tipos y build | Ruff y formato backend, ESLint, TypeScript y build Next.js aprobados. `makemigrations --check --dry-run`: sin cambios. |
| Smoke remoto | 8/8 HTTP aprobados; [JSON](evidence/sprint-8/cloud-smoke-2026-11-09.json). El resultado global es INCOMPLETE porque no se solicitó SQL directo remoto. |
| Backup/restauración local | [JSON](evidence/sprint-8/local-recovery-2026-11-09.json): 36 tablas, 34 migraciones, 91 pedidos, 91 pagos y 3 reseñas. Restauración aislada; no cubre Render ni objetos de catálogo. |
| Comando de plazos en demo | [Dry-run](evidence/sprint-8/deadlines-dry-run-2026-11-09.json), sin fallos y sin candidatos. No acredita ejecución periódica remota. |
| Demo de presentación | [Smoke local](evidence/sprint-8/demo-smoke-2026-11-09.json): acceso ADMIN/CLIENT con sus roles, health, catálogo, producto y reseñas públicos aprobados. |
| Capturas | [Móvil](evidence/sprint-8/reviews-mobile.png), [tablet](evidence/sprint-8/reviews-tablet.png), [escritorio](evidence/sprint-8/reviews-desktop.png). Revisión visual de legibilidad y ausencia de desbordamiento, con datos sintéticos identificados. |

La [CI 149](https://github.com/AndersonOjeda/Cypher-Oz/actions/runs/41701949709),
commit `035a661`, se conserva como antecedente histórico; CI 159 valida las correcciones actuales.
Render informó el 09/11 que su API está Live en `61e8258`, desplegada el 04/11;
el smoke confirma disponibilidad HTTP, sin certificar por sí solo una compra real.

## Trazabilidad de casos

La [matriz RF-01–RF-51](requirements-traceability.md) contrasta el documento maestro
con las historias/épicas vigentes de Jira y sus superficies UI/API/persistencia/pruebas.
Se conserva explícita la diferencia entre los 16 sprints originales y la replanificación de ocho en Jira.

| Casos | Evidencia principal |
|---|---|
| CP-REV-01/02/03 | `test_verified_review_public_summary_and_private_fields`, elegibilidad negativa, límites de puntuación/comentario e inyección de campos; E2E de pedido entregado y pagado. |
| CP-REV-04/05 | Creación concurrente, autoría, edición de oculta; prueba UI de script como texto inerte; edición E2E por teclado. |
| CP-REV-06/07/08/09 | Promedios 3,7 → 4,0 → 4,5, vacío, privacidad, variantes y paginado; capturas y consulta pública. |
| CP-REV-10/11/12/13 | Reporte concurrente único, rechazo anónimo, permisos administrativos, motivo obligatorio, moderación auditada/idempotente y edición de oculta. |
| CP-CONF-01/02 | Producto/checkout en E2E y diferenciación Reportado/Confirmado; interfaz pública legible. |
| CP-CONF-03/04 | `test_configuration.py`: tarifa/umbral vigentes y canal deshabilitado; E2E de zona especial/garantía con datos sintéticos. Contenido comercial final requiere aprobación del responsable. |
| Casos críticos del MVP | `test_orders.py`, `test_inventory.py`, `test_order_expiration.py`, `test_auth.py`, `test_sprint_completion.py` y E2E de sprints anteriores: transacciones, última unidad, permisos, idempotencia, restitución, T1/T2 y flujo de entrega. |

## Jira y aceptación

Sprint 8 conserva su planificación sin fechas; no se reescribe su historial.
Anderson aceptó expresamente la entrega académica de HU-33 a HU-36 tras recibir
la versión publicada y sus evidencias. Las historias CO-184–CO-187 y la épica
CO-183 quedaron Listo. Registro: `academic-acceptance-2026-11-09.json`.
La aceptación del profesor es independiente y no se afirma realizada.

CO-45 quedó Listo por cierre de QA técnica de la entrega académica. Están Listo
las doce subtareas CO-188–CO-199: las once técnicas ya cerradas y CO-197,
cerrada tras la aprobación expresa del contenido de demo. CO-46 mantiene pendientes
scheduler y recuperación remotos. CO-47 conserva el cierre condicionado a CO-46
y aceptación final; se distingue la entrega académica de la operación real.

CO-200 dispone de integración y pruebas simuladas. La revisión de Brevo encontró
un remitente activo y ningún dominio propio autenticado en la cuenta conectada.
El 09/11 se enviaron las dos pruebas autorizadas al Gmail principal configurado
y se confirmó recepción en INBOX: recuperación desde la API publicada (18:50:11 UTC)
y plantilla de verificación desde la función actual del backend (18:50:59 UTC),
esta última con enlace inerte. Ambas incluyen MIME multipart/alternative, texto
y HTML. El reenvío público de verificación respondió 200, pero no produjo correo
nuevo; no se afirma una nueva prueba completa de alta y activación. No se cambió
contraseña ni se almacenaron tokens válidos. Registro: `email-requests-2026-11-09.json`.
El 10/11 se revocó la clave Onboarding de Resend con autorización expresa y se
verificó que la cuenta ya no tiene claves. Esto no acredita rotación de otros
proveedores ni autenticación de un dominio propio en Brevo.

Tras registrar la aceptación académica quedan tres issues abiertos: CO-46,
CO-47 y CO-200. No se declara el proyecto al 100% mientras falten sus criterios
de cierre. Anderson aprobó la demo sin cobros reales, envío urbano COP 5.000,
gratis desde COP 100.000, zonas especiales por cotizar y garantía según ficha.
Pago real y WhatsApp siguen sin configurar y su indisponibilidad se informa.
Se acepta esa limitación para la demo. Aprobación registrada en
`demo-approval-2026-11-09.json` y en CO-197/CO-187.

## Decisión de alcance del usuario

Últimas actividades del 10/11: ejecutor `scripts/run_demo_scheduler.py` para T1/T2
en la base local de demo, dry-run aprobado con salida 0 y sin candidatos/fallos.
Ruff/formato aprobados. No se afirma scheduler remoto activo. Guía final:
[cierre del MVP](mvp-final-checklist.md). Evidencia:
`mvp-final-activities-2026-11-10.json`.

Anderson indicó el 09/11 que presenta mañana y que no necesita extender ni comprar
servicios. No se realizaron compras, cambios de plan ni se activó un cron de pago.
Render confirmó PostgreSQL Free disponible y vencimiento **13/11/2026**. La demo
local permite presentar sin depender de su continuidad. Esta decisión no convierte
el respaldo local en respaldo remoto ni certifica operación comercial permanente.

La plantilla independiente `my-extension` se creó con Docker Extension Init y su
UI compiló. No está instalada/publicada ni conectada a la tienda. Su dependencia
de desarrollo Vite/Jest trae avisos que requieren modernización antes de usarla
como producto; no afecta los paquetes de la aplicación TTI.
