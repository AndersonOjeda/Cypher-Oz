# Sprint 2 — Base del catálogo

Fuente: Documento Maestro v3.0, capítulos 14 y 16–20, y línea base Jira CO-28/CO-29.
Alcance: CO-63/HU-20 (RF-24/25, 5 SP), CO-42/HU-21 (RF-26/27/28, 8 SP).

## Modelo y política

`categories` y `brands`: nombre único sin distinguir mayúsculas, slug único,
descripción, estado y fechas. `products`: nombre, slug único, descripción,
garantía, categoría y marca obligatorias, estado y fechas. `product_images`:
producto, ubicación del objeto, URL estable, tipo, tamaño, dimensiones, texto
alternativo y orden. El archivo vive fuera de PostgreSQL.

Las relaciones se protegen con claves foráneas `PROTECT`. Se permite borrar una
categoría/marca sin productos y un producto inactivo sin imágenes ni otras
relaciones. Para retirar registros relacionados se usa desactivación. Se oculta
un producto cuando él, su categoría o su marca están inactivos. El queryset
`Product.objects.visible()` centraliza esa regla para el catálogo público futuro.
No se crea una variante ni un precio ficticio; en este sprint no hay compra pública.

Todas las rutas del catálogo son administrativas y requieren usuario ADMIN.
La interfaz verifica el rol para mostrar controles; Django lo verifica de nuevo
en cada petición, con cookies HttpOnly, CSRF y errores REST existentes. Las
escrituras rechazan campos desconocidos, incluyendo precio, SKU y stock.
`CatalogChange` guarda actor, entidad, acción y cambios dentro de la transacción.

## Imágenes y consistencia

Adaptador boto3 S3 configurable. Desarrollo y E2E usan MinIO en proceso separado,
con buckets privados separados y volumen persistente. Las imágenes no se escriben
en disco del frontend/backend. GET firmado de 15 minutos para la vista admin;
se persiste una ubicación estable, nunca la firma temporal.

Se validan extensión, MIME y contenido real JPEG/PNG/WebP, bytes, dimensiones y
archivo completo. Se rechazan SVG, archivos corruptos y animaciones. Pillow
decodifica, elimina EXIF/GPS y otras cargas adjuntas mediante reescritura de
píxeles, y genera WebP de hasta 1920 px por lado. Los límites de entrada son
configurables y se publican a la interfaz mediante una ruta solo ADMIN.

La carga bloquea el producto para respetar el máximo de imágenes incluso con
peticiones simultáneas. Antes de escribir al proveedor se registra compensación
durable, con una hora de margen para no limpiar una carga en curso; al confirmar
metadatos se elimina esa compensación en la misma transacción. Si falla la carga
o el proceso se interrumpe, el comando de limpieza retira objetos incompletos.
Al borrar una imagen se retiran metadatos y se registra limpieza atómicamente;
tras commit se intenta borrar el objeto. Una caída del proveedor conserva la
tarea para reintento. El comando procesa hasta 100 tareas vencidas por ejecución.

Las imágenes se ordenan por `sort_order`, luego por id como desempate estable;
la primera es la principal. PATCH admite texto y orden; reemplazar una imagen
consiste en cargar la nueva y retirar la anterior. El enlace de lectura puede
seguir siendo válido hasta vencer si la eliminación física está pendiente.

## Interfaz y verificación

`/admin/catalogo` ofrece secciones Productos, Categorías y Marcas, listas paginadas,
búsqueda administrativa, filtros de estado, formularios y galería. Los errores
preservan los datos del formulario; las escrituras muestran resultado y bloquean
dobles envíos. Crear un producto selecciona su edición para añadir imágenes.
Se añadió acceso desde Mi cuenta para ADMIN.

No se incorporan historias de catálogo público, búsqueda comercial, variantes,
precios ni inventario. El Sprint 2 parte de la rama del Sprint 1 aún no fusionada;
la rama de trabajo es `feature/CO-63-sprint-2`.

Referencias técnicas consultadas: [Pillow Image](https://pillow.readthedocs.io/en/stable/reference/Image.html),
[Boto3 presigned URLs](https://docs.aws.amazon.com/boto3/latest/guide/s3-presigned-urls.html)
y documentación instalada de Next.js 16.3.4 (`frontend/node_modules/next/dist/docs`).
