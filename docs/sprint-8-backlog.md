# Sprint 8 — Backlog

Las tablas de estado siguientes conservan la planificación inicial. La verificación
posterior y los criterios todavía pendientes están en el [informe vigente](sprint-8-report.md).

> **Sprint 8 | Sprint 08 | Confianza (Jira ID: 78)**\
> **Épica**: `CO-183` — EP-14 | Confianza y reputación\
> **Velocidad objetivo**: 13 SP iniciales (puntos solo en historias)\
> **Historias**: 4 · **Subtareas**: 12 · **Actividades**: 48\
> **Orden obligatorio**: `HU-33` (`CO-184`) → `HU-34` (`CO-185`) → `HU-35` (`CO-186`); `HU-36` (`CO-187`) en paralelo.\
> **Orden por historia**: Backend (`T01`) → Frontend (`T02`) → QA y Evidencias (`T03`).

---

## Resumen del Sprint 8

| Issue Key | Tipo | Título / Historia | SP | Orden | Estado | Épica |
|-----------|------|-------------------|----|-------|--------|-------|
| **CO-183** | Épica | EP-14 \| Confianza y reputación | — | Transversal | 🔵 En curso | — |
| **CO-184** | Historia | HU-33 \| Publicar y editar reseñas de compras verificadas | 5 | 1 | 🔵 En curso | EP-14 (CO-183) |
| **CO-185** | Historia | HU-34 \| Consultar opiniones y calificaciones de productos | 3 | 2 | ⚪ Por hacer | EP-14 (CO-183) |
| **CO-186** | Historia | HU-35 \| Reportar y moderar reseñas con trazabilidad | 3 | 3 | ⚪ Por hacer | EP-14 (CO-183) |
| **CO-187** | Historia | HU-36 \| Consultar información visible y coherente de compra | 2 | Paralelo | 🔵 En curso | EP-14 (CO-183) |

---

## CO-184 — HU-33: Publicar y editar reseñas de compras verificadas (5 SP)

**Como** cliente con una compra entregada, **quiero** calificar y comentar el producto **para** compartir mi experiencia con otros compradores.

### Reglas e implementación
- Entidad reseña (`product_reviews`) con cliente (`user`), producto (`product`), `order_item` de respaldo, puntuación entera `1..5`, comentario de texto plano `1..1000` caracteres tras trim, fechas y visibilidad (`VISIBLE` / `HIDDEN`).
- Unicidad `cliente/producto` en PostgreSQL (`UniqueConstraint(fields=["user", "product"])`).
- El servidor deriva autor, producto y compra verificada a través de `order_item.variant_id` sobre un pedido propio con estado `DELIVERED` y pago `CONFIRMED`; no confía en campos enviados desde el navegador.
- Reintentos y envíos simultáneos no crean duplicados.
- Una nueva compra del mismo producto permite editar la reseña existente.
- Ediciones conservan vínculo (`order_item`) y trazabilidad; no rehabilitan una reseña oculta (`HIDDEN`).
- Casos de prueba mínimos: `CP-REV-01`, `CP-REV-02`, `CP-REV-03`, `CP-REV-04`, `CP-REV-05`.

### Subtareas
| Key | Subtarea | Especialidad | Estado |
|-----|----------|--------------|--------|
| **CO-188** | HU-33-T01 \| Diseñar persistencia y API de reseñas verificadas | Backend | 🔵 En curso |
| **CO-189** | HU-33-T02 \| Construir formulario de reseña desde la compra entregada | Frontend | ⚪ Por hacer |
| **CO-190** | HU-33-T03 \| Validar compra verificada, autoría y unicidad | QA | ⚪ Por hacer |

---

## CO-185 — HU-34: Consultar opiniones y calificaciones de productos (3 SP)

**Como** visitante o cliente, **quiero** consultar opiniones de compras verificadas y la calificación del producto **para** decidir mi compra con mayor confianza.

### Reglas e implementación
- Lectura pública sin autenticación (`GET /api/v1/products/<slug>/reviews/` y resumen en detalle de producto).
- Promedio aritmético por producto sobre reseñas `VISIBLE`, mostrado con un decimal (`3,7`, `4,0`, `4,5`) y conteo de reseñas visibles.
- Cero reseñas visibles: promedio nulo (`null`) y mensaje explícito `"Este producto aún no tiene reseñas"`.
- Reseñas de distintas variantes del mismo producto contribuyen al mismo promedio; otros productos permanecen aislados.
- Orden descendente por `created_at` e `id` para estabilidad; paginación acotada.
- Mostrar nombre público reducido, fechas, indicador de edición y etiqueta `Compra verificada`; nunca exponer email, direcciones ni identificadores internos de compra.
- Casos de prueba mínimos: `CP-REV-06`, `CP-REV-07`, `CP-REV-08`, `CP-REV-09`.

