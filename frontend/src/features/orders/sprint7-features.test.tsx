import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminOrderList } from "./admin-order-list";
import { OrderDetail } from "./orders";
import type { AdminOrder, Order } from "./types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

const mockAdminOrders: AdminOrder[] = [
  {
    number: "11111111-2222-3333-4444-555555555555",
    customer_name: "Andrés Pasto",
    customer_email: "andres@test.com",
    status: "PREPARING",
    subtotal: "150000.00",
    discount: "0.00",
    shipping: "5000.00",
    total: "155000.00",
    currency: "COP",
    created_at: "2026-11-01T10:00:00Z",
    items: [
      {
        variant_id: 1,
        product_name: "Teclado Mecánico RGB",
        variant_name: "Switches Blue",
        sku: "KB-RGB-BLU",
        quantity: 1,
        unit_price: "150000.00",
        discount: "0.00",
        total: "150000.00",
      },
    ],
    delivery: {
      mode: "URBAN",
      address: {
        recipient_name: "Andrés Pasto",
        address_line: "Cra 25 # 14-20",
        city: "Pasto",
        state: "Nariño",
        phone: "3123456789",
        notes: "Entregar en segundo piso",
      },
      cost: "5000.00",
    },
    payment: {
      id: 1,
      status: "CONFIRMED",
      reference: "NEQ-778899",
      report_deadline_at: "2026-11-02T10:00:00Z",
      review_deadline_at: null,
      reported_at: "2026-11-01T11:00:00Z",
      report_window_active: false,
    },
    history: [],
  },
  {
    number: "22222222-3333-4444-5555-666666666666",
    customer_name: "Maria Tienda",
    customer_email: "maria@test.com",
    status: "PENDING",
    subtotal: "80000.00",
    discount: "0.00",
    shipping: "0.00",
    total: "80000.00",
    currency: "COP",
    created_at: "2026-11-01T12:00:00Z",
    items: [],
    delivery: {
      mode: "PICKUP",
      address: {},
      cost: "0.00",
    },
    payment: {
      id: 2,
      status: "PENDING",
      reference: "",
      report_deadline_at: "2026-11-02T12:00:00Z",
      review_deadline_at: null,
      reported_at: null,
      report_window_active: true,
    },
    history: [],
  },
];

const mockOrderDetail: Order = {
  number: "11111111-2222-3333-4444-555555555555",
  status: "PREPARING",
  subtotal: "150000.00",
  discount: "0.00",
  shipping: "5000.00",
  total: "155000.00",
  created_at: "2026-11-01T10:00:00Z",
  items: [
    {
      variant_id: 1,
      product_name: "Teclado Mecánico RGB",
      variant_name: "Switches Blue",
      sku: "KB-RGB-BLU",
      quantity: 1,
      unit_price: "150000.00",
      discount: "0.00",
      total: "150000.00",
    },
  ],
  delivery: {
    mode: "URBAN",
    address: {
      recipient_name: "Andrés Pasto",
      address_line: "Cra 25 # 14-20",
      city: "Pasto",
      state: "Nariño",
      phone: "3123456789",
      notes: "Entregar en segundo piso",
    },
    cost: "5000.00",
  },
  payment: {
    id: 1,
    status: "CONFIRMED",
    reference: "NEQ-778899",
    report_deadline_at: "2026-11-02T10:00:00Z",
    review_deadline_at: null,
    reported_at: "2026-11-01T11:00:00Z",
    report_window_active: false,
  },
  history: [],
};

describe("Sprint 7 Frontend Acceptance Tests", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/v1/admin/orders/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              count: mockAdminOrders.length,
              next: null,
              previous: null,
              results: mockAdminOrders,
            }),
          });
        }
        if (url.includes("/settings/public/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              whatsapp_enabled: true,
              whatsapp_number: "573105559999",
              whatsapp_message: "Hola, quisiera consultar sobre la tienda.",
            }),
          });
        }
        if (url.includes("/api/v1/orders/")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOrderDetail,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      })
    );
  });

  describe("CO-71 (HU-29): Gestión administrativa de entrega", () => {
    it("renders delivery filter and delivery badges in admin orders table", async () => {
      render(<AdminOrderList />);

      await waitFor(() => {
        expect(screen.getByText("Andrés Pasto")).toBeInTheDocument();
        expect(screen.getByText("Maria Tienda")).toBeInTheDocument();
      });

      // Delivery mode badges
      expect(screen.getByText("🚚 Envío urbano")).toBeInTheDocument();
      expect(screen.getByText("🏪 Recogida en tienda")).toBeInTheDocument();

      // Delivery filter selector is available
      const deliverySelect = screen.getByLabelText("Entrega:");
      expect(deliverySelect).toBeInTheDocument();
    });

    it("filters admin orders by delivery_mode query parameter", async () => {
      const user = userEvent.setup();
      render(<AdminOrderList />);

      await waitFor(() => screen.getByText("Andrés Pasto"));

      const deliverySelect = screen.getByLabelText("Entrega:");
      await user.selectOptions(deliverySelect, "URBAN");

      await user.click(screen.getByRole("button", { name: /filtrar/i }));

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("delivery_mode=URBAN"),
        expect.any(Object)
      );
    });

    it("opens order modal and displays authorized delivery details", async () => {
      const user = userEvent.setup();
      render(<AdminOrderList />);

      await waitFor(() => screen.getByText("Andrés Pasto"));

      // Click on order link to open modal
      const orderBtn = screen.getByRole("button", { name: /11111111/ });
      await user.click(orderBtn);

      // Verify modal delivery section
      expect(screen.getByText("Logística y Despacho de Entrega")).toBeInTheDocument();
      expect(screen.getByText("Cra 25 # 14-20")).toBeInTheDocument();
      expect(screen.getByText(/3123456789/)).toBeInTheDocument();
      expect(screen.getByText(/Entregar en segundo piso/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copiar rótulo de despacho/i })).toBeInTheDocument();
    });
  });

  describe("CO-72 (HU-31): WhatsApp contextual desde pedido propio", () => {
    it("renders contextual WhatsApp support link in OrderDetail with order number", async () => {
      render(<OrderDetail number="11111111-2222-3333-4444-555555555555" />);

      await waitFor(() => {
        expect(screen.getByText(/Detalle del pedido/i)).toBeInTheDocument();
      });

      const waLink = await screen.findByRole("link", {
        name: /Contactar por WhatsApp sobre el pedido #11111111-2222-3333-4444-555555555555/,
      });

      expect(waLink).toBeInTheDocument();
      expect(waLink).toHaveAttribute("target", "_blank");
      expect(waLink).toHaveAttribute("rel", "noopener noreferrer");

      const href = waLink.getAttribute("href");
      expect(href).toContain("https://wa.me/573105559999");
      expect(href).toContain(encodeURIComponent("Hola, necesito asistencia con mi pedido #11111111-2222-3333-4444-555555555555"));
    });
  });
});

