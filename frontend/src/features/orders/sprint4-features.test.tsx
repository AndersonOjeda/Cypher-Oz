import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, loadCart, clearCart, CART_STORAGE_KEY } from "./cart-storage";
import { CartValidator } from "./cart-validator";
import { DeliverySelector } from "./delivery-selector";
import { CustomerList } from "@/features/users/customer-list";

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn((path: string, options?: RequestInit) => {
      // CO-62 Admin customer listing
      if (path.includes("/admin/customers/?q=Carlos")) {
        return Promise.resolve([
          {
            id: 10,
            name: "Carlos Gomez",
            email: "carlos@test.com",
            created_at: "2026-04-01T08:00:00Z",
            order_count: 5,
          },
        ]);
      }
      if (path.includes("/admin/customers/")) {
        return Promise.resolve([
          {
            id: 10,
            name: "Carlos Gomez",
            email: "carlos@test.com",
            created_at: "2026-04-01T08:00:00Z",
            order_count: 5,
          },
          {
            id: 11,
            name: "Diana Rios",
            email: "diana@test.com",
            created_at: "2026-04-02T09:00:00Z",
            order_count: 0,
          },
        ]);
      }

      // CO-57 Checkout validate
      if (path.includes("/checkout/validate/")) {
        const body = JSON.parse((options?.body as string) || "{}");
        const items = body.items || [];
        const hasIssue = items.some((i: { variant_id: number }) => i.variant_id === 500);
        return Promise.resolve({
          has_changes: hasIssue,
          items: items.map((i: { variant_id: number }) => ({
            variant_id: i.variant_id,
            product_name: i.variant_id === 500 ? "Teclado RGB" : "Mouse Inalámbrico",
            status: i.variant_id === 500 ? "out_of_stock" : "ok",
            message: i.variant_id === 500 ? "Sin stock disponible." : null,
            current_price: "85000.00",
            available_qty: i.variant_id === 500 ? 0 : 15,
          })),
        });
      }

      // CO-70 Delivery quote
      if (path.includes("/delivery/quote/")) {
        const body = JSON.parse((options?.body as string) || "{}");
        if (body.mode === "PICKUP") {
          return Promise.resolve({
            mode: "PICKUP",
            cost: "0.00",
            can_confirm: true,
            label: "Recogida en tienda (gratis)",
            message: "",
            free_shipping_threshold: "100000",
          });
        }
        if (body.mode === "SPECIAL") {
          return Promise.resolve({
            mode: "SPECIAL",
            cost: null,
            can_confirm: false,
            label: "Zona especial — tarifa por confirmar",
            message: "Tarifa especial por confirmar. No es posible crear el pedido todavía.",
            free_shipping_threshold: "100000",
          });
        }
        const isFree = body.subtotal >= 100000;
        return Promise.resolve({
          mode: "URBAN",
          cost: isFree ? "0.00" : "5000.00",
          can_confirm: true,
          label: isFree ? "Envío gratis" : "Envío urbano $5.000",
          message: "",
          free_shipping_threshold: "100000",
          is_free: isFree,
        });
      }

      return Promise.reject(new Error("Path not mocked: " + path));
    }),
  };
});

