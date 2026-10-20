# Prueba local: 50 productos y hasta 1.000 usuarios virtuales

No utiliza las bases normales, demo ni E2E. La base exclusiva es `tti_loadtest`.
Los datos son 50 productos sintéticos, una variante y 100 unidades por producto,
5 categorías y 5 marcas. No incluye imágenes, promociones ni cuentas de clientes.
El seed es repetible y restablece a 100 el stock de esta base de pruebas.

## Preparación (PowerShell, desde la raíz)

```powershell
docker compose up -d --wait postgres
backend/.venv/Scripts/python -m pip install -r backend/requirements-load.txt
backend/.venv/Scripts/python backend/scripts/loadtest.py prepare
backend/.venv/Scripts/python backend/scripts/loadtest.py serve
```

El backend usa Waitress con 16 hilos, `DEBUG=False`, conexiones persistentes,
en `127.0.0.1:8010`. Se eligió Waitress para ejecutar WSGI en Windows;
esta configuración no reproduce los workers Gunicorn del despliegue Linux.

En otra terminal, compilar e iniciar Next.js (se necesita `next build`, no `next dev`):

```powershell
cd frontend
$env:DJANGO_URL='http://127.0.0.1:8010'
$env:TTI_E2E='0'
$env:TTI_DEMO='0'
npm run build
npm run start -- --port 3010
```

## Carga (desde la raíz)

Para validar mejoras, ejecutar primero escalones constantes pequeños. El ejecutor
espera cada resultado y se detiene si falla; conserva los contenedores terminados
para inspeccionar su código de salida. Usar una etiqueta nueva para cada repetición:

```powershell
./scripts/load/run-steps.ps1 -Steps 10,25,50,100 -Label validacion-01
```

Cada escalón mantiene su concurrencia durante 30 s, más el cierre de iteraciones.
Son comprobaciones cortas de laboratorio, no pruebas prolongadas de estabilidad.
Los logs de k6 van a archivos y Docker corre desacoplado de la terminal para evitar
que la salida masiva distorsione el generador. Los escalones mayores quedan
disponibles mediante `-Steps 250,500,1000`, cuando los anteriores ya pasan.

El comando histórico siguiente reproduce la rampa original; para trabajo nuevo,
preferir los escalones y logs a archivo anteriores:

```powershell
New-Item -ItemType Directory -Force .runtime/loadtest | Out-Null
$loadRoot = (Get-Location).Path
docker run --rm --mount "type=bind,source=$loadRoot,target=/work" -e SMOKE=1 grafana/k6:2.3.0 run --summary-export=/work/.runtime/loadtest/smoke.json /work/scripts/load/catalog.k6.js
docker run --rm --mount "type=bind,source=$loadRoot,target=/work" grafana/k6:2.3.0 run --quiet --summary-export=/work/.runtime/loadtest/1000-users.json --out json=/work/.runtime/loadtest/samples.json /work/scripts/load/catalog.k6.js
backend/.venv/Scripts/python scripts/load/analyze.py .runtime/loadtest/samples.json
```

La ejecución original utilizó `grafana/k6:latest`, versión comprobada 2.3.0,
digest `sha256:e66db15b860113878fa74670e31f5e274830b7b6e42c8bff28b2f2d86a257603`.
Para reproducir exactamente la imagen puede sustituirse la etiqueta por ese digest.

El recorrido hace tres GET secuenciales: listado, búsqueda con orden por precio y
detalle aleatorio. Hay pausas de 1–2 s, 1–2 s y 2–4 s para simular lectura.
Cada etapa dura 30 s y termina en 10, 100, 250, 500 y 1.000 usuarios; después se
mantienen 1.000 durante 60 s y se baja a cero en 15 s (más cierre de iteraciones).
El cliente pasa por el proxy de Next.js hacia Django y PostgreSQL. No descarga
HTML, JS, imágenes ni CSS por usuario, no ejecuta JavaScript y no realiza compras.
No representa 1.000 navegadores, sesiones autenticadas ni 1.000 solicitudes/s.

