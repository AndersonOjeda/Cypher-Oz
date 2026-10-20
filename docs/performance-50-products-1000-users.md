# Rendimiento local: 50 productos y hasta 1.000 usuarios virtuales

Fecha: 19 de octubre de 2026, America/Bogota.

La configuración local evaluada **no supera la prueba**: p95 global de 14,998 s
y 71,59 % de peticiones fallidas. Se alcanzaron 1.000 usuarios virtuales, pero
la ejecución se prolongó y fue interrumpida mediante SIGINT. No constituye una
certificación de capacidad de producción ni una ejecución sostenida aprobada.

## Entorno y alcance

- Windows, AMD Ryzen 7 4800H, 16 procesadores lógicos, aproximadamente 23,4 GiB RAM.
- PostgreSQL 17 en Docker Desktop; base exclusiva `tti_loadtest`.
- Django con `DEBUG=False`, Waitress 3.0.2 con 16 hilos, puerto 8010.
- Next.js 16.3.8: `next build` y `next start`, puerto 3010.
- k6 2.3.0 en Docker, pasando por Next.js → Django → PostgreSQL.
- 50 productos sintéticos, una variante y 100 unidades por producto,
  5 categorías y 5 marcas. Sin imágenes de producto ni promociones.
- Listado, búsqueda con orden por precio y detalle aleatorio, con pausas de lectura.
- Sin login, checkout, pagos, correo ni operaciones externas.

Todos los componentes y el generador compartieron el mismo equipo. No se
simularon 1.000 navegadores ejecutando JS ni 1.000 compras simultáneas.
El número de usuarios virtuales no equivale a solicitudes por segundo.

## Prueba básica

La comprobación previa de un usuario pasó: 7 peticiones, 0 errores HTTP,
6 validaciones correctas y p95 global 697,05 ms. Incluye la petición de
preparación que verifica que el catálogo contiene exactamente 50 productos.
No es una muestra suficiente para establecer un SLA.

## Prueba de carga

Plan: rampas de 30 s hasta 10, 100, 250, 500 y 1.000 usuarios, 60 s a 1.000,
y descenso de 15 s. La ejecución registró aproximadamente 359 s de tiempo total,
incluido el cierre prolongado, y terminó interrumpida, con salida 1.

| Métrica registrada | Resultado |
|---|---:|
| Máximo de usuarios virtuales observado | 1.000 |
| Peticiones, incluida preparación | 15.660 |
| HTTP 200 | 4.449 |
| HTTP 500 | 9.161 |
| Sin respuesta HTTP (status 0) | 2.050 |
| Peticiones fallidas | 11.211 / 15.660 (71,59 %) |
| Validaciones funcionales correctas | 4.448 / 15.659 (28,40 %) |
| Latencia media global | 7,309 s |
| Latencia p95 global | 14,998 s |
| Latencia p99 global | 97,764 s |
| Latencia p95 de respuestas HTTP esperadas | 12,728 s |
| Peticiones/s globales, incluidas fallidas | 43,63 |

No interpretar las 43,63 peticiones/s como capacidad útil: incluyen miles de
respuestas fallidas. El objetivo provisional era <1 % de errores, >99 % de
validaciones y p95 <1 s; todos quedaron incumplidos.

Los timeouts estaban configurados a 15 s, pero se observaron tiempos extremos
mucho mayores. La ejecución presenta degradación del entorno/generador y cierre
prolongado; no es válido asumir que todos esos tiempos pertenecen únicamente
al procesamiento de Django. Es necesario repetir con generador separado.

Ventanas aproximadas por momento de finalización de cada petición:

| Tiempo desde inicio | Carga programada | Peticiones finalizadas | p95 |
|---|---|---:|---:|
| 0–30 s | Rampa 0–10 | 76 | 0,137 s |
| 30–60 s | Rampa 10–100 | 691 | 1,342 s |
| 60–90 s | Rampa 100–250 | 1.131 | 3,710 s |
| 90–120 s | Rampa 250–500 | 1.141 | 9,317 s |
| 120–150 s | Rampa 500–1.000 | 1.209 | 14,998 s |

Son ventanas de finalización con origen estimado desde las muestras de k6.
No atribuyen un p95 a una concurrencia constante exacta, ni establecen cuántos
usuarios admite el sistema. Las ventanas posteriores incluyen la saturación y
el cierre irregular y están disponibles en las muestras originales.

## Evidencia del servidor

Waitress registró crecimiento de la cola de tareas hasta al menos 322.
Next.js registró `ECONNREFUSED 127.0.0.1:8010` durante la fase de fallos.
Esto confirma espera acumulada e indisponibilidad de la conexión al backend
en esa fase. No se identificó todavía una causa única de los rechazos.
No hay evidencia suficiente para culpar exclusivamente a PostgreSQL o al ORM.

Después de retirar la carga se verificó:

- `http://127.0.0.1:8010/health/`: `status=ok`, `database=postgresql`.
- `http://localhost:3010/api/v1/products/?page_size=100`: `count=50`.

## Rendimiento visual antes de la carga

