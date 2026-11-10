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

## Pendientes que impiden declarar cierre total

| Jira | Falta acreditar | Evidencia ya disponible |
| --- | --- | --- |
| CO-46 | Scheduler y respaldo/restauración del entorno remoto, incluyendo objetos | Despliegue, HTTP, CI, restauración PostgreSQL local y comando T1/T2 probado |
| CO-47 | Consolidar cierre cuando CO-46 cumpla sus criterios | Matriz de 51 RF, manuales, guía, evidencias y aceptación del incremento de confianza |
| CO-200 | Acreditar autenticación/remitente y rotación de otras credenciales expuestas según alcance | Clave Onboarding de Resend revocada y ausencia de claves verificada; Brevo integrado y recepción de recuperación real; transporte de verificación con enlace inerte |

La lista de IP permitidas de PostgreSQL Render está vacía: la consulta MCP remota
es rechazada. No se abre la base a todo Internet ni se cambia el plan para sortear
esa restricción. El vencimiento registrado es **13/11/2026**; el usuario decidió
no extender ni contratar servicios. La demo local permite presentar el 10/11.

El scheduler local es una alternativa de presentación; no acredita el criterio
de scheduler remoto de CO-46. No se cierran tareas pendientes cambiando su alcance.

Verificación del 10/11: el ejecutor local completó un dry-run con salida 0,
cero candidatos y cero fallos. No se alteraron pedidos. Ruff y formato aprobados.
Registro: `docs/evidence/sprint-8/mvp-final-activities-2026-11-10.json`.
