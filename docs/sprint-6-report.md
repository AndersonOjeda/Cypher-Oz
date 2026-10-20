# Informe de Cierre: Sprint 6

Fecha: 20 de octubre de 2026, America/Bogota.  
Proyecto: Cypher-Oz (TTI).  
Tablero: CO (2), Sprint 76, «CO Sprint 6 | 3 nov 2026».  
Alcance planificado: 4 Historias de Usuario, 13 Subtareas, 29 Story Points.  
Estado final: **100% Completado y Verificado**.

---

## 1. Resumen Ejecutivo del Sprint 6

En este Sprint 6 se completó el ciclo integral de verificación de pagos por transferencia bancaria, seguimiento visual de pedidos por el cliente, gestión administrativa de ciclo de vida con transiciones protegidas, y cancelación atómica de pedidos con restitución estricta de inventario enlazada al movimiento de venta original.

| Historia | Resumen | SP | Estado Jira | Evidencias y Verificación |
|---|---|---|---|---|
| **CO-44 (HU-15)** | Verificar y resolver pago | 8 | ✅ Listo | Bandeja `/admin/pagos`, confirmación y rechazo con auditoría y SLA T1/T2. |
| **CO-40 (HU-16)** | Consulta y seguimiento de pedidos | 5 | ✅ Listo | Stepper de 5 fases en `/pedidos/{number}`, historial de transiciones y protección de datos. |
| **CO-43 (HU-17)** | Gestión administrativa del pedido | 8 | ✅ Listo | Panel `/admin/pedidos`, transiciones protegidas por pago confirmado (`409 PAYMENT_NOT_CONFIRMED`). |
| **CO-61 (HU-18)** | Cancelación de pedidos | 8 | ✅ Listo | Cancelación atómica cliente/admin en `/orders/{number}/cancel/`, movimiento `CANCELLATION` con `reversal_of`. |
| **Total** | **4 Historias / 13 Subtareas** | **29 SP** | **100%** | **Backend (13 tests), Frontend (96 tests), Build OK** |

---

## 2. Detalle de Implementación por Historia

### CO-44 — HU-15: Verificar y resolver pago (8 SP)
- **Subtareas**:
  - `CO-130`: Definición formal de la política de resolución y vencimiento en `docs/payment-resolution-policy.md`.
  - `CO-131`: Endpoints backend:
    - `GET /api/v1/admin/payments/?status=REPORTED` (con soporte para filtrar por estado y búsqueda).
    - `POST /api/v1/admin/payments/{id}/confirm/` (validación de fondos, transición a `CONFIRMED`, registro en `PaymentStatusHistory`).
    - `POST /api/v1/admin/payments/{id}/reject/` (exigencia de motivo no vacío, transición a `REJECTED`, registro en `PaymentStatusHistory`).
  - `CO-132`: Bandeja administrativa `/admin/pagos` con componente `AdminPaymentList`, filtrado reactivo, confirmación y modal de rechazo.
  - `CO-133`: Pruebas automatizadas de concurrencia y validaciones de estado.

### CO-40 — HU-16: Consulta y seguimiento de pedidos (5 SP)
- **Subtareas**:
  - `CO-134`: Serialización enriquecida con `OrderStatusHistorySerializer` y `PaymentStatusHistorySerializer`. Aislamiento estricto de pedidos ajenos (404 Not Found).
  - `CO-135`: Componente de seguimiento `OrderDetail` en `/pedidos/[number]` con stepper visual de 5 etapas:
    1. Registrado
    2. Pago (Reportado / Rechazado / Verificado)
    3. Preparación
    4. En camino
    5. Entregado
  - `CO-136`: Desglose detallado de productos, dirección, método de entrega e historial cronológico con actor responsable.

### CO-43 — HU-17: Gestión administrativa del pedido (8 SP)
- **Subtareas**:
  - `CO-137`: Máquina de estados administrativa:
    - `GET /api/v1/admin/orders/` con búsqueda y filtros.
    - `POST /api/v1/admin/orders/{number}/transition/` para avanzar `PENDING -> PREPARING -> SHIPPED -> DELIVERED`.
    - **Regla de oro**: Si el pago no está `CONFIRMED`, avanzar a `PREPARING` genera error `409 Conflict` con código `PAYMENT_NOT_CONFIRMED`.
  - `CO-138`: Panel administrativo `/admin/pedidos` con componente `AdminOrderList`, botones contextuales para avance de fase y modal de auditoría.
  - `CO-139`: Pruebas automatizadas de ciclo de vida completo.

### CO-61 — HU-18: Cancelación de pedidos (8 SP)
- **Subtareas**:
  - `CO-140`: Endpoint autoritativo `POST /api/v1/orders/{number}/cancel/`:
    - Cliente: puede cancelar pedidos en estado `PENDING` con pago no confirmado. Se deniega si el pago ya fue confirmado para evitar inconsistencias de fondos.
    - Admin: puede cancelar pedidos en `PENDING` o `PREPARING`. Se deniega para pedidos `SHIPPED` o `DELIVERED`.
    - Atómico: en la misma transacción se cambia `order.status = CANCELLED`, se registra en `OrderStatusHistory` y se invoca `restore_cancelled_order_inventory`.
    - Inventario: se genera un movimiento `StockMovement` con tipo `CANCELLATION`, enlazado mediante la relación OneToOne `reversal_of` a la venta original `SALE`.
  - `CO-141`: Interfaz accesible con modales de confirmación de cancelación en detalle del cliente y panel admin.
  - `CO-142`: Validación de restitución única contra carreras y balances.

---

## 3. Métricas de Calidad y Pruebas

- **Backend Tests**:
  - `test_sprint6_backend.py`: 13/13 pasadas (100%).
  - `test_sprint5_backend.py`: 16/16 pasadas (100%).
  - `test_order_expiration.py`: 20/20 pasadas (100%).
  - `test_orders.py`: 48/48 pasadas (100%).
  - **Total backend verificado**: 97 pruebas automatizadas aprobadas.
- **Backend Linting**:
  - Ruff: `All checks passed!`
  - Django Check: `System check identified no issues (0 silenced)`.
- **Frontend Tests**:
  - Vitest: 21 archivos de pruebas, 96 pruebas unitarias y de integración pasadas (100%).
- **Frontend Build**:
  - Next.js Turbopack: Compilación exitosa, TypeScript 0 errores, 18 rutas estáticas y dinámicas generadas.

