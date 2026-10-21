# Verificación del registro de productos y sus presentaciones

Fecha: 21 de octubre de 2026.

## Cambios aplicados

- Registro guiado: datos, precio y unidades en un formulario; fotos opcionales después.
- Identificador del producto y código de la presentación generados automáticamente.
- Producto, precio y existencias iniciales se guardan en una transacción. Las entradas conservan su movimiento de inventario y auditoría.
- La edición muestra las unidades disponibles arriba del formulario, incluido el estado agotado.
- Las variantes se explican como presentaciones, con ejemplos y acciones para editar, añadir, mostrar y ocultar.
- Cada presentación permite registrar sus unidades iniciales; el código y las características avanzadas son opcionales.
- Las acciones de edición llevan al editor y trasladan el foco, respetando el movimiento reducido.
- Mientras se cargan las presentaciones no aparece un formulario vacío que pueda confundirse con la creación de otra.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Pruebas completas del servidor sobre PostgreSQL 17 aislado | 362 aprobadas, incluidas las de concurrencia |
| Pruebas completas del frontend | 121 aprobadas |
| ESLint, TypeScript y compilación de producción | Correctos |
| Ruff: análisis y formato del backend | Correctos |
| Django: comprobación del sistema y migraciones pendientes | Sin problemas; no se requieren migraciones nuevas |
| Suite general de navegador, tres tamaños | 47 de 48 aprobadas; se corrigió un selector ambiguo de la prueba de variantes |
| Reejecución final de variantes y registro simplificado, tres tamaños | 9 de 9 aprobadas |

Las cifras de las ejecuciones de navegador no se suman: la reejecución contiene pruebas repetidas y las tres pruebas nuevas del registro simplificado.

La comprobación final del registro verifica desde el navegador el guardado del precio y siete unidades, la omisión de fotos, la generación automática de códigos, una segunda presentación con tres unidades, el total de diez unidades, la disponibilidad pública y la persistencia después de recargar. La suite general también probó imágenes con almacenamiento MinIO real, permisos y flujos de compra.

## Entorno y evidencia

Las pruebas usan PostgreSQL y almacenamiento independientes de los productos de la demostración local. Los archivos de pruebas y las credenciales de demostración no se configuran como credenciales de producción.

Resultados locales: `reports/product-ux-backend.xml` y `reports/product-ux-browser.xml`.

Aplicación de demostración: <http://localhost:3010/admin/catalogo>. El backend está en `127.0.0.1:8010`. Los cambios están aplicados al código del proyecto; esta verificación no realiza un despliegue remoto.
