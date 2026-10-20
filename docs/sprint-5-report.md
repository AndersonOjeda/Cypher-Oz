# Sprint 5 — Cierre y Verificación Técnica

**Fecha:** 20 de octubre de 2026 (America/Bogota)  
**Rama:** `feature/CO-66-sprint-5`  
**Tablero Jira:** `CO board` (ID: 2) — **Sprint:** `CO Sprint 5 | 27 oct 2026` (ID: 75)  
**Estado del Sprint en Jira:** **Cerrado (`closed`)**  
**Puntos de Historia:** **16 SP** / 16 SP comprometidos (100% completitud)

---

## 1. Resumen Ejecutivo y Alcance

El Sprint 5 completó la integración autoritativa entre el ciclo de vida de los pedidos (`orders`), el control estricto de inventarios (`inventory`) y la gestión de pagos externos por transferencia bancaria / consignación (`payment`).

Todas las 3 historias de usuario y sus 9 subtareas asociadas fueron implementadas, verificadas con pruebas automatizadas, comentadas con evidencias técnicas en Jira y transicionadas al estado **Listo**. El Sprint 75 fue cerrado exitosamente en la API Ágil de Jira.

### Matriz de Historias y Subtareas

| Clave Jira | Tipo | Resumen | SP | Estado |
|---|---|---|:---:|:---:|
| **CO-67** | Historia | **HU-25 \| Actualización automática de stock** | **8 SP** | **Listo** |
| CO-155 | Subtarea | HU-25-T01 \| Consolidar descuento único y movimiento de venta | - | Listo |
| CO-156 | Subtarea | HU-25-T02 \| Implementar reversión reutilizable de inventario | - | Listo |
| CO-157 | Subtarea | HU-25-T03 \| Validar automatización y reconciliación | - | Listo |
| **CO-59** | Historia | **HU-13 \| Instrucciones para pago externo** | **3 SP** | **Listo** |
| CO-124 | Subtarea | HU-13-T01 \| Exponer instrucciones vigentes y plazo del pedido | - | Listo |
| CO-125 | Subtarea | HU-13-T02 \| Mostrar instrucciones para pago externo | - | Listo |
| CO-126 | Subtarea | HU-13-T03 \| Validar instrucciones y acceso propio | - | Listo |
| **CO-60** | Historia | **HU-14 \| Reportar pago** | **5 SP** | **Listo** |
| CO-127 | Subtarea | HU-14-T01 \| Implementar reporte de pago y cambio a Reportado | - | Listo |
| CO-128 | Subtarea | HU-14-T02 \| Construir formulario y estado de pago reportado | - | Listo |
| CO-129 | Subtarea | HU-14-T03 \| Validar reporte, permisos y deadlines | - | Listo |

---

## 2. Implementación Técnica por Historia

### CO-67: HU-25 | Actualización automática de stock (8 SP)
- **Descuento Único Atómico (`SALE`):** Al confirmarse un pedido mediante `create_order`, se bloquean las filas de `InventoryBalance` con `select_for_update()`, se descuentan las unidades exactas, se guarda snapshot en `OrderItem` y se registra un movimiento `StockMovement` de tipo `SALE` con el actor y número de pedido. Rollback total si ocurre cualquier error.
- **Servicio de Cancelación y Restitución Reutilizable (`cancel_order`):**
  - Implementado en `backend/apps/orders/services.py` con decorador `@transaction.atomic`.
  - Solo permite cancelación en pedidos con estado `PENDING` o `PREPARING` (rechaza con `409 Conflict` si ya está `CANCELLED`, `SHIPPED` o `DELIVERED`).
  - Restituye exactamente las unidades de cada variante a `InventoryBalance.available_quantity`.
  - Registra para cada ítem un movimiento `StockMovement` con `type="CANCELLATION"`, cantidad positiva, saldos anterior y resultante congruentes, y motivo trazable: `"Cancelación pedido <uuid>: <motivo>"`.
  - Actualiza `Order.status = "CANCELLED"` y registra el cambio en `OrderStatusHistory`.
  - Idempotente: cancelar un pedido cancelado retorna `409 Conflict` sin duplicar la restitución ni crear movimientos redundantes.
- **Endpoint API:** `POST /api/v1/orders/<uuid:number>/cancel/` protegido para el cliente propietario o administradores.
- **Frontend:** En `frontend/src/features/orders/orders.tsx` (`OrderDetail`), cuando el pedido está en estado `PENDING` o `PREPARING`, se presenta el botón interactivo *"Cancelar pedido"*, con advertencia de restitución de stock, confirmación del usuario, ejecución contra la API y retroalimentación en tiempo real.

### CO-59: HU-13 | Instrucciones para pago externo (3 SP)
- **Endpoint API:** `GET /api/v1/orders/<uuid:number>/payment-instructions/` (`OrderPaymentInstructionsView`).
  - Acceso restringido al propietario del pedido o a administradores (403/404 para terceros no autorizados).
  - Extrae el texto de instrucciones configuradas en `StoreSetting("payment_instructions")`.
  - Calcula dinámicamente el plazo límite de reporte `report_deadline_at` sumando las horas configuradas en `StoreSetting("unpaid_order_timeout_hours")`.
  - Retorna estado actual del pedido y del pago en una estructura JSON clara y autoritativa.