Medido con trazas de Chrome DevTools MCP sobre `/catalogo`, recarga sin caché.

| Perfil | LCP | CLS |
|---|---:|---:|
| Escritorio, 1440×900, sin limitación | 379 ms | 0,1272 |
| Móvil, 390×844, CPU 4×, Slow 4G | 2.827 ms | 0,6526 |

La referencia de Core Web Vitals considera buenos LCP ≤2,5 s y CLS ≤0,1.
El LCP de escritorio es bajo; el móvil necesita mejorar. La estabilidad visual
necesita mejorar en escritorio y es deficiente en móvil. Son dos observaciones
de laboratorio, no percentiles de usuarios reales. No se midió INP ni se calculó
una puntuación Lighthouse de rendimiento.

DevTools identifica desplazamientos en `main#contenido` y el footer; en
escritorio también en el header. No determinó automáticamente su causa raíz.
El fallback de Suspense del catálogo es un candidato para revisar, no una causa
confirmada. En móvil, el CSS global bloqueó el render; DevTools estima 478 ms
de mejora posible en FCP/LCP. Los recursos estáticos tienen gzip y caché immutable,
y las peticiones del catálogo observadas antes de la carga devolvieron HTTP 200.

## Siguiente trabajo recomendado

1. Repetir con generador en otra máquina y configuración Linux equivalente al
   despliegue real, conservando métricas de CPU/RAM, conexiones y logs a disco.
2. Instrumentar tiempo en cola, tiempo de Django y consultas antes de elegir
   cambios de workers, conexiones, índices o caché. No aumentar hilos a ciegas.
3. Hacer escalones constantes de 10, 25, 50 y 100 usuarios para delimitar un
   nivel que cumpla los objetivos antes de volver a intentar 1.000.
4. Revisar el espacio reservado durante la carga del catálogo y el CSS global,
   y repetir trazas con imágenes representativas e interacciones.

## Archivos y repetición

- [Procedimiento y limitaciones](../scripts/load/README.md).
- [Escenario k6](../scripts/load/catalog.k6.js).
- [Preparación y servidor aislados](../backend/scripts/loadtest.py).
- [Analizador de muestras](../scripts/load/analyze.py).
- Resumen original: `.runtime/loadtest/1000-users.json`.
- Muestras originales: `.runtime/loadtest/samples.json`.
- Comprobación previa: `.runtime/loadtest/smoke.json`.

Los JSON de `.runtime` son artefactos locales ignorados por Git. El resumen k6
usa `thresholds: true` para umbrales fallidos en esta exportación; consultar el
valor numérico, los objetivos y la salida de consola, que reportó los fallos.
No se modificó código funcional de la aplicación para mejorar los resultados.

