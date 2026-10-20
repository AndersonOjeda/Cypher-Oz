import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminPaymentList } from "./admin-payment-list";
import { AdminOrderList } from "./admin-order-list";
import { OrderDetail } from "./orders";

const mockAdminPayments = [
  {
    id: 101,
    order_number: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    customer_name: "Juan Perez",
    customer_email: "juan@test.com",
    order_total: "800000.00",
    order_status: "PENDING",
    status: "REPORTED",
    reference: "NEQUI-REF-12345",
    reported_at: "2026-10-20T10:00:00Z",
    report_deadline_at: "2026-10-21T10:00:00Z",
    review_deadline_at: "2026-10-22T10:00:00Z",
    report_window_active: false,
    history: [],
  },
];

const mockAdminOrders = [
  {
    number: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    customer_name: "Juan Perez",
    customer_email: "juan@test.com",
    status: "PENDING",
    subtotal: "800000.00",
    discount: "0.00",
    shipping: "0.00",
    total: "800000.00",
    currency: "COP",
    created_at: "2026-10-20T09:00:00Z",
    items: [
      {
        variant_id: 1,
        product_name: "Placa Base ROG",
        variant_name: "Gaming Edition",
        sku: "ASUS-ROG-B650",
        quantity: 1,
        unit_price: "800000.00",
        discount: "0.00",
        total: "800000.00",
      },
    ],
    delivery: { mode: "PICKUP", address: {}, cost: "0.00" },
    payment: {
      status: "CONFIRMED",
      reference: "NEQUI-REF-12345",
      reported_at: "2026-10-20T10:00:00Z",
      report_deadline_at: "2026-10-21T10:00:00Z",
      review_deadline_at: null,
      report_window_active: false,
    },
    history: [{ id: 1, status: "PENDING", actor_email: "juan@test.com", created_at: "2026-10-20T09:00:00Z" }],
  },
];

const mockOrderDetailPending = {
  number: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  status: "PENDING",
  subtotal: "800000.00",
  discount: "0.00",
  shipping: "0.00",
  total: "800000.00",
  created_at: "2026-10-20T09:00:00Z",
  items: [
    {
      variant_id: 1,
      product_name: "Placa Base ROG",
      variant_name: "Gaming Edition",
      sku: "ASUS-ROG-B650",
      quantity: 1,
      unit_price: "800000.00",
      discount: "0.00",
      total: "800000.00",
    },
  ],
  delivery: { mode: "PICKUP", address: {}, cost: "0.00" },
  payment: {
    status: "PENDING",
    reference: "",
    reported_at: null,
    report_deadline_at: "2026-10-21T09:00:00Z",
    review_deadline_at: null,
    report_window_active: true,
  },
  history: [{ id: 1, status: "PENDING", actor_email: "juan@test.com", created_at: "2026-10-20T09:00:00Z" }],
};

describe("Sprint 6 Frontend Features", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/admin/payments/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ count: 1, results: mockAdminPayments }),
          });
        }
        if (url.includes("/admin/orders/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ count: 1, results: mockAdminOrders }),
          });
        }
        if (url.includes("/orders/a1b2c3d4/")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOrderDetailPending,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      })
    );
    window.confirm = vi.fn().mockReturnValue(true);
  });

  // -------------------------------------------------------------------------
  // HU-15 (CO-44): Admin Payments Management
  // -------------------------------------------------------------------------
  it("AdminPaymentList renders payments table with reference and confirm button", async () => {
    render(<AdminPaymentList />);

    await waitFor(() => {
      expect(screen.getByText("Bandeja de Verificación de Pagos")).toBeInTheDocument();
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.getByText("NEQUI-REF-12345")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    });
  });

  it("AdminPaymentList handles confirm payment action", async () => {
    const user = userEvent.setup();
    render(<AdminPaymentList />);

    await waitFor(() => screen.getByRole("button", { name: "Confirmar" }));
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });

    await user.click(confirmBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/payments/101/confirm/"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("AdminPaymentList opens reject modal and sends reason", async () => {
    const user = userEvent.setup();
    render(<AdminPaymentList />);

    await waitFor(() => screen.getByRole("button", { name: "Rechazar" }));
    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });
    await user.click(rejectBtn);

    expect(screen.getByLabelText(/Motivo obligatorio/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Motivo obligatorio/i), "Comprobante adulterado");

    const submitRejectBtn = screen.getByRole("button", { name: "Confirmar Rechazo" });
    await user.click(submitRejectBtn);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/payments/101/reject/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Comprobante adulterado" }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // HU-17 (CO-43): Admin Orders Management & Transitions
  // -------------------------------------------------------------------------
  it("AdminOrderList displays orders and advances status to PREPARING", async () => {
    const user = userEvent.setup();
    render(<AdminOrderList />);

    await waitFor(() => {
      expect(screen.getByText("Gestión Administrativa de Pedidos")).toBeInTheDocument();
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.getByText("Pago Confirmado")).toBeInTheDocument();
    });

    // Since payment is CONFIRMED and order is PENDING, "Preparar" button is enabled
    const prepareBtn = screen.getByRole("button", { name: "Preparar" });
    expect(prepareBtn).toBeInTheDocument();

    await user.click(prepareBtn);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/orders/a1b2c3d4-e5f6-7890-1234-567890abcdef/transition/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ target_status: "PREPARING" }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // HU-16 & HU-18 (CO-40 & CO-61): Order Detail Tracking & Cancellation
  // -------------------------------------------------------------------------
  it("OrderDetail shows tracking stepper and allows customer cancellation", async () => {
    const user = userEvent.setup();
    render(<OrderDetail number="a1b2c3d4" />);

    await waitFor(() => {
      expect(screen.getByText("Seguimiento del pedido")).toBeInTheDocument();
      expect(screen.getByText("1. Registrado")).toBeInTheDocument();
      expect(screen.getByText("Placa Base ROG")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeInTheDocument();
    });

    // Click "Cancelar pedido"
    const cancelBtn = screen.getByRole("button", { name: "Cancelar pedido" });
    await user.click(cancelBtn);

    expect(screen.getByText("¿Deseas cancelar este pedido?")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Motivo/i), "Ya no lo necesito");

    const confirmCancelBtn = screen.getByRole("button", { name: "Confirmar Cancelación" });
    await user.click(confirmCancelBtn);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/orders/a1b2c3d4-e5f6-7890-1234-567890abcdef/cancel/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Ya no lo necesito" }),
      })
    );
  });
});
