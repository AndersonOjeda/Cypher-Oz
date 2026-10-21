# Asistente de compras

El chat consulta productos, presentaciones, precios y existencias mediante herramientas
de solo lectura. Usa la misma política de visibilidad del catálogo público, incluyendo
el estado de marca y categoría. Las respuestas de IA pueden contener errores; el
catálogo y el proceso de compra conservan los precios y existencias definitivos.

## Activación

En el servicio backend `tti-staging-api` de Render, configura `GEMINI_API_KEY`
como variable secreta y guarda los cambios para desplegarla. No se configura en
Vercel ni en variables `NEXT_PUBLIC_*`.

`GEMINI_MODEL` es opcional y usa `gemini-3.5-flash-lite` por defecto. Conviene
verificar su disponibilidad y las cuotas de la cuenta de Google; no se garantiza
un número fijo de solicitudes gratuitas.

Sin clave, `GET /api/v1/assistant/chat/` devuelve `{"available": false}` y el
botón permanece oculto. Un POST válido devuelve 503. Con clave, el botón aparece
al recargar. Una clave inválida o sin cuota produce un mensaje de indisponibilidad.

## Contrato y límites

`POST /api/v1/assistant/chat/` recibe `message` (texto, máximo 500 caracteres)
y `history` (máximo diez entradas con `role` user/assistant y `content`, máximo
2000 caracteres). El mensaje actual se envía una sola vez, fuera del historial.

El endpoint público admite quince solicitudes por minuto por IP, con el sistema
de throttling de Django REST Framework. El límite usa el cache configurado del
servicio y no constituye una cuota global entre múltiples instancias.

Se permiten dos rondas de herramientas, con hasta tres solicitudes a Gemini
de ocho segundos cada una. La clave se envía en una cabecera al proveedor.
La conversación vive en memoria del navegador y se envía a Google al consultar.

## Verificación

Las pruebas del backend cubren inventario real en PostgreSQL local, productos
ocultos, validación, límites, falta de clave, errores y el ciclo de herramientas
con Gemini simulado. Las pruebas de navegador cubren móvil, tableta y escritorio
con respuestas de API simuladas. Sin una clave configurada no se puede acreditar
una respuesta real de Gemini en producción.
