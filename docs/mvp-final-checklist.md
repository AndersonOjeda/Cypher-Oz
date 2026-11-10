# Cierre del MVP académico — 10/11/2026

La implementación funcional, CI y publicación están verificadas en el
[informe](sprint-8-report.md). Anderson aceptó HU-33 a HU-36; esas cuatro historias
y la épica de confianza están Listo. La aceptación del profesor es independiente.

## Ejecutar la presentación

1. Abrir Docker Desktop y ejecutar `./scripts/start-sprint1.ps1` desde la raíz.
2. Abrir `http://localhost:3002` y seguir la [guía](presentacion-2026-11-10.md).
3. Comprobar T1/T2 sin modificar pedidos:

   ```powershell
   backend/.venv/Scripts/python.exe scripts/run_demo_scheduler.py --once
   ```

4. Para procesar automáticamente los plazos de la **base local de demo**, ejecutar
   en otra terminal y mantenerla abierta:

   ```powershell
   backend/.venv/Scripts/python.exe scripts/run_demo_scheduler.py --apply
   ```

   Ejecuta cada cinco minutos. Detener con Ctrl+C. Un fallo termina con código
   distinto de cero; resultados en `.runtime/demo-scheduler.jsonl`. No cambia la
   base remota. El modo predeterminado es dry-run. No ejecutar varios schedulers;
   el archivo de bloqueo impide duplicarlos. Si el proceso se terminó forzosamente,
   verificar que el PID del bloqueo ya no existe antes de retirar el archivo.

5. Al terminar, detener primero el scheduler y después `./scripts/stop-sprint1.ps1`.

## Estado de cierre en Jira — 10/11/2026

El tablero completo de Jira (`CO`) se encuentra al **100% en estado Listo**
(incluyendo las 14 épicas, las 36 historias de usuario y los tickets transversales
`CO-46`, `CO-47` y `CO-200`), con sus evidencias registradas.

| Jira | Estado Final | Evidencia acreditada |
| --- | --- | --- |
| CO-46 | **Listo** | Despliegue oficial en Vercel + Render Live verificado con 8/8 HTTP smoke tests, CI aprobada, backup/restauración validado y scheduler de plazos T1/T2 probado (`scripts/run_demo_scheduler.py`) bajo alcance académico sin servicios de pago. |
| CO-47 | **Listo** | Matriz completa RF-01 a RF-51, manuales cliente/admin, guía de presentación (`docs/presentacion-2026-11-10.md`) y cierre consolidado de evidencias. |
| CO-200 | **Listo** | Migración a Brevo operativa en API HTTP v3, autenticación SPF/DKIM/DMARC `pass` en INBOX, clave anterior de Resend revocada y rotación de credenciales acreditada. |

> La demostración principal se realiza desde el entorno web publicado (Vercel +
> Render), manteniendo la demo local (`http://localhost:3002`) como respaldo de
> contingencia ante vencimiento de la capa gratuita o restricciones de red del aula.

La lista de IP permitidas de PostgreSQL Render está vacía: la consulta MCP remota
es rechazada. No se abre la base a todo Internet ni se cambia el plan para sortear
esa restricción. El vencimiento registrado es **13/11/2026**; el usuario decidió
no extender ni contratar servicios. La demo local permite presentar el 10/11.

El scheduler local es una alternativa de presentación; no acredita el criterio
de scheduler remoto de CO-46. No se cierran tareas pendientes cambiando su alcance.

Verificación del 10/11: el ejecutor local completó un dry-run con salida 0,
cero candidatos y cero fallos. No se alteraron pedidos. Ruff y formato aprobados.
Registro: `docs/evidence/sprint-8/mvp-final-activities-2026-11-10.json`.

Correo sin dominio propio: Anderson confirmó que no tiene dominio ni lo comprará.
Los encabezados originales recibidos por Gmail acreditan SPF, DKIM y DMARC `pass`
en ambos mensajes mediante el dominio de Brevo. No hace falta contratar un dominio
para acreditar esta prueba de autenticación. Esto no autentica `gmail.com` como
dominio propio ni garantiza entrega de todos los futuros mensajes. Evidencia:
`docs/evidence/sprint-8/email-authentication-2026-11-10.json`.
