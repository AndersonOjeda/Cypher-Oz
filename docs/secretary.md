# Secretaria IA

Disponible para administradores en `/admin/secretaria`, desde la barra del panel.
Reutiliza la clave y el modelo Gemini configurados en el backend.

## Registrar productos

Pega texto de un proveedor o adjunta JPEG, PNG o WebP (hasta 5 MB y el límite de
dimensiones del catálogo). La imagen se valida y se vuelve a codificar sin metadatos
antes de enviarla a Gemini. No se publica automáticamente como imagen de producto.

La IA prepara hasta ocho borradores editables. Los valores desconocidos de precio
y unidades quedan vacíos; el administrador los debe completar. Un precio de costo
del proveedor no debe usarse como precio de venta. Se pueden crear marcas y
categorías sugeridas mediante botones explícitos, o seleccionar las existentes.

Cada producto se guarda únicamente al pulsar Confirmar y guardar sin publicar.
Se usa la API existente: crea su presentación, inventario inicial y auditoría de
forma atómica. El acceso para añadir fotos abre el editor concreto en otra pestaña,
conservando los demás borradores. Los borradores no se conservan al cerrar o
recargar su pestaña.

## Preparar catálogos para clientes

Describe el público y tono, busca productos publicados y selecciona hasta doce.
Gemini redacta el título y presentación, ambos editables. Los productos, imágenes,
precios, promociones y existencias se añaden desde la base de datos con los mismos
serializadores y reglas de visibilidad del catálogo público. Un producto ocultado
desde la selección hace que se solicite actualizarla.

La vista previa permite copiar texto para WhatsApp (no envía mensajes) e imprimir.
En el diálogo de impresión del navegador se puede elegir Guardar como PDF. La salida
incluye fecha de preparación y la advertencia de actualizar precios y existencias.
Para obtener datos nuevos se vuelve a pulsar Preparar catálogo con IA.

## API y controles

- `POST /api/v1/admin/assistant/intake/`: texto y/o archivo multipart; también JSON
  para solicitudes con solo texto. No guarda productos.
- `POST /api/v1/admin/assistant/catalog/`: `brief` y `product_ids`. No publica documentos.
- Ambos requieren sesión de administrador y CSRF; responden con `Cache-Control: no-store`.
- Cinco preparaciones por minuto por administrador usando el cache configurado.
- Una solicitud a Gemini por preparación, con timeout de veinte segundos y salida
  JSON validada. Clave ausente, errores del proveedor o salida inválida devuelven 503.
- Texto e imágenes se envían a Gemini para generar el borrador. No se envían datos
  de clientes ni pedidos. La IA puede equivocarse: la revisión del administrador
  es parte del flujo.

Las pruebas automatizadas simulan las respuestas de Gemini. También se verificaron
lectura de imagen y generación de presentación con la clave real, usando datos
de prueba locales.
