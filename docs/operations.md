# Operación y recuperación

## Uso del cliente

1. Registrarse o iniciar sesión y mantener las direcciones en «Mi cuenta».
2. Consultar catálogo y detalle. «Comparar» permite elegir de dos a cuatro productos
   de la misma categoría; la tabla muestra precio, garantía, atributos y disponibilidad.
3. En «Comprar», elegir productos, cantidades y entrega. Revisar cambios de precio
   o stock y el total antes de confirmar. Una zona sin tarifa cotizada no permite seguir.
4. Abrir las instrucciones del pedido y reportar la referencia de una transferencia
   efectivamente realizada. Reportado significa revisión pendiente, no fondos confirmados.
5. Si se rechaza, leer el motivo y corregir la referencia dentro de las 24 horas
   indicadas. Un reporte repetido no prolonga el plazo de revisión.
6. Consultar «Mis pedidos» para ver estados e historial. WhatsApp incluye el número
   del pedido, pero abrirlo no reporta ni confirma un pago.
7. Cancelar solo cuando aparezca la acción y confirmar el efecto. Si el pago está
   confirmado, contactar con la tienda para conciliación manual del eventual reembolso.

## Uso del administrador

1. En `/admin/pagos`, filtrar/buscar y navegar las páginas de resultados.
2. Contrastar la referencia con fondos efectivamente recibidos en la cuenta de la
   tienda antes de confirmar. Un mensaje de WhatsApp no acredita recepción de dinero.
3. Para rechazar, indicar un motivo claro; queda visible al cliente con su plazo de
   corrección. Atender prioritariamente los avisos «Plazo T2 vencido».
4. En `/admin/pedidos`, filtrar por estado o modalidad y consultar el detalle de
   entrega. Usar la dirección histórica del pedido; una edición posterior del perfil
   no la sustituye. «Copiar rótulo» permite coordinar un envío.
5. Con pago confirmado, avanzar Preparar → Despachar → Entregar. Refrescar ante un
   conflicto de otro operador. Los saltos o retrocesos no aprobados se rechazan.
6. Cancelar únicamente compras sin pago confirmado y sin despacho. La conciliación
   de pagos confirmados se gestiona manualmente; esta aplicación no emite reembolsos.

## Entornos comprobados

| Componente | Servicio |
|---|---|
| Frontend público | Vercel, `cypher-oz.vercel.app` |
| Backend staging | Render, `tti-staging-api`, Virginia |
| PostgreSQL staging | Render, `tti-staging-db` |
| Imágenes | Supabase Storage, bucket privado `cypher-oz-catalog` |
| Desarrollo y aceptación | PostgreSQL 17 y MinIO locales en Docker |

Cada despliegue debe identificar su commit. Una vista previa de Vercel lista no
demuestra que Render ejecute el backend correspondiente. Ver el informe de Sprint 7
para las versiones verificadas y los pendientes del entorno remoto.

## Publicación

1. Aprobar CI: lint, formato, migraciones, backend, frontend, build y E2E.
2. Conservar backup verificable de PostgreSQL y de los objetos de catálogo.
3. Integrar el commit aprobado y desplegar backend con `migrate --noinput`.
   La migración `orders.0003` añade campos opcionales y motivo con valor vacío;
   no inventa motivos ni extiende plazos de rechazos históricos.
4. Desplegar frontend apuntando a esa API. Comprobar `/health/`, catálogo,
   login/CSRF, acceso por rol, comparador y un flujo controlado en staging.
5. Revisar logs y ejecutar el scheduler en dry-run antes de activarlo.

La reversión de código no deshace migraciones ni movimientos de inventario. Ante
un fallo, detener el scheduler, conservar evidencia y validar compatibilidad del
backend anterior; no restaurar sobre una base comercial sin conciliación.

## Scheduler de pagos

La aplicación `1c48353` quedó publicada en Render y Vercel y pasó el smoke HTTP.
Esto no activa el scheduler. Un cron nuevo de Render tiene un cargo mínimo de
US$1/mes, más uso según duración: [facturación oficial](https://render.com/docs/cronjobs).
No se creó ese recurso de pago sin autorización específica.

Ejecutar desde `backend/`, con la misma base, código y configuración del backend:

```sh
python manage.py process_payment_deadlines --actor-email "$ORDER_EXPIRY_ACTOR_EMAIL" --limit 100 --dry-run
python manage.py process_payment_deadlines --actor-email "$ORDER_EXPIRY_ACTOR_EMAIL" --limit 100
```

Configurar el actor como ADMIN activo existente. Programar cada cinco minutos en
un scheduler del entorno; no ejecutar un temporizador por worker Gunicorn. Verificar
salida JSON, exit code y logs. `failed` no vacío implica fallo y requiere revisión;
un reintento no duplica alertas T2 ni restituciones. El límite se ajusta entre 1 y
1.000 según el volumen observado. Las carreras se serializan en PostgreSQL.

El comando solo actúa sobre pedidos PENDING. T1 y corrección rechazada vencida
cancelan con historial y reversión transaccional; T2 crea alerta de revisión sin
cancelar pagos reportados ni confirmar fondos. El frontend muestra el T2 vencido
incluso antes del siguiente ciclo. Ningún scheduler remoto se considera activado
solo por existir este comando.

## Backup y restauración

Guardar un dump PostgreSQL en formato custom, cifrado y fuera del contenedor del
backend. Probar `pg_restore --exit-on-error` en **otra base aislada**, comprobar
migraciones, relación pedido/pago, movimientos y restricciones, y registrar fecha,
versión, duración y resultado. Verificar además lectura de imágenes: el dump de
PostgreSQL no incluye los archivos del bucket.

El 20/10/2026 se ejecutó `pg_dump`/`pg_restore` de la base E2E local a
`tti_restore_acceptance_20261020`: 32 migraciones, 40 pedidos y 40 pagos restaurados;
cero combinaciones CANCELLED/CONFIRMED. La base temporal se eliminó al terminar.
Esto prueba el procedimiento local, no la recuperación del proveedor remoto.

Antes de operación real quedan por acreditar: backup y restauración del PostgreSQL
remoto, recuperación de objetos, scheduler remoto y alertas de fallo. La base
gratuita Render tenía vencimiento registrado para 13/11/2026; revisar su continuidad
en el panel antes de esa fecha.
