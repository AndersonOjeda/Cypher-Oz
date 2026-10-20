# Sprint 4 — Reporte Final de Cierre

Ejecución: 19–20 de octubre de 2026, America/Bogota (`2026-10-20T01:37:41.533Z`).
Alcance oficial: **21 SP**. Sprint 3 verificado y cerrado previamente en Jira.

**SPRINT COMPLETADO**: Todo el alcance fue implementado, validado con pruebas automatizadas y aceptado.
**21/21 SP en estado Listo**, con suite completa de pruebas unitarias y de integración pasando al 100%.
Cierre formal registrado en Jira Agile:
`id=74`, `state=closed`, `completeDate=2026-10-20T01:37:41.533Z`.

---

## 1. Historias de Usuario, Jira y Story Points

| Clave | Historia | SP | Prioridad | Épica | Implementación | Estado Jira |
|---|---|---:|---|---|---|---|
| [CO-62](https://cypher-oz.atlassian.net/browse/CO-62) | HU-19 \| Consulta administrativa de clientes | 3 | P1 High | EP-07 (CO-27) | Implementada, probada y aceptada | **Listo** |
| [CO-37](https://cypher-oz.atlassian.net/browse/CO-37) | HU-10 \| Identificación al momento de comprar | 5 | P0 Highest | EP-05 (CO-49) | Implementada, probada y aceptada | **Listo** |
| [CO-70](https://cypher-oz.atlassian.net/browse/CO-70) | HU-28 \| Condiciones y costo de entrega | 5 | P0 Highest | EP-11 (CO-53) | Implementada, probada y aceptada | **Listo** |
| [CO-57](https://cypher-oz.atlassian.net/browse/CO-57) | HU-09 \| Revalidación del carrito | 8 | P0 Highest | EP-04 (CO-25) | Implementada, probada y aceptada | **Listo** |

**Total: 21/21 SP completados y aceptados en historias Done.**
Tablero Jira: **CO board (id: 2)** — Sprint Jira: **CO Sprint 4 \| 20 oct 2026 (id: 74)**.

### Subtareas Ejecutadas y Aceptadas (12 subtareas / 100% Listo)
- **CO-143** (HU-19-T01): Exponer consulta administrativa de clientes (`GET /api/v1/admin/customers/`).
- **CO-144** (HU-19-T02): Construir consulta de clientes para administración (UI React en `/admin/clientes`).
- **CO-145** (HU-19-T03): Validar privacidad y permisos de clientes (protección RBAC `IsAdmin`, datos mínimos sin fuga).
- **CO-115** (HU-10-T01): Proteger operaciones de compra autenticadas (`/checkout/preview/` y `/orders/`).
- **CO-116** (HU-10-T02): Conservar carrito y retorno tras autenticación (`tti.purchase.cart` + `next=/comprar`).
- **CO-117** (HU-10-T03): Validar autenticación tardía (pruebas de flujo anónimo a compra autenticada).
- **CO-164** (HU-28-T01): Implementar cotización de entrega por cobertura (`POST /api/v1/delivery/quote/`).
- **CO-165** (HU-28-T02): Construir selección de entrega y costo (componente `DeliverySelector`).
- **CO-166** (HU-28-T03): Validar cobertura, umbral y tarifa pendiente (tarifa plana \$5.000, umbral \$100.000, bloqueo especial).
- **CO-112** (HU-09-T01): Implementar revalidación autoritativa del carrito (`POST /api/v1/checkout/validate/`).
- **CO-113** (HU-09-T02): Mostrar cambios y bloqueos del carrito (componente `CartValidator`).
- **CO-114** (HU-09-T03): Validar inactivos, precios y stock obsoletos (detección en tiempo real contra DB).

---

## 2. Backend y Base de Datos (Django + PostgreSQL)

1. **Consulta Administrativa de Clientes (`AdminCustomerListView`)**:
   - `GET /api/v1/admin/customers/`
   - Permiso estricto `[IsAuthenticated, IsAdmin]`. Anónimos reciben `401 Unauthorized` y clientes regulares `403 Forbidden`.
   - Consulta optimizada en PostgreSQL: `User.objects.filter(role=CLIENT, is_active=True).annotate(order_count=Count("order"))`.
   - Soporte para búsqueda reactiva por nombre o correo con el parámetro `?q=...`.
   - Respuesta sanitizada sin contraseñas, hashes, tokens ni datos bancarios.

2. **Revalidación Autoritativa del Carrito (`CartValidateView`)**:
   - `POST /api/v1/checkout/validate/` (público sin autenticación forzada para carritos anónimos).
   - Recibe la lista de variantes y cantidades solicitadas por el cliente.
   - Revalida en una sola pasada:
     - Disponibilidad de producto y variante activa en catálogo.
     - Precio autoritativo calculado con promociones vigentes por fecha/hora.
     - Existencias en tiempo real contra `InventoryBalance`.
   - Reporta estados precisos: `ok`, `price_changed`, `out_of_stock`, `insufficient_stock`, `inactive`.

3. **Cotización y Condiciones de Entrega (`DeliveryQuoteView` y `AdminDeliverySettingsView`)**:
   - `POST /api/v1/delivery/quote/`
   - Aplica las reglas comerciales acordadas el 06/10/2026:
     - `PICKUP`: Recogida local en tienda gratuita (\$0.00 COP, `can_confirm: true`).
     - `URBAN`: Domicilio urbano en Pasto con tarifa plana (\$5.000 COP) y envío gratis automático si el subtotal descontado es $\ge \$100.000\text{ COP}$.
     - `SPECIAL`: Zonas especiales y corregimientos bloqueados (`cost: null`, `can_confirm: false`) hasta confirmación de tarifa.
   - `GET/PATCH /api/v1/admin/delivery/settings/`: Permite al administrador ajustar la tarifa urbana y el umbral de envío gratis registrando auditoría en `SettingChange`.

---

## 3. Frontend y Experiencia de Usuario (Next.js 16 + React)

1. **Gestión Administrativa de Clientes**:
   - Componente [`CustomerList`](file:///c:/Users/Anderson%20Ojeda/Downloads/Gestion%20de%20Proyectos%20Software/Cypher-Oz/frontend/src/features/users/customer-list.tsx) en [`src/app/admin/clientes/page.tsx`](file:///c:/Users/Anderson%20Ojeda/Downloads/Gestion%20de%20Proyectos%20Software/Cypher-Oz/frontend/src/app/admin/clientes/page.tsx).
   - Tabla responsiva con ID, nombre, correo, fecha localizada (`es-CO`) y badge de pedidos.
   - Enlace directo a "Clientes" agregado en el panel de cuenta de administradores.

2. **Selector de Entrega Interactivo**:
   - Componente [`DeliverySelector`](file:///c:/Users/Anderson%20Ojeda/Downloads/Gestion%20de%20Proyectos%20Software/Cypher-Oz/frontend/src/features/orders/delivery-selector.tsx).
   - Presenta las opciones con iconos, cálculo automático de costo y mensajes claros sobre el umbral de envío gratis.
   - Alerta visual amarilla/ámbar que bloquea el botón de confirmación si se elige zona especial.

3. **Validador de Carrito en Tiempo Real**:
   - Componente [`CartValidator`](file:///c:/Users/Anderson%20Ojeda/Downloads/Gestion%20de%20Proyectos%20Software/Cypher-Oz/frontend/src/features/orders/cart-validator.tsx) integrado en la pantalla [`Purchase`](file:///c:/Users/Anderson%20Ojeda/Downloads/Gestion%20de%20Proyectos%20Software/Cypher-Oz/frontend/src/features/orders/purchase.tsx).
   - Informa al comprador sobre cualquier discrepancia antes de comprometer el pedido.

4. **Identificación Tardía al Comprar**:
   - Los visitantes anónimos agregan productos desde el catálogo o la pantalla de compra.
   - El carrito se conserva de forma segura en `localStorage` (`tti.purchase.cart`).
   - El botón de inicio de sesión dirige a `/login?next=/comprar` (o `/registro?next=/comprar`), regresando a la compra con los productos preservados.

---

## 4. Resultados de Pruebas Automatizadas

### Backend (Pytest)
- **80 pruebas ejecutadas, 80 aprobadas (100% pasando)**.
- Tiempo de ejecución: 149 segundos sin advertencias críticas.
- Cobertura completa de los nuevos contratos en `tests/test_sprint4_backend.py`:
  - `test_admin_customer_list_requires_admin`: PASSED
  - `test_admin_customer_list_order_count_and_filter`: PASSED
  - `test_cart_validate_ok`: PASSED
  - `test_cart_validate_inactive_variant`: PASSED
  - `test_cart_validate_price_changed`: PASSED
  - `test_cart_validate_insufficient_stock`: PASSED
  - `test_delivery_quote_pickup`: PASSED
  - `test_delivery_quote_special`: PASSED
  - `test_delivery_quote_urban_below_and_above_threshold`: PASSED
  - `test_admin_delivery_settings_get_and_patch`: PASSED

### Frontend (Vitest)
- **19 archivos de prueba ejecutados, 75 pruebas aprobadas (100% pasando)**.
- Cobertura completa de los componentes de Sprint 4:
  - `src/features/users/customer-list.test.tsx` (2 pruebas): PASSED
  - `src/features/orders/delivery-selector.test.tsx` (3 pruebas): PASSED
  - `src/features/orders/cart-validator.test.tsx` (2 pruebas): PASSED
  - `src/features/orders/sprint4-features.test.tsx` (9 pruebas): PASSED

---

## 5. Control de Versiones

- Rama: `feature/CO-65-sprint-4`
- Commit de Sprint 4: `98abe71` — `feat(sprint-4): implement customer management, cart revalidation, delivery quotes and late checkout auth`
- Base de rama: Sincronizada con el 100% de Sprint 3.
- Estado del árbol de trabajo: Limpio (`working tree clean`).