### Subtareas
| Key | Subtarea | Especialidad | Estado |
|-----|----------|--------------|--------|
| **CO-191** | HU-34-T01 \| Exponer listado público y agregados de reseñas | Backend | ⚪ Por hacer |
| **CO-192** | HU-34-T02 \| Mostrar calificaciones y opiniones en el producto | Frontend | ⚪ Por hacer |
| **CO-193** | HU-34-T03 \| Verificar agregados, privacidad y consulta pública | QA | ⚪ Por hacer |

---

## CO-186 — HU-35: Reportar y moderar reseñas con trazabilidad (3 SP)

**Como** cliente, **quiero** reportar opiniones inapropiadas, y **como** administrador **quiero** revisarlas con un motivo registrado **para** mantener un espacio de opiniones confiable.

### Reglas e implementación
- Cliente autenticado reporta una reseña visible con motivo; máximo un reporte activo (`OPEN`) por `cliente/reseña`.
- Un reporte nuevo no oculta la reseña ni altera el promedio automáticamente.
- Administrador autorizado consulta reportes y puede descartarlos (`DISMISS_REPORTS`), ocultar (`HIDE`) o restaurar (`RESTORE`) una reseña con motivo obligatorio, registrando actor, fecha, acción y conservando el contenido original para auditoría privada (`review_moderation_logs`).
- Opiniones de 1 estrella válidas permanecen visibles; una valoración negativa no es motivo de retirada.
- Edición del autor sobre una reseña oculta no la republica; reintentos de moderación no producen doble efecto.
- Casos de prueba mínimos: `CP-REV-10`, `CP-REV-11`, `CP-REV-12`, `CP-REV-13`.

### Subtareas
| Key | Subtarea | Especialidad | Estado |
|-----|----------|--------------|--------|
| **CO-194** | HU-35-T01 \| Implementar reportes y moderación auditada | Backend | ⚪ Por hacer |
| **CO-195** | HU-35-T02 \| Construir reporte y revisión administrativa | Frontend | ⚪ Por hacer |
| **CO-196** | HU-35-T03 \| Validar moderación y coherencia pública | QA | ⚪ Por hacer |

---

## CO-187 — HU-36: Consultar información visible y coherente de compra (2 SP)

**Como** visitante o comprador, **quiero** encontrar información clara de pago, entrega, garantía y atención **para** saber cómo comprar y resolver dudas antes de confirmar.

### Reglas e implementación
- Reutiliza datos, componentes y reglas vigentes (`CO-34` garantía, `CO-59/60` pago externo, `CO-70` entrega, `CO-41/72` WhatsApp, `CO-22` configuración).
- Accesible desde detalle de producto (`/catalogo/[slug]`) y flujo de compra (`/comprar`) sin exigir cuenta.
- Diferencia explícitamente **Pago Reportado** y **Pago Confirmado**, aclarando que enviar comprobante o escribir por WhatsApp no confirma el pago automáticamente.
- Cobertura, tarifa urbana y umbral de envío gratuito provienen de la configuración activa; zona especial (`SPECIAL`) informa cotización pendiente.
- Garantía proviene del campo aprobado del producto (`product.warranty`) e identifica cualquier dato pendiente sin inventar plazos ni promesas.
- Canal de contacto usa el WhatsApp configurado; si no está habilitado o configurado, informa su indisponibilidad sin generar números ficticios.
- Casos de prueba mínimos: `CP-CONF-01`, `CP-CONF-02`, `CP-CONF-03`, `CP-CONF-04`.

### Subtareas
| Key | Subtarea | Especialidad | Estado |
|-----|----------|--------------|--------|
| **CO-197** | HU-36-T01 \| Consolidar fuentes vigentes de información comercial | Backend | 🔵 En curso |
| **CO-198** | HU-36-T02 \| Presentar información de compra en puntos de decisión | Frontend | ⚪ Por hacer |
| **CO-199** | HU-36-T03 \| Validar claridad y consistencia de información de compra | QA | ⚪ Por hacer |
