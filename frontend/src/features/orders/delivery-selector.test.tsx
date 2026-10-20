import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeliverySelector,
  type DeliveryQuoteResult,
} from "./delivery-selector";

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn((path: string, options?: RequestInit) => {
      if (path.includes("/delivery/quote/")) {
        const body = JSON.parse((options?.body as string) || "{}");
        if (body.mode === "PICKUP") {
          return Promise.resolve<DeliveryQuoteResult>({
            mode: "PICKUP",
            cost: "0.00",
            can_confirm: true,
            label: "Recogida en tienda (gratis)",
            message: "",
            free_shipping_threshold: "100000",
          });
        }
        if (body.mode === "SPECIAL") {
          return Promise.resolve<DeliveryQuoteResult>({
            mode: "SPECIAL",
            cost: null,
            can_confirm: false,
            label: "Zona especial — tarifa por confirmar",
            message:
              "Tarifa especial por confirmar. No es posible crear el pedido todavía.",
            free_shipping_threshold: "100000",
          });
        }
        // URBAN
        const isFree = body.subtotal >= 100000;
        return Promise.resolve<DeliveryQuoteResult>({
          mode: "URBAN",
          cost: isFree ? "0.00" : "5000.00",
          can_confirm: true,
          label: isFree ? "Envío gratis" : "Envío urbano $5.000",
          message: "",
          free_shipping_threshold: "100000",
          is_free: isFree,
        });
      }
      return Promise.reject(new Error("Not found"));
    }),
  };
});

describe("DeliverySelector (CO-70 HU-28)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 delivery options: PICKUP, URBAN, SPECIAL", async () => {
    const handleModeChange = vi.fn();
    render(
      <DeliverySelector
        subtotal={50000}
        selectedMode="URBAN"
        onModeChange={handleModeChange}
      />,
    );

    expect(screen.getByText("Recogida en tienda")).toBeInTheDocument();
    expect(screen.getByText("Domicilio urbano en Pasto")).toBeInTheDocument();
    expect(
      screen.getByText("Zona especial / Corregimientos"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(handleModeChange).toHaveBeenCalledWith(
        "URBAN",
        expect.objectContaining({ cost: "5000.00", can_confirm: true }),
      );
    });
  });

  it("calculates free shipping when subtotal >= 100000 COP", async () => {
    const handleModeChange = vi.fn();
    render(
      <DeliverySelector
        subtotal={150000}
        selectedMode="URBAN"
        onModeChange={handleModeChange}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/¡Gratis! \(supera el umbral\)/i),
      ).toBeInTheDocument();
      expect(handleModeChange).toHaveBeenCalledWith(
        "URBAN",
        expect.objectContaining({ cost: "0.00", is_free: true }),
      );
    });
  });

  it("blocks order confirmation and warns when SPECIAL zone is selected", async () => {
    const handleModeChange = vi.fn();
    render(
      <DeliverySelector
        subtotal={50000}
        selectedMode="SPECIAL"
        onModeChange={handleModeChange}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Tarifa pendiente de confirmación/i),
      ).toBeInTheDocument();
      expect(handleModeChange).toHaveBeenCalledWith(
        "SPECIAL",
        expect.objectContaining({ can_confirm: false, cost: null }),
      );
    });
  });

  it("updates the selected mode immediately while its quote loads", async () => {
    const handleModeChange = vi.fn();
    render(
      <DeliverySelector
        subtotal={50000}
        selectedMode="URBAN"
        onModeChange={handleModeChange}
      />,
    );
    await waitFor(() =>
      expect(handleModeChange).toHaveBeenCalledWith(
        "URBAN",
        expect.any(Object),
      ),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Recogida en tienda/i }));
    expect(handleModeChange).toHaveBeenLastCalledWith("PICKUP", null);
  });
});
