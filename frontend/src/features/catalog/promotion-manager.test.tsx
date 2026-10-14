import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/services/api";
import { PromotionManager } from "./promotion-manager";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));

beforeEach(() => vi.mocked(api).mockReset());

const emptyPromos = { count: 0, next: null, previous: null, results: [] };
const mockVariants = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      product_name: "Mouse Gamer",
      name: "Negro",
      sku: "G502-BLK",
      price: "150000.00",
    },
  ],
};

test("renders empty promotions list and validates promotion creation", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockImplementation((path) => {
    if (typeof path === "string" && path.includes("/purchase/variants/")) {
      return Promise.resolve(mockVariants);
    }
    return Promise.resolve(emptyPromos);
  });

  render(<PromotionManager />);
  await screen.findByText(/No hay promociones registradas/);

  // Fill in promotion name
  await user.type(screen.getByLabelText("Nombre de la promoción"), "Cyber Monday");
  expect(screen.getByLabelText("Nombre de la promoción")).toHaveValue("Cyber Monday");

  // Fill in starts_at and ends_at
  await user.type(screen.getByLabelText("Fecha de inicio"), "2026-11-20T00:00");
  await user.type(screen.getByLabelText("Fecha de finalización"), "2026-11-25T23:59");

  // Select variant and offer price
  await waitFor(() => expect(screen.getByRole("option", { name: /G502-BLK/ })).toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText("Variante"), "1");

  // Try adding price >= base price
  await user.type(screen.getByLabelText("Precio Oferta (COP)"), "160000");
  await user.click(screen.getByRole("button", { name: "+ Añadir a oferta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("debe ser menor al precio base");

  // Now valid discount
  await user.clear(screen.getByLabelText("Precio Oferta (COP)"));
  await user.type(screen.getByLabelText("Precio Oferta (COP)"), "120000");
  await user.click(screen.getByRole("button", { name: "+ Añadir a oferta" }));

  // Check variant appears in list
  expect(await screen.findByText("Mouse Gamer")).toBeInTheDocument();
  expect(screen.getByText(/Oferta: \$ 120.000/)).toBeInTheDocument();

  // Save promotion
  vi.mocked(api).mockImplementation((path, options) => {
    if (typeof path === "string" && path.includes("/admin/promotions/") && options?.method === "POST") {
      return Promise.resolve({
        id: 10,
        name: "Cyber Monday",
        starts_at: "2026-11-20T05:00:00Z",
        ends_at: "2026-11-26T04:59:00Z",
        is_active: false,
        prices: [{ variant: 1, price: "120000" }],
      });
    }
    return Promise.resolve(emptyPromos);
  });

  await user.click(screen.getByRole("button", { name: "Guardar promoción" }));
  expect(await screen.findByText("Promoción creada.")).toBeInTheDocument();
});