Se valida HTTP 200 y contenido JSON, incluyendo exactamente 50 productos.
Criterios iniciales de este proyecto: errores HTTP <1 %, checks >99 %,
latencia p95 <1.000 ms global y para listado/detalle. Son objetivos de prueba,
no garantías de capacidad. Una salida no cero puede indicar umbrales incumplidos.

Las ventanas del analizador agrupan solicitudes por hora de finalización, con
origen aproximado; no atribuyen latencia a una concurrencia exacta constante.
La última ventana puede ser parcial. El p95 global no describe por sí solo el
minuto de 1.000 usuarios. Consultar también las ventanas de ese período.

## Navegador

Medir `http://localhost:3010/catalogo` con Chrome DevTools antes de la carga:
escritorio 1440×900 sin limitación y móvil 390×844, CPU 4× y Slow 4G,
recarga sin caché. Las trazas son mediciones de laboratorio, no datos de usuarios
reales. LCP y CLS no sustituyen una medición de INP con interacciones.

## Instrumentación y consultas

La configuración `loadtest` activa `RequestPerformanceMiddleware`. Añade
`Server-Timing` y registra fecha, proceso, ruta normalizada, estado HTTP, duración
de Django, número de consultas y tiempo acumulado de ejecución SQL en
`.runtime/loadtest/requests.log`. No registra SQL, parámetros, cuerpos ni cookies.
Los eventos Waitress/Django van a `server.log`; ambos archivos tienen rotación.
La medición empieza al entrar en Django: no mide directamente la cola de Waitress,
el proxy ni toda la apertura de conexión. No restar percentiles de poblaciones
distintas para atribuir exactamente tiempo a la cola.

El middleware no se instala en los ajustes normales de producción o de tests.
Solo actúa al habilitar `PERFORMANCE_LOG_ENABLED` y añadirlo a `MIDDLEWARE`.
La conexión medida actualmente es la base `default` y el caso es WSGI síncrono.
`db_ms` mide la llamada al driver, con red y planificación del hilo; no equivale
al tiempo puro de ejecución que informa PostgreSQL mediante EXPLAIN ANALYZE.

```powershell
backend/.venv/Scripts/python backend/scripts/profile_catalog.py .runtime/loadtest/profile-after.json
backend/.venv/Scripts/python backend/scripts/profile_catalog.py .runtime/loadtest/plans-after.json --explain-source .runtime/loadtest/profile-after.json
```

El perfil hace cinco peticiones calientes por endpoint sin el proxy HTTP y
conserva las consultas, con valores exclusivamente sintéticos de la base aislada.
EXPLAIN ANALYZE solo acepta SELECT capturados y el servidor PostgreSQL local.
No ejecutar el perfil, compilaciones ni suites de tests durante una medición de carga.

Para resumir las medidas de Django del mismo intervalo de un escalón:

```powershell
$stepState = docker inspect tti-step-after-100 --format '{{json .State}}' | ConvertFrom-Json
backend/.venv/Scripts/python scripts/load/analyze_requests.py .runtime/loadtest/requests.log --since $stepState.StartedAt --until $stepState.FinishedAt
```

Se compararon 8, 16 y 32 hilos mediante `loadtest.py serve --threads NUMERO`.
El valor predeterminado sigue en 16. No cambiar el servidor durante un escalón.
Para verificar regresiones sin compartir la base de otros tests:

```powershell
cd backend
.venv/Scripts/python -m pytest --ds=config.settings.performance_test tests/test_public_catalog.py tests/test_public_taxonomy.py tests/test_promotions.py tests/test_performance.py -q
```

Esta última configuración crea su propia base `test_tti_performance`.

## Interpretación

El generador, PostgreSQL, Django y Next.js comparten el mismo ordenador.
No extrapolar estos resultados a producción. No se prueba pago, correo ni WhatsApp.
Las imágenes reales y las operaciones autenticadas requieren pruebas posteriores.
Para detener los servidores usar Ctrl+C en sus terminales; no borrar las bases
o volúmenes normales para limpiar una prueba.

Referencias: [métricas de k6](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)
y [Core Web Vitals](https://web.dev/articles/vitals).
