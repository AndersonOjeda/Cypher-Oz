import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/services/api";
import { PaymentInstructions } from "./payment-instructions";

vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  api: vi.fn(),
}));
const payment = {
  status: "PENDING",
  reference: "",
  reported_at: null,
  report_deadline_at: "2026-10-07T17:00:00Z",
  review_deadline_at: null,
  report_window_active: true,
};
const instructions = {
  configured: false,
  instructions: "",
  total: "45000.00",
  report_deadline_at: payment.report_deadline_at,
  order_status: "PENDING",
  payment,
};
beforeEach(() => vi.resetAllMocks());

test.each([
  { order_status: "CANCELLED", report_window_active: true },
  { order_status: "PENDING", report_window_active: false },
])(
  "does not invite payment for an expired or cancelled order: %o",
  async (state) => {
    vi.mocked(api).mockResolvedValueOnce({
      ...instructions,
      configured: true,
      instructions: "Synthetic account details",
      order_status: state.order_status,
      payment: { ...payment, report_window_active: state.report_window_active },
    });
    render(<PaymentInstructions number="order-1" />);
    expect(
      await screen.findByText(/no realices transferencias/i),
    ).toBeVisible();
    expect(
      screen.queryByText("Synthetic account details"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copiar instrucciones" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reportar pago" }),
    ).not.toBeInTheDocument();
  },
);

test("clipboard denial explains how to copy manually without reporting a payment", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  vi.mocked(api).mockResolvedValueOnce({
    ...instructions,
    configured: true,
    instructions: "Synthetic payment instructions",
  });
  render(<PaymentInstructions number="order-1" />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Copiar instrucciones" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "copia el texto manualmente",
  );
  expect(api).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Reportar pago" })).toBeEnabled();
});

test("reports reference without presenting funds as confirmed", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce(instructions)
    .mockResolvedValueOnce({
      ...payment,
      status: "REPORTED",
      reference: "REF-123",
      reported_at: "2026-10-06T17:00:00Z",
      review_deadline_at: "2026-10-07T17:00:00Z",
      report_window_active: false,
    });
  render(<PaymentInstructions number="order-1" />);
  await userEvent.type(
    await screen.findByLabelText("Referencia del pago"),
    "REF-123",
  );
  await userEvent.click(screen.getByRole("button", { name: "Reportar pago" }));
  expect(
    await screen.findByText(
      "Pendiente de revisión. Fondos aún no confirmados.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reportar pago" }),
  ).not.toBeInTheDocument();
  expect(api).toHaveBeenLastCalledWith("/orders/order-1/payment-report/", {
    method: "POST",
    body: JSON.stringify({ reference: "REF-123" }),
  });
});

test("an expired report window cannot be submitted", async () => {
  vi.mocked(api).mockResolvedValueOnce({
    ...instructions,
    payment: { ...payment, report_window_active: false },
  });
  render(<PaymentInstructions number="order-1" />);
  expect(
    await screen.findByText(
      "El plazo para reportar venció. Contacta con la tienda.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByLabelText("Referencia del pago"),
  ).not.toBeInTheDocument();
});

test("a failed request preserves the reference and permits retry", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce(instructions)
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce(instructions);
  render(<PaymentInstructions number="order-1" />);
  await userEvent.type(
    await screen.findByLabelText("Referencia del pago"),
    "REF-123",
  );
  await userEvent.click(screen.getByRole("button", { name: "Reportar pago" }));
  expect(await screen.findByText("Sin conexión")).toBeVisible();
  expect(screen.getByLabelText("Referencia del pago")).toHaveValue("REF-123");
  expect(screen.getByRole("button", { name: "Reportar pago" })).toBeEnabled();
});
