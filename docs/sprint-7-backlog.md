# Sprint 7 — Backlog

> **Sprint 7 | CO Sprint 7 | 10 nov 2026**  
> **Velocidad objetivo**: 16 SP funcionales + Tareas transversales  
> **Historias**: 3 · **Tareas transversales**: 4 · **Subtareas**: 9  
> **Estado del Sprint**: ✅ **COMPLETADO (100%)**

---

## Resumen

| Issue Key | Tipo | Título / Historia | SP | Prioridad | Estado | Épica |
|-----------|------|-------------------|----|-----------|--------|-------|
| **CO-71** | Historia | HU-29 — Gestión administrativa de entrega | 5 | 🔴 Highest | 🟢 Listo | EP-11 (CO-53) |
| **CO-72** | Historia | HU-31 — WhatsApp contextual desde pedido | 3 | 🟠 High | 🟢 Listo | EP-12 (CO-54) |
| **CO-35** | Historia | HU-07 — Comparación de productos | 8 | 🟡 Medium | 🟢 Listo | EP-03 (CO-48) |
| **CO-10** | Tarea | SEG — Permisos, sesión y protección de datos | — | 🔴 Highest | 🟢 Listo | EP-01 (CO-25) |
| **CO-45** | Tarea | QA — Pruebas continuas y regresión final MVP | — | 🔴 Highest | 🟢 Listo | EP-01 (CO-25) |
| **CO-46** | Tarea | OPS — Desplegar y verificar frontend, API, datos y scheduler | — | 🔴 Highest | 🟢 Listo | EP-01 (CO-25) |
| **CO-47** | Tarea | DOC — Trazabilidad, manuales y evidencias de entrega | — | 🔴 Highest | 🟢 Listo | EP-01 (CO-25) |

---

## CO-71 — HU-29: Gestión administrativa de entrega (5 SP)

**Como** administrador, **quiero** consultar los datos de entrega del pedido **para** coordinar su despacho y registrar el avance permitido.

### Reglas de implementación
- Datos en `order_deliveries` almacenados como snapshot inmutable.
- Coordinación con estado válido del pedido (`PREPARING`, `SHIPPED`, `DELIVERED`) y pago confirmado.
- Exposición administrativa autorizada de destinatario, dirección completa, ciudad, departamento, teléfono y notas de entrega.
- Filtro y vista de logística/despacho en el panel de administración.

### Subtareas
| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-167 | HU-29-T01 — Exponer datos de entrega autorizados | 🟢 Listo |
| CO-168 | HU-29-T02 — Construir sección administrativa de entrega | 🟢 Listo |
| CO-169 | HU-29-T03 — Validar privacidad y coherencia de entrega | 🟢 Listo |

---

## CO-72 — HU-31: WhatsApp contextual desde pedido (3 SP)

**Como** cliente, **quiero** abrir WhatsApp desde mi pedido con su identificador **para** recibir soporte sobre esa compra.

### Reglas de implementación
- Botón / enlace interactivo de WhatsApp dentro del detalle de pedido propio (`/pedidos/[number]`).
- Mensaje prellenado contextual: `"Hola, necesito asistencia con mi pedido #[UUID]"`.
- Enlace generado mediante `https://wa.me/{store_phone}?text={mensaje}`.
- Cero efectos colaterales sobre el estado del pedido o pago al hacer clic.
- Protección de privacidad: no incluir datos bancarios ni contraseñas.

### Subtareas
| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-173 | HU-31-T01 — Preparar contexto mínimo desde pedido propio | 🟢 Listo |
| CO-174 | HU-31-T02 — Integrar contacto contextual en el detalle | 🟢 Listo |
| CO-175 | HU-31-T03 — Validar contexto, privacidad y ausencia de efectos | 🟢 Listo |

---

## CO-35 — HU-07: Comparación de productos (8 SP)

**Como** visitante o cliente, **quiero** comparar entre dos y cuatro productos compatibles **para** elegir la alternativa que mejor me conviene.

### Reglas de implementación
- Endpoint público: `GET /api/v1/products/compare/?ids=1,2,3` o `slugs=...`.
- Validación de límites: mínimo 2 y máximo 4 productos.
- Validación de compatibilidad: productos del catálogo propio pertenecientes a la misma categoría o con atributos comunes.
- Matriz comparativa: especificaciones técnicas (atributos de categoría), marca, precio, disponibilidad de stock, garantía e imagen principal.
- Interfaz en frontend: barra o modal de selección y página `/comparar`.

### Subtareas
| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-106 | HU-07-T01 — Implementar comparación del catálogo propio | 🟢 Listo |
| CO-107 | HU-07-T02 — Construir selección y tabla comparativa | 🟢 Listo |
| CO-108 | HU-07-T03 — Validar límites y atributos de comparación | 🟢 Listo |

---

## Tareas transversales del MVP

- **CO-10 (SEG)**: Auditoría y endurecimiento de endpoints, validación de sesiones, cookies HttpOnly, SameSite, CSRF y headers de seguridad. ✅ **Listo**
- **CO-45 (QA)**: Ejecución de suites de pruebas E2E, cobertura unitaria y regresión integral del sistema completo (68 tests backend + 111 tests frontend). ✅ **Listo**
- **CO-46 (OPS)**: Verificación de despliegue, rutas compiladas en Next.js (19 rutas), compatibilidad con PostgreSQL y preparación de entorno. ✅ **Listo**
- **CO-47 (DOC)**: Documentación de arquitectura final, contratos de API, manuales de administración y evidencias de aceptación del cliente. ✅ **Listo**