Referencias: [métricas k6](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)
y [Core Web Vitals](https://web.dev/articles/vitals).

## Mejoras implementadas y validación posterior

Se aplicaron cambios locales al catálogo y a la infraestructura de medición.
Las cifras de la rampa original se conservan arriba como evidencia histórica.
No se ha desplegado ni certificado producción, ni repetido una prueba de 1.000
usuarios después de los cambios: la validación se detuvo al fallar el escalón de 100.

### Cambios

- Listado/búsqueda: 7 → 5 consultas por petición; detalle: 6 → 5 en el conjunto
  sintético. El listado deja de cargar atributos que no muestra. Variantes y stock
  se cargan juntos; los atributos del detalle incluyen su definición en el mismo lote.
- La selección usa EXISTS para conservar una fila por producto. El orden por
  precio utiliza el precio inicial de las variantes activas y evita duplicados
  al paginar. Mínimo y máximo ahora deben coincidir con la misma variante activa.
  Los tests reprodujeron ambos fallos antes de corregirlos.
- Instrumentación optativa: `Server-Timing`, consultas y duración de Django/driver
  en logs rotativos, sin SQL ni parámetros de clientes. Activada solo en loadtest.
- El generador se ejecuta desacoplado de la terminal, con logs a archivo. Los
  escalones de 30 s se detienen automáticamente ante un umbral incumplido y tienen
  un límite de ejecución de 120 s. No se ejecutaron compilaciones ni suites durante
  los escalones de 25, 50 y 100. La comparación breve de 10 usuarios es orientativa.
- Fallback del catálogo con encabezado y estructura estables; espacio reservado
  durante la carga, un único landmark main y sincronización de filtros sin efectos
  posteriores al render. Se verificó también la navegación de filtros mediante tests.
- Se evaluaron los planes SQL principales: todas las observaciones fueron <1 ms
  sobre 50 productos. No se añadieron índices sin evidencia ni caché de precios/stock
  que pudiera servir datos desactualizados.

### Carga después de las mejoras (16 hilos)

Todos los escalones siguientes terminaron normalmente y tuvieron 0 errores HTTP
y 100 % de validaciones funcionales correctas. La aceptación exige además p95 <1 s
global y por endpoint. Cada prueba dura solo 30 s más cierre; no acredita un SLA.

| Usuarios constantes | Peticiones | p95 global | p95 listado | Resultado de umbrales |
|---|---:|---:|---:|---|
| 10 | 169 | 125,04 ms | 153,23 ms | Pasa |
| 25 | 415 | 169,26 ms | 394,82 ms | Pasa |
| 50 | 790 | 481,08 ms | 961,31 ms | Pasa, margen escaso en listado |
| 100 | 1.486 | 768,11 ms | 1.428,25 ms | Falla el listado |

Antes de modificar consultas, el escalón corto de 10 usuarios registró 163
peticiones, p95 global 218,18 ms y p95 de listado 253,62 ms. No comparar directamente
estas pruebas pequeñas con el porcentaje de errores de la rampa original: difieren
en carga, duración y manejo de logs. No se puede atribuir toda la diferencia a SQL.

En el intervalo de 100 usuarios, Django registró 991 peticiones al endpoint de
listado/búsqueda: p95 de aplicación 265,21 ms y de llamadas al driver 243,17 ms.
Para detalle fueron 495 peticiones: 232,96 y 222,16 ms, respectivamente. Todas
registraron 5 consultas y ningún error de aplicación. El tiempo de espera externo
es relevante, pero no se obtiene una medida exacta de cola restando estos p95.
La ruta normalizada agrupa listado y búsqueda; k6 los distingue con etiquetas.

### Experimento de hilos a 100 usuarios

| Hilos | p95 global | p95 listado | Errores HTTP | Resultado |
|---|---:|---:|---:|---|
| 8 | 602,53 ms | 1.280,16 ms | 0 % | Falla listado |
| 16 | 768,11 ms | 1.428,25 ms | 0 % | Falla listado |
| 32 | 1.235,82 ms | 2.028,29 ms | 0 % | Falla global/listado |

Duplicar hilos empeoró esta observación. Ocho hilos redujeron los tiempos, pero
no cumplieron el objetivo y cada variante solo se midió una vez. Se restauró y
conservó el valor de referencia de 16; no se cambió la configuración de despliegue.
No se ejecutaron los escalones de 250–1.000 porque 100 ya fallaba.

### Navegador después de las mejoras

Nuevas trazas Chrome DevTools, sin carga k6 ni suites en paralelo, misma URL y
perfiles de la medición inicial, recarga sin caché:

| Perfil | LCP antes → después | CLS antes → después |
|---|---|---|
| Escritorio 1440×900 | 379 → 154 ms | 0,1272 → 0 |
| Móvil 390×844, CPU 4×, Slow 4G | 2.827 → 1.644 ms | 0,6526 → 0 |

Son observaciones de laboratorio individuales, con 50 productos sin imágenes.
El LCP corresponde al elemento más grande visible (encabezado), no al tiempo
en que todos los productos terminaron de cargar. DevTools verificó 20 tarjetas en
la primera página, total 50, sin desbordamiento horizontal, sin mensajes de consola
de error/advertencia y con HTTP 200 en las consultas públicas. La auditoría aún
señala CSS que bloquea el render móvil, con ahorro estimado de 510 ms; no se cambió
su distribución global sin revisar el impacto en el resto de rutas.

### Validación y límites

- Suite completa del backend en el estado anterior a las ediciones paralelas:
  226 tests pasaron en 349,41 s. La última regresión de atributos se añadió después.
- Frontend: 11 tests de catálogo, detalle y UTF-8 pasaron; compilación de producción
  y lint de los componentes modificados correctos. Revisión de React aplicada.
- El nuevo test de atributos y las regresiones de rendimiento se verifican con
  `config.settings.performance_test` para usar `test_tti_performance`. Una primera
  repetición encontró `test_tti` ocupada por otra ejecución y se cambió a la base propia.
  La repetición aislada terminó con **28 tests correctos** en 21,44 s.
- Se conservaron cambios paralelos en configuración, pedidos, usuarios y Sprint 4.
  No se incluyen como implementación de esta mejora ni se certifican con la suite anterior.
- El generador sigue en el mismo equipo. Falta una prueba desde otra máquina, con
  configuración Linux representativa y ejecución prolongada. El máximo local que
  pasó estos escalones cortos es 50; no equivale a capacidad garantizada de producción.

Artefactos adicionales en `.runtime/loadtest/`: `profile-before.json`,
`profile-after.json`, `plans-before.json`, `plans-after.json`, `before-10.json`,
`after-10.json`, `after-25.json`, `after-50.json`, `after-100.json`,
`threads8-100.json`, `threads32-100.json`, `requests.log` y `server.log`.
Los contenedores de escalones terminados conservan códigos de salida y fechas
para correlacionar las medidas. Procedimiento en `scripts/load/README.md`.

La guía de PostgreSQL se utilizó para reducir viajes y evitar índices sin medir;
la revisión de React ayudó a conservar el HTML inicial y evitar sincronización
innecesaria mediante efectos. Referencias técnicas:
[instrumentación Django](https://docs.djangoproject.com/en/5.2/topics/db/instrumentation/),
[QuerySet/Prefetch](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#prefetch-related)
y [parámetros Waitress](https://docs.pylonsproject.org/projects/waitress/en/stable/arguments.html).
