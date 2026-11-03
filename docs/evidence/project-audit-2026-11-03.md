# Auditoría del proyecto y sprints Jira

Fecha: 2026-11-03\
Proyecto: Cypher Oz (`CO`) · Tablero Scrum: 2

## Filtro de vencidos del usuario

Consulta revisada: `assignee = currentUser() AND statusCategory != done AND due <= 2026-11-03 AND due >= 2026-10-27`.

- Antes de corregir épicas, devolvía solamente **CO-51 — EP-09 Gestión de inventario**, vencida el 2026-11-02 y en Por hacer.
- CO-51 contenía CO-65, CO-66 y CO-67; las tres historias y todas sus tareas estaban en Listo.
- Cerré CO-51 en Jira con estado Listo y registré el motivo. Después de sincronizar las épicas, el filtro devuelve **cero issues**.
- La búsqueda amplia del proyecto mostraba siete épicas Por hacer con fecha vencida. Las siete tenían todos sus issues hijos en Listo, así que sincronizarlas corrigió avisos administrativos obsoletos.

## Estado de las épicas

Las 13 épicas con todos sus hijos en Listo quedaron también en Listo: CO-22, CO-23, CO-24, CO-25, CO-26, CO-27, CO-48, CO-49, CO-50, CO-51, CO-52, CO-53 y CO-54. Se dejaron comentarios de auditoría en cada una. CO-183 sigue En curso porque HU-33 a HU-36 siguen abiertas.

## Estado de sprints del tablero 2

| Sprint | Estado Jira | Issues | Listo | Abiertos |
|---|---:|---:|---:|---:|
| Sprint 01 | Cerrado | 36 | 36 | 0 |
| Sprint 02 | Cerrado | 27 | 27 | 0 |
| Sprint 03 | Cerrado | 21 | 21 | 0 |
| Sprint 04 | Cerrado | 16 | 16 | 0 |
| Sprint 05 | Cerrado | 12 | 12 | 0 |
| Sprint 06 | Cerrado | 17 | 17 | 0 |
| Sprint 07 | Cerrado | 16 | 13 | 3 |
| Sprint 08 | Futuro | 16 | 0 | 16 |

Los Sprints 1–6 no tienen issues abiertos. Sprint 7 conserva en curso las tareas transversales **CO-45 QA**, **CO-46 OPS** y **CO-47 DOC**, con vencimiento 2026-11-16; no estaban vencidas al auditar el 2026-11-03. Sprint 8 no está iniciado y Jira aún no le asigna fechas; sus cuatro historias y doce subtareas están En curso tras la revisión de implementación.

Jira también contiene tres sprints históricos cerrados (IDs 1–3) sin issues asignados. Los metadatos de los Sprints 6 y 7 muestran `completeDate` anterior a `endDate`; no alteré esas fechas ni los estados históricos.

El calendario tiene otras inconsistencias: el Sprint 2 dura aproximadamente un día; los Sprints 2 y 3 se solapan; los Sprints 4, 5, 6 y 7 también comparten fechas de inicio. No reescribí el historial de fechas para evitar ocultar la planificación original. Sprint 8 permanece sin fechas.

## Trabajo pendiente real

- **CO-45:** cerrar regresión integral, concurrencia en PostgreSQL, E2E, responsive/accesibilidad y evidencias finales.
- **CO-46:** completar verificación operativa del scheduler, backups/restauración y servicios remotos.
- **CO-47:** consolidar relaciones PR/CI/evidencias y aceptación final.
- **Sprint 8 / CO-184–CO-199:** ejecutar validación PostgreSQL, E2E de punta a punta y capturas/responsive/teclado. La ejecución local anterior usó SQLite porque Docker/PostgreSQL no estaba disponible; pruebas focalizadas: 26 backend y 141 frontend aprobadas. La suite backend amplia no terminó por bloqueos de tablas de SQLite en dos pruebas concurrentes.

No hay issues vencidas hoy en la consulta JQL del usuario. No se cambiaron fechas para ocultar atrasos, no se cerraron los tres trabajos transversales pendientes y no se inició Sprint 8 porque su planificación de fechas sigue pendiente.

## Totales

De 175 issues del proyecto (161 no-epicas y 14 epicas), quedan 155 en Listo y 20 abiertos: tres tareas transversales del Sprint 7, dieciseis issues del Sprint 8 y la epica CO-183.

## Comprobacion remota adicional — 03/11/2026

Workspace Render confirmado por el usuario: **AnderOz** (`tea-d3jtr6gdl3ps73887460`). Consulta de solo lectura:

- API `tti-staging-api` (`srv-db7dsktg1s2s73a5jmhg`): el deploy mas reciente aparece `live`, commit `15ae3e63` (`Restore email verification on registration`, 29/10/2026). Auto deploy esta habilitado para `main`.
- PostgreSQL `tti-staging-db` (`dpg-db7ds6lg1s2s73a5icg0-a`): `available`, plan gratuito, sin alta disponibilidad; expiracion informada 13/11/2026.
- Frontend Render `tti-staging-web` (`srv-db7dsl5g1s2s73a5jo2g`): ultimo deploy `live` es `4253a09` del 14/10/2026 y auto deploy esta habilitado. Es anterior a la implementacion de Sprint 7; este inventario no demuestra que el frontend actual este publicado en Render.
- No hay servicio de tipo cron en el inventario de Render; por tanto, no se acredita scheduler remoto para plazos T1/T2.
- El usuario confirma que **Vercel es el frontend oficial**. El proyecto `cypher-oz` tiene el alias `cypher-oz.vercel.app`; su deployment de produccion mas reciente esta `READY` (`dpl_3GMc4BgGWph6k8bqDMcEkVgXi2bL`, creado por CLI el 29/10). No expone SHA de Git en sus metadatos. El deployment anterior `dpl_GzsB5usDKjozBueQh4tQu78LxK4d` esta `READY` en `main`/`15ae3e63` y tiene check Vercel `success`.
- El arbol de rutas/archivos del deployment de produccion mas reciente no contiene `frontend/src/app/admin/resenas`; los cambios locales de Sprint 8 siguen sin commit. Por eso las reseñas no se acreditan como publicadas en el frontend oficial. La consulta de Vercel no proporciono un Actions run nuevo; la ultima CI integral documentada sigue siendo la del 20/10.

No se cambiaron servicios, variables ni despliegues, y se dejaron pendientes las fechas de Sprint 8. La falta de cron/HA y la restauracion remota mantienen CO-46 abierto. Para completar CO-46 hay que configurar y probar scheduler, verificar respaldo/restauracion remotos y asegurar continuidad de PostgreSQL antes del vencimiento del plan gratuito. Para publicar Sprint 8, primero hay que integrar los cambios locales con commit/CI y confirmar el deployment con esas rutas.