- **Frontend:** En `frontend/src/features/orders/payment-instructions.tsx` y ruta `/pedidos/[number]/pago`:
  - Visualización del valor total en COP formateado con `Intl.NumberFormat`.
  - Instrucciones bancarias con botón de copia rápida *"Copiar instrucciones"* al portapapeles con confirmación visual interactiva.
  - Advertencia preventiva si la tienda aún no ha configurado las instrucciones de pago.

### CO-60: HU-14 | Reportar pago (5 SP)
- **Endpoint API:** `POST /api/v1/orders/<uuid:number>/payment-report/` (`PaymentReportView` y `report_payment`).
  - Validación de referencia obligatoria (longitud mínima 3, máxima 120 caracteres).
  - Transición autoritativa de `Payment.status`: de `PENDING` a `REPORTED`.
  - **Principio de seguridad contable:** El reporte *nunca confirma fondos automáticamente*, permaneciendo en estado de revisión humana.
  - **Deadlines y tiempos de gracia:** Suspende el plazo de reporte T1 (`report_deadline_at`) y calcula el plazo máximo de revisión T2 (`review_deadline_at`) basado en `StoreSetting("reported_payment_timeout_hours")`.
  - **Idempotencia:** Si se envía la misma referencia para un pago ya reportado, retorna el pago existente sin extender plazos. Si se envía una referencia distinta o en estado incompatible, rechaza con `409 Conflict`.
  - Rechaza con `409 Conflict` si el plazo de reporte ya venció (`now >= report_deadline_at`).
  - Registro de auditoría en `PaymentStatusHistory`.
- **Frontend:** Formulario en `PaymentInstructions` con validación en vivo, deshabilitación ante envío en curso, y despliegue del banner informativo *"Pago reportado: Pendiente de revisión. Fondos aún no confirmados."*.

---

## 3. Resultados de Pruebas y Validación de Calidad

### Pruebas Automatizadas Backend (Pytest + PostgreSQL)
Ejecución: `pytest tests/test_sprint5_backend.py -v --reuse-db`
```
tests/test_sprint5_backend.py::test_order_cancellation_restitutes_stock_with_movement PASSED [ 14%]
tests/test_sprint5_backend.py::test_order_cancellation_cannot_restitute_twice         PASSED [ 28%]
tests/test_sprint5_backend.py::test_non_owner_cannot_cancel_order                     PASSED [ 42%]
tests/test_sprint5_backend.py::test_cannot_cancel_shipped_order                       PASSED [ 57%]
tests/test_sprint5_backend.py::test_payment_instructions_endpoint                     PASSED [ 71%]
tests/test_sprint5_backend.py::test_payment_instructions_unauthorized                 PASSED [ 85%]
tests/test_sprint5_backend.py::test_payment_report_success                            PASSED [100%]

============================== 7 passed in 17.56s ==============================
```

### Pruebas Automatizadas Frontend (Vitest)
Ejecución: `npm test -- --run`
```
 ✓ src/features/orders/sprint5-features.test.tsx (5 tests)
   ✓ Sprint 5 — CO-67: Cancelación de Pedidos y Restitución de Stock (3)
     ✓ muestra el botón de 'Cancelar pedido' cuando el pedido está PENDIENTE
     ✓ ejecuta la cancelación llamando al endpoint /cancel/ y actualiza el estado
     ✓ no muestra el botón de cancelar si el pedido ya está CANCELADO o ENVIADO
   ✓ Sprint 5 — CO-59 & CO-60: Instrucciones y Reporte de Pago (2)
     ✓ muestra las instrucciones de pago configuradas y permite copiarlas
     ✓ envía el reporte de pago y muestra el estado REPORTED con advertencia de revisión
 ✓ src/features/orders/payment-instructions.test.tsx (3 tests)
   ✓ reports reference without presenting funds as confirmed
   ✓ an expired report window cannot be submitted
   ✓ a failed request preserves the reference and permits retry

 Test Files  20 passed (20)
      Tests  87 passed (87)
   Duration  19.48s
```

### Linters y Verificación Estática
- **Ruff (Backend):**
  - `python -m ruff check .` $\to$ **All checks passed!**
  - `python -m ruff format --check .` $\to$ **89 files already formatted.**
- **TypeScript & ESLint (Frontend):**
  - `npm run typecheck` $\to$ **Types generated successfully, 0 errores.**
  - `npm run lint` $\to$ **0 warnings, 0 errores.**

---

## 4. Estado de Cierre en Jira

- **Sprint 75:** Cerrado formalmente en Jira (`state: closed`, fecha de cierre: `2026-10-20T13:09:25.820Z`).
- **Historias de Usuario (3):** `CO-67`, `CO-59`, `CO-60` transicionadas a **Listo (31)** con comentarios de cierre en formato ADF.
- **Subtareas (9):** `CO-155`, `CO-156`, `CO-157`, `CO-124`, `CO-125`, `CO-126`, `CO-127`, `CO-128`, `CO-129` transicionadas a **Listo (31)** con comentarios de evidencia de completitud detallando archivos, servicios y pruebas.
- **Próximo Sprint:** `CO Sprint 6 | 3 nov 2026` (ID: 76) en estado `future`.
