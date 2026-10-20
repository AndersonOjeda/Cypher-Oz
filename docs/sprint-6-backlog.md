# Sprint 6 — Backlog

> **Sprint 6 | CO Sprint 6 | 3 nov 2026**  
> **Velocidad objetivo**: 29 SP · **Historias**: 4 · **Subtareas**: 13  
> **Estado**: ✅ **100% COMPLETADO Y CERRADO EN JIRA**

---

## Resumen

| Issue Key | Tipo | Historia | SP | Prioridad | Estado | Épica |
|-----------|------|----------|----|-----------|--------|-------|
| **CO-44** | Historia | HU-15 — Verificar y resolver pago | 8 | 🔴 Highest | 🟢 Listo | EP-06 (CO-50) |
| **CO-40** | Historia | HU-16 — Consulta y seguimiento de pedidos | 5 | 🔴 Highest | 🟢 Listo | EP-07 (CO-27) |
| **CO-43** | Historia | HU-17 — Gestión administrativa del pedido | 8 | 🔴 Highest | 🟢 Listo | EP-07 (CO-27) |
| **CO-61** | Historia | HU-18 — Cancelación de pedidos | 8 | 🔴 Highest | 🟢 Listo | EP-07 (CO-27) |

---

## CO-44 — HU-15: Verificar y resolver pago (8 SP)

**Como** administrador, **quiero** verificar los fondos y confirmar o rechazar los pagos reportados **para** preparar únicamente pedidos con pago validado.

### Reglas de implementación
- `GET /admin/payments/?status=REPORTED` y `POST /admin/payments/{id}/confirm|reject/`
- Verificar dinero real; registrar responsable/fecha/referencia
- Scheduler simple T1/T2 sin Celery/Redis
- Política de vencimiento T2, plazo de corrección tras Rechazado
- Transición coherente al confirmar

### Dependencias
- HU-14 (Sprint 5)

### Subtareas

| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-130 | HU-15-T01 — Definir política de resolución y vencimiento de pagos | 🟢 Listo |
| CO-131 | HU-15-T02 — Implementar revisión de pagos y scheduler T1/T2 | 🟢 Listo |
| CO-132 | HU-15-T03 — Construir bandeja administrativa de pagos | 🟢 Listo |
| CO-133 | HU-15-T04 — Validar decisiones, vencimientos y concurrencia | 🟢 Listo |

---

## CO-40 — HU-16: Consulta y seguimiento de pedidos (5 SP)

**Como** cliente, **quiero** consultar mis pedidos y sus estados **para** conocer el avance de mis compras.

### Reglas de implementación
- `GET /orders/` y `/orders/{number}/`
- Solo pedidos propios; estados de pedido y pago separados
- Historial y snapshots

### Dependencias
- HU-12 (Sprint 5)

### Subtareas

| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-134 | HU-16-T01 — Exponer pedidos, detalle e historial propios | 🟢 Listo |
| CO-135 | HU-16-T02 — Construir mis pedidos y detalle | 🟢 Listo |
| CO-136 | HU-16-T03 — Validar seguimiento y protección de datos | 🟢 Listo |

---

## CO-43 — HU-17: Gestión administrativa del pedido (8 SP)

**Como** administrador, **quiero** consultar y avanzar los pedidos mediante transiciones válidas **para** controlar su preparación y entrega.

### Reglas de implementación
- `GET /admin/orders/` y `POST /admin/orders/{number}/transition/`
- Preparando, Enviado y Entregado requieren pago **Confirmado**; devolver `409 PAYMENT_NOT_CONFIRMED` si no
- Auditar transición
- Resolver con HU-15 el paso desde Reportado a preparación

### Dependencias
- HU-12, HU-15

### Subtareas

| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-137 | HU-17-T01 — Implementar gestión y transiciones administrativas | 🟢 Listo |
| CO-138 | HU-17-T02 — Construir panel de gestión de pedidos | 🟢 Listo |
| CO-139 | HU-17-T03 — Validar máquina de estados de pedidos | 🟢 Listo |

---

## CO-61 — HU-18: Cancelación de pedidos (8 SP)

**Como** cliente o administrador autorizado, **quiero** cancelar un pedido cuando las reglas lo permitan **para** resolver la compra y liberar el inventario afectado.

### Reglas de implementación
- `POST /orders/{number}/cancel/`
- Cancelación válida atómica y reversión una sola vez con movimiento `CANCELLATION`
- Denegar en estados Enviado/Entregado y repeticiones inconsistentes
- No asumir reembolso/cancelación de pago confirmado

### Dependencias
- HU-12, HU-17, HU-25

### Subtareas

| Key | Subtarea | Estado |
|-----|----------|--------|
| CO-140 | HU-18-T01 — Implementar cancelación atómica y permisos | 🟢 Listo |
| CO-141 | HU-18-T02 — Construir solicitud y confirmación de cancelación | 🟢 Listo |
| CO-142 | HU-18-T03 — Validar cancelación y restitución única | 🟢 Listo |

---

## Entregables Verificados

- **Documentación**: [payment-resolution-policy.md](payment-resolution-policy.md), [sprint-6-report.md](sprint-6-report.md).
- **Backend**:
  - `backend/apps/orders/services.py`: `confirm_payment`, `reject_payment`, `transition_order`, `cancel_order_by_user_or_admin`.
  - `backend/apps/orders/views.py`: `AdminPaymentListView`, `AdminPaymentConfirmView`, `AdminPaymentRejectView`, `AdminOrderListView`, `AdminOrderDetailView`, `AdminOrderTransitionView`, `OrderCancelView`.
  - `backend/apps/orders/urls.py`: Rutas registradas bajo `/api/v1/`.
  - `backend/tests/test_sprint6_backend.py`: 13 pruebas automatizadas (100% pasando).
- **Frontend**:
  - `frontend/src/features/orders/admin-payment-list.tsx`: Bandeja de verificación de pagos con confirmación y rechazo.
  - `frontend/src/app/admin/pagos/page.tsx`: Página administrativa de pagos.
  - `frontend/src/features/orders/admin-order-list.tsx`: Panel administrativo de pedidos con transiciones protegidas.
  - `frontend/src/app/admin/pedidos/page.tsx`: Página administrativa de pedidos.
  - `frontend/src/features/orders/orders.tsx`: Stepper de 5 fases, visualización de historial y modal de cancelación para clientes.
  - `frontend/src/features/orders/sprint6-features.test.tsx`: 5 pruebas unitarias y de integración.
  - Vitest: 96 pruebas frontend pasando (100%).
  - Next.js: Compilación y build de producción exitoso.