describe("Sprint 4 Integrated Acceptance Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ========== CO-37 HU-10: Late Authentication and Cart Preservation ==========
  describe("CO-37 HU-10: Identificación al momento de comprar", () => {
    it("preserves anonymous cart in localStorage so user can authenticate late without losing items", () => {
      // 1. User browses as visitor and adds item to cart
      addToCart(201, 2, "Monitor Gamer 27 pulgadas");

      // 2. Verify stored in localStorage
      const { items } = loadCart();
      expect(items).toHaveLength(1);
      expect(items[0].variant_id).toBe(201);
      expect(items[0].quantity).toBe(2);
      expect(items[0].label).toBe("Monitor Gamer 27 pulgadas");

      // 3. User navigates to login with return path /comprar
      // Simulating login: cart in localStorage must remain intact
      const rawAfter = localStorage.getItem(CART_STORAGE_KEY);
      expect(rawAfter).not.toBeNull();
      expect(JSON.parse(rawAfter!).items[0].variant_id).toBe(201);
    });
  });

  // ========== CO-57 HU-09: Cart Revalidation ==========
  describe("CO-57 HU-09: Revalidación autoritativa del carrito", () => {
    it("reports stock changes and flags out of stock items", async () => {
      const cartWithStockIssue = [
        { variant_id: 500, quantity: 1, label: "Teclado RGB" },
      ];

      render(<CartValidator cart={cartWithStockIssue} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Tu carrito presenta cambios de inventario o precio/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/Agotado temporalmente/i)).toBeInTheDocument();
      });
    });

    it("confirms ok status when all items are available at current prices", async () => {
      const healthyCart = [
        { variant_id: 300, quantity: 1, label: "Mouse Inalámbrico" },
      ];

      render(<CartValidator cart={healthyCart} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Disponibilidad y precios confirmados con la tienda/i),
        ).toBeInTheDocument();
      });
    });
  });

  // ========== CO-70 HU-28: Delivery Options and Costs ==========
  describe("CO-70 HU-28: Condiciones y costo de entrega", () => {
    it("offers store pickup as completely free", async () => {
      const onModeChange = vi.fn();
      render(
        <DeliverySelector
          subtotal={40000}
          selectedMode="PICKUP"
          onModeChange={onModeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Gratis \(Recogida local en Pasto\)/i)).toBeInTheDocument();
        expect(onModeChange).toHaveBeenCalledWith(
          "PICKUP",
          expect.objectContaining({ cost: "0.00", can_confirm: true }),
        );
      });
    });

    it("applies $5.000 flat rate for urban delivery when subtotal < $100.000", async () => {
      const onModeChange = vi.fn();
      render(
        <DeliverySelector
          subtotal={75000}
          selectedMode="URBAN"
          onModeChange={onModeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/\$ [\s\u00a0]?5\.000/i)).toBeInTheDocument();
        expect(onModeChange).toHaveBeenCalledWith(
          "URBAN",
          expect.objectContaining({ cost: "5000.00", is_free: false, can_confirm: true }),
        );
      });
    });

    it("applies free delivery for urban delivery when subtotal >= $100.000 threshold", async () => {
      const onModeChange = vi.fn();
      render(
        <DeliverySelector
          subtotal={120000}
          selectedMode="URBAN"
          onModeChange={onModeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/¡Gratis! \(supera el umbral\)/i)).toBeInTheDocument();
        expect(onModeChange).toHaveBeenCalledWith(
          "URBAN",
          expect.objectContaining({ cost: "0.00", is_free: true, can_confirm: true }),
        );
      });
    });

    it("blocks confirmation for SPECIAL zones until rate is confirmed", async () => {
      const onModeChange = vi.fn();
      render(
        <DeliverySelector
          subtotal={50000}
          selectedMode="SPECIAL"
          onModeChange={onModeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Tarifa pendiente de confirmación/i)).toBeInTheDocument();
        expect(onModeChange).toHaveBeenCalledWith(
          "SPECIAL",
          expect.objectContaining({ can_confirm: false, cost: null }),
        );
      });
    });
  });

  // ========== CO-62 HU-19: Admin Customer Listing ==========
  describe("CO-62 HU-19: Consulta administrativa de clientes", () => {
    it("renders list of registered clients and their order totals", async () => {
      render(<CustomerList />);

      await waitFor(() => {
        expect(screen.getByText("Carlos Gomez")).toBeInTheDocument();
        expect(screen.getByText("carlos@test.com")).toBeInTheDocument();
        expect(screen.getByText("Diana Rios")).toBeInTheDocument();
        expect(screen.getByText("diana@test.com")).toBeInTheDocument();
      });

      // Order counts
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("filters customers by search text", async () => {
      render(<CustomerList />);

      await waitFor(() => {
        expect(screen.getByText("Carlos Gomez")).toBeInTheDocument();
      });

      const input = screen.getByLabelText("Buscar cliente");
      fireEvent.change(input, { target: { value: "Carlos" } });

      const searchBtn = screen.getByRole("button", { name: /buscar/i });
      fireEvent.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByText("Carlos Gomez")).toBeInTheDocument();
        expect(screen.queryByText("Diana Rios")).not.toBeInTheDocument();
      });
    });
  });
});
