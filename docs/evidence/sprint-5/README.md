# Evidencias de la auditoría del Sprint 5

## Continuación para completar el cierre

`expiration.xml`: 20/20 pruebas del runner T1 aprobadas, incluidas carreras reales
de reporte–vencimiento en ambos órdenes y dos runners superpuestos. Se observa
la espera de locks de PostgreSQL; no se simula la decisión del proceso de vencimiento.
`expiration-first-run.xml` conserva 1 fallo/17 aprobadas de la primera versión
del fixture; la repetición añadió dos regresiones y aprobó sus 20 casos.
La regresión completa de esta continuación se publica en los checks de PR #21 y
su artefacto CI para el SHA integrado; los resultados siguientes son históricos.

Ejecución local del 20/10/2026. Fuentes revisadas: `fc9dfa4`, `3ae0a3c` y la
integración con main. Correcciones en rama `review/sprint-5-verification`.

| Comprobación ejecutada | Resultado | Artefacto |
|---|---|---|
| Backend completo PostgreSQL (`config.settings.performance_test`) | 281 aprobadas, 0 fallos, 559,87 s | `backend.xml` |
| Pedidos + Sprint 5, ejecución focal anterior | 63 aprobadas; después se añadió el caso GET histórico incluido en las 281 | `orders-focused.xml` |
| Frontend completo Vitest | 89 aprobadas, 20 archivos | `frontend.xml` |
| E2E completo inicial | 42 anteriores aprobadas; 3 nuevos casos fallaron por falta de description en el fixture | `browser-first-run.xml` |
| E2E Sprint 5 después de corregir el fixture | 3 aprobadas: móvil 390×844, tablet 768×1024, desktop 1440×900 | `browser-sprint5.xml`, `payment-*.png` |
| Wireframes | 28 aprobados: teclado/foco, contraste, overflow y estados | `wireframes-checks.json` |
| Chrome DevTools MCP | Catálogo/API 200, sin alertas ni overflow | `chrome-smoke.txt` |
| Ruff lint y formato, Django check, makemigrations --check | Aprobados; sin migraciones pendientes de generar | Consola de ejecución |
| ESLint, tipos y build Next.js | Aprobados | Consola de ejecución |

Se conserva el primer XML fallido: no se presenta como una ejecución única de 45/45.
Los 42 casos anteriores y los tres nuevos aprobados suman cobertura de 45 casos;
la única modificación posterior a esa regresión fue completar el fixture nuevo.
La suite de CI ejecuta nuevamente los 45 juntos y publica sus propios resultados.

Comandos desde backend y frontend respectivamente:

```powershell
.venv/Scripts/python.exe -m pytest --ds=config.settings.performance_test -q --junitxml=../docs/evidence/sprint-5/backend.xml
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m ruff format --check .
.venv/Scripts/python.exe manage.py makemigrations --check --dry-run
.venv/Scripts/python.exe manage.py check
npm run lint
npm run typecheck
npm test -- --reporter=dot --reporter=junit --outputFile=../docs/evidence/sprint-5/frontend.xml
npm run build
$env:PLAYWRIGHT_JUNIT_OUTPUT_NAME='../docs/evidence/sprint-5/browser.xml'
npm run test:e2e -- --reporter=list,html,junit
npm run test:e2e -- sprint5.spec.ts --reporter=list,html,junit
node scripts/verify-wireframes.mjs
```

Para los comandos ejecutados desde backend, la salida documental deseada en este
repositorio es `../docs/...`; usar esa ruta al reproducir. Los XML aquí archivados
proceden de las ejecuciones reales, aunque sus rutas originales de salida fueron
temporales. E2E usa la base local exclusiva `tti_e2e`; pytest usa `test_tti_performance`.

Smoke público: `https://cypher-oz.vercel.app/catalogo`,
`https://tti-staging-api.onrender.com/health/` y el proxy
`https://cypher-oz.vercel.app/api/v1/products/` respondieron HTTP 200.
Health devolvió `status=ok`, `database=postgresql`. No se hicieron escrituras remotas.

No se ejecutó Lighthouse ni carga de 1.000 usuarios en esta revisión. El runner T1
añadido en la continuación verifica CO-129 A4; la resolución T2 sigue en Sprint 6. Las capturas
muestran datos de prueba sintéticos y no acreditan despliegue de esta rama.
