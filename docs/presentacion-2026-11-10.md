# Presentación del 10 de noviembre de 2026

La entrega se presenta como proyecto académico. Por decisión de Anderson del
9 de noviembre no se contratan servicios ni se extiende la base gratuita remota.
La continuidad de producción posterior al 13 de noviembre queda fuera de esta
entrega; no se certifica operación comercial permanente.

## Preparación

Abrir Docker Desktop y ejecutar desde la raíz:

```powershell
./scripts/start-sprint1.ps1
```

Aunque conserva el nombre histórico de Sprint 1, el script sirve la aplicación
completa del código actual, aplica todas las migraciones y usa una base separada
`tti_sprint1_demo`. Abrir **http://localhost:3002**. Los datos persisten al detener.
No ejecutar la presentación contra `tti_e2e`, que pertenece a Playwright.

Cuentas exclusivamente didácticas, creadas solo en la base aislada:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@sprint1.example | Demo-Sprint1!Clase8472 |
| Cliente | cliente@demo.example | Demo-Cliente!Clase8472 |

El script conserva las contraseñas de cuentas que ya existían. Usar perfiles de
navegador separados para cliente y administrador. En esta demo los correos quedan
en `.runtime/sprint1-backend.log`; el registro exige verificar el enlace que
aparece allí y nunca envía mensajes reales. La recepción real de Brevo se presenta
como evidencia separada; la demo local no la acredita.

## Recorrido sugerido

1. Visitante: catálogo, detalle, comparación e información de pago/entrega/garantía.
2. Cliente: comprar el teclado de demostración, retirar en tienda y confirmar pedido.
3. Mostrar que el carrito no reserva stock y que el pedido sí descuenta existencias.
4. Cliente: reportar una referencia ficticia; explicar que Reportado no es Confirmado.
5. Administrador: comprobar el reporte, confirmar el pago de prueba y avanzar
   Preparar → Despachar → Entregar. No usar fondos ni comprobantes reales.
6. Cliente: publicar y editar una reseña desde el pedido entregado; revisar el
   promedio y la etiqueta Compra verificada en el producto.
7. Reportar la opinión; demostrar que sigue visible hasta moderación. Administrador:
   ocultar con motivo, revisar auditoría y restaurar. Mostrar el cambio en conteo.
8. Cambiar a ancho móvil y recorrer con Tab el formulario de reseña.
9. Mostrar Jira y los resultados del expediente de cierre. Distinguir pruebas
   locales, CI histórica, publicación remota y aceptación del profesor.

Los diez artículos del seed inicial no se reponen al reiniciar. Si se consumen,
registrar una entrada didáctica desde Inventario con motivo explícito.

## Plazos y recuperación

Con la demo activa, comprobar el comando sin modificar pedidos:

```powershell
$env:DJANGO_SETTINGS_MODULE = 'config.settings.demo'
backend/.venv/Scripts/python.exe backend/manage.py process_payment_deadlines --actor-email admin@sprint1.example --dry-run
Remove-Item Env:DJANGO_SETTINGS_MODULE
```

La suite de PostgreSQL prueba vencimientos y reintentos. Este comando manual no
equivale a un scheduler remoto activado. Para probar backup/restauración local:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_local_recovery.py --source tti_sprint1_demo
```

El procedimiento conserva el dump sintético en `.runtime`, restaura en otra base,
compara conteos y elimina solo la base temporal que creó. No incluye los objetos
de imágenes ni los datos de Render. Evidencias públicas: `docs/evidence/sprint-8/`.

## Cierre de la demo

```powershell
./scripts/stop-sprint1.ps1
```

## Docker Extension solicitada

`docker extension init my-extension` creó una plantilla React/Go independiente en
`my-extension/`; su UI compiló. No es un requisito para ejecutar la tienda y no
se publicó ni se instaló automáticamente. El generador incluyó dependencias con
avisos de seguridad que `npm audit fix` sin cambios mayores no resolvió. Mantenerla
como ejemplo auxiliar; no presentarla como una integración funcional con TTI.
