# Imágenes por variante

En Administración → Catálogo → Editar producto → Imágenes del producto,
seleccionar la variante o modelo de cada foto y pulsar **Guardar imagen**.
También se puede elegir la variante al subir una imagen nueva.

La ficha pública muestra primero las fotos del modelo seleccionado y después
las imágenes generales. Cambiar de variante vuelve a su primera foto. Las fotos
de otros modelos no aparecen en esa galería. Si no hay foto propia ni general,
se muestra «Sin imagen disponible».

Las imágenes existentes siguen siendo generales hasta que se asignen. No se
deduce el color por el nombre, descripción o posición de la foto. La API rechaza
asociaciones con variantes de otro producto. El cambio añade una relación nullable
mediante `catalog.0003_productimage_variant`; no borra imágenes ni variantes.

Validación: pruebas API de carga/asignación/reasignación y privacidad entre
productos; pruebas de componente de selección/edición; escenario E2E con fotos
en almacenamiento S3 local y cambio de modelo en móvil, tablet y escritorio.
