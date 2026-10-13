import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/services/api";
import { Inventory } from "./inventory";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));

const empty = { count: 0, next: null, previous: null, results: [] };
beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/users/me/")
      return {
        id: 1,
        name: "Admin",
        email: "admin@example.com",
        role: "ADMIN",
      };
    if (path.startsWith("/admin/inventory/?"))
      return {
        ...empty,
        count: 1,
        results: [
          {
            variant: 3,
            product_name: "Teclado",
            sku: "TEC-001",
            available_quantity: 5,
          },
        ],
      };
    if (path.startsWith("/admin/inventory/movements/")) return empty;
    if (options?.method === "POST") return {};
    return empty;
  });
});

test("registers a justified adjustment after confirmation", async () => {
  render(<Inventory />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Registrar entrada: TEC-001" }),
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Operación"),
    "adjustment",
  );
  const quantity = screen.getByLabelText("Variación del stock");
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "-2");
  await userEvent.type(screen.getByLabelText("Motivo"), "Conteo físico");
  await userEvent.click(screen.getByRole("button", { name: "Guardar ajuste" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/admin/inventory/adjustments/",
      expect.objectContaining({ method: "POST" }),
    ),
  );
  expect(window.confirm).toHaveBeenCalled();
});

test("applies movement type and date filters", async () => {
  render(<Inventory />);
  await screen.findByText("Teclado");
  await userEvent.selectOptions(
    screen.getByLabelText("Filtrar por tipo"),
    "ADJUSTMENT",
  );
  await userEvent.type(screen.getByLabelText("Fecha desde"), "2026-10-01");
  await waitFor(() =>
    expect(
      vi
        .mocked(api)
        .mock.calls.some(
          ([path]) =>
            String(path).includes("type=ADJUSTMENT") &&
            String(path).includes("from=2026-10-01"),
        ),
    ).toBe(true),
  );
});
