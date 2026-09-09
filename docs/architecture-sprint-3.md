# Sprint 3 — Variantes y precios

Alcance: CO-64/HU-22 (8 SP, RF-29) y CO-68/HU-26 (3 SP, RF-30).
Fuente: Documento Maestro v3, apartados 8, 13, 14, 16 y 18.

## Unidad comercial

`Variant` pertenece a un producto mediante FK protegida y conserva SKU, nombre,
precio y estado. No admite eliminación por API: se desactiva para conservar sus
referencias. No se añaden inventario, carrito, checkout ni pedidos en este sprint.

El SKU se recorta y normaliza a mayúsculas en la API; PostgreSQL garantiza su
unicidad también ignorando mayúsculas. El precio es `NUMERIC(12,2)`, desde 0 hasta
9999999999.99, expresado como cadena decimal en JSON y como COP en la interfaz.
No se redondean silenciosamente entradas con más de dos decimales. Precio y SKU
son obligatorios; no hay migración que invente datos comerciales para productos
existentes. Una variante sin opciones utiliza el nombre inicial «Estándar».

## Atributos

`CategoryAttribute` define código y nombre de una especificación por categoría;
`VariantAttributeValue` conserva su valor textual para cada variante. Se mantienen
las restricciones `UNIQUE(category, code)` y `UNIQUE(variant, attribute)` del
Documento Maestro. Los valores solo pueden referirse a atributos de la categoría
del producto. No se imponen tipos comerciales ni combinaciones únicas adicionales.

El conjunto `attributes` se reemplaza si viene en PATCH y se conserva si se omite.
Se rechazan identificadores duplicados, inexistentes o de otra categoría, valores
vacíos y campos no permitidos. Cambiar la categoría de un producto con atributos
incompatibles se rechaza; los valores existentes no se descartan silenciosamente.

## Disponibilidad y compatibilidad

`Product.visible()` / `catalog_visible` mantienen la política de visibilidad del
Sprint 2: producto, categoría y marca activos. `Product.available()` /
`catalog_available` agregan el requisito de variante activa con precio válido.
`Variant.available()` aplica la misma política a la unidad comercial individual.
Es una condición de catálogo; no garantiza stock, que se incorpora en Sprint 4.

Un producto puede guardarse sin variantes mientras se prepara su catálogo. No
queda disponible para comercialización por ello. El catálogo público y la
revalidación de compra deberán consumir la política de disponibilidad completa.

## Transacciones y auditoría

Las escrituras de variantes bloquean primero el producto y luego la variante.
Los cambios de categoría del producto usan el mismo bloqueo, evitando que una
validación concurrente deje atributos asociados a una categoría incompatible.
Los cambios de SKU/precio/estado/atributos y su auditoría se confirman juntos.
Los precios anteriores y nuevos se guardan como cadenas exactas en la auditoría.
Las colisiones de unicidad se convierten en conflictos controlados HTTP 409.

Las vistas reutilizan ADMIN, cookies JWT HttpOnly, CSRF y `Cache-Control: no-store`.
Los consumidores no pueden asignar producto, stock o metadatos de auditoría desde
el JSON de una variante. Los listados administrativos son paginados.

## API

Todas las rutas tienen prefijo `/api/v1/admin/`.

| Método | Ruta | Operación |
|---|---|---|
| GET, POST | `products/{id}/variants/` | Listar y crear variantes |
| GET, PATCH | `variants/{id}/` | Consultar y editar variante o precio |
| GET, POST | `categories/{id}/attributes/` | Listar y crear atributos de categoría |
| PATCH | `attributes/{id}/` | Editar definición de atributo |

## Verificaciones integradas posteriores

La exclusión de variantes inactivas se prueba ahora mediante la política de
disponibilidad y se verificará dentro de la compra en HU-09, Sprint 7. La política
de snapshot comercial de HU-12, Sprint 10, deberá conservar nombre, SKU y precio
históricos incluso después de modificar una variante. No existen pedidos que
permitan ejecutar CP-HIST-001 en Sprint 3; no se sustituye esa evidencia por mocks
de pedidos ni se implementa anticipadamente su módulo.
