import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartValidator, type RevalidationResponse } from "./cart-validator";
import type { CartLine } from "./types";
import { api } from "@/services/api";

const mockCart: CartLine[] = [
  { variant_id: 101, quantity: 2, label: "Laptop Pro · 16GB RAM" },
];

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn((path: string, options?: RequestInit) => {
      if (path.includes("/checkout/validate/")) {
        const body = JSON.parse((options?.body as string) || "{}");
        const items = body.items || [];
        if (items.some((i: { variant_id: number }) => i.variant_id === 999)) {
          return Promise.resolve<RevalidationResponse>({
            has_changes: true,
            items: [
              {
                variant_id: 999,
                product_name: "Mouse Gamer",
                status: "out_of_stock",
                message: "Sin stock disponible.",
                current_price: "45000.00",
                available_qty: 0,
              },
            ],
          });
        }
        return Promise.resolve<RevalidationResponse>({
          has_changes: false,
          items: [
            {
              variant_id: 101,
              product_name: "Laptop Pro",
              variant_name: "16GB RAM",
              status: "ok",
              message: null,
              current_price: "3500000.00",
              available_qty: 10,
            },
          ],
        });
      }
      return Promise.reject(new Error("Not found"));
    }),
  };
});

describe("CartValidator (CO-57 HU-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates cart and displays confirmation when all items are available and current", async () => {
    const handleComplete = vi.fn();
    render(
      <CartValidator cart={mockCart} onValidationComplete={handleComplete} />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Disponibilidad y precios confirmados con la tienda/i),
      ).toBeInTheDocument();
      expect(handleComplete).toHaveBeenCalledWith(
        expect.objectContaining({ has_changes: false }),
      );
    });
  });

  it("displays warnings and details when items have changes or are out of stock", async () => {
    const outOfStockCart: CartLine[] = [
      { variant_id: 999, quantity: 1, label: "Mouse Gamer" },
    ];
    const handleComplete = vi.fn();
    render(
      <CartValidator
        cart={outOfStockCart}
        onValidationComplete={handleComplete}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Tu carrito presenta cambios de inventario o precio/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Agotado temporalmente/i)).toBeInTheDocument();
      expect(handleComplete).toHaveBeenCalledWith(
        expect.objectContaining({ has_changes: true }),
      );
    });
  });

  it("sends the observed price and requires explicit acceptance of a changed price", async () => {
    const changed: RevalidationResponse = {
      has_changes: true,
      items: [
        {
          variant_id: 101,
          status: "price_changed",
          message: "El precio ha cambiado.",
          current_price: "3600000.00",
          available_qty: 10,
        },
      ],
    };
    vi.mocked(api).mockResolvedValueOnce(changed);
    const accept = vi.fn();
    render(
      <CartValidator
        cart={[{ ...mockCart[0], unit_price: "3500000.00" }]}
        onAcceptPrices={accept}
      />,
    );
    const button = await screen.findByRole("button", {
      name: "Aceptar precios actualizados",
    });
    expect(
      JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string).items[0]
        .unit_price,
    ).toBe("3500000.00");
    expect(accept).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(accept).toHaveBeenCalledWith(changed.items);
  });

  it("does not show confirmation after a failed validation", async () => {
    vi.mocked(api).mockRejectedValueOnce(new Error("Sin conexión"));
    render(<CartValidator cart={mockCart} />);
    await screen.findByRole("alert");
    expect(
      screen.queryByText(/Disponibilidad y precios confirmados/),
    ).not.toBeInTheDocument();
  });
});
