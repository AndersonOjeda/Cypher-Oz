import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { OrderDetail } from "./orders";
import { PaymentInstructions } from "./payment-instructions";
import type { Order } from "./types";

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn(),
  };
});

const mockOrderPending: Order = {
  number: "ord-sprint5-001",
  status: "PENDING",
  subtotal: "100000.00",
  discount: "0.00",
  shipping: "5000.00",
  total: "105000.00",
  created_at: "2026-10-20T10:00:00Z",
  items: [
    {
      variant_id: 101,
      product_name: "Auriculares Gamer TTI",
      variant_name: "Negro",
      sku: "AUR-001",
      quantity: 2,
      unit_price: "50000.00",
      discount: "0.00",
      total: "100000.00",
    },
  ],
  delivery: {
    mode: "URBAN",
    cost: "5000.00",
    address: {
      recipient_name: "Juan Perez",
      address_line: "Calle 18 # 25-10",
      city: "Pasto",
      state: "Nariño",
      phone: "3101234567",
      notes: "Cerca al parque",
    },
  },
  payment: {
    status: "PENDING",
    reference: "",
    reported_at: null,
    report_deadline_at: "2026-10-21T10:00:00Z",
    review_deadline_at: null,
    report_window_active: true,
  },
};

describe("Sprint 5: cancellation policy belongs to HU-18", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(["PENDING", "PREPARING", "CANCELLED", "SHIPPED"])(
    "does not expose cancellation for %s",
    async (status) => {
      vi.mocked(api).mockResolvedValueOnce({ ...mockOrderPending, status });
      render(<OrderDetail number="ord-sprint5-001" />);
      await screen.findByText(mockOrderPending.number);
      expect(
        screen.queryByRole("button", { name: /cancelar pedido/i }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("Sprint 5 — CO-59 & CO-60: Instrucciones y Reporte de Pago", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("muestra las instrucciones de pago configuradas y permite copiarlas", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    vi.mocked(api).mockResolvedValueOnce({
      configured: true,
      instructions:
        "Transferir a Bancolombia Ahorros # 123-456789-00 a nombre de TTI Pasto.",
      total: "105000.00",
      report_deadline_at: "2026-10-21T10:00:00Z",
      order_status: "PENDING",
      payment: mockOrderPending.payment,
    });

    render(<PaymentInstructions number="ord-sprint5-001" />);

    expect(
      await screen.findByText(/transferir a bancolombia ahorros/i),
    ).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", {
      name: /copiar instrucciones/i,
    });
    expect(copyBtn).toBeInTheDocument();

    await userEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith(
      "Transferir a Bancolombia Ahorros # 123-456789-00 a nombre de TTI Pasto.",
    );
  });

  it("envía el reporte de pago y muestra el estado REPORTED con advertencia de revisión", async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({
        configured: true,
        instructions: "Nequi 3101234567",
        total: "105000.00",
        report_deadline_at: "2026-10-21T10:00:00Z",
        order_status: "PENDING",
        payment: mockOrderPending.payment,
      })
      .mockResolvedValueOnce({
        ...mockOrderPending.payment,
        status: "REPORTED",
        reference: "COMPROBANTE-9988",
        reported_at: "2026-10-20T11:00:00Z",
        review_deadline_at: "2026-10-21T11:00:00Z",
        report_window_active: false,
      });

    render(<PaymentInstructions number="ord-sprint5-001" />);

    const input = await screen.findByLabelText("Referencia del pago");
    await userEvent.type(input, "COMPROBANTE-9988");

    const reportBtn = screen.getByRole("button", { name: /reportar pago/i });
    await userEvent.click(reportBtn);

    expect(api).toHaveBeenCalledWith(
      "/orders/ord-sprint5-001/payment-report/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reference: "COMPROBANTE-9988" }),
      }),
    );

    expect(
      await screen.findByText(
        "Pendiente de revisión. Fondos aún no confirmados.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Referencia: COMPROBANTE-9988"),
    ).toBeInTheDocument();
  });
});

