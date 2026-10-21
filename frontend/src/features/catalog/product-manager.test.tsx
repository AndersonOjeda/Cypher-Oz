import { afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/services/api";
import { ProductManager } from "./product-manager";

vi.mock("@/services/api", () => ({ api: vi.fn() }));
vi.mock("./variant-manager", () => ({ VariantManager: () => null }));
vi.mock("./image-manager", () => ({ ImageManager: () => null }));
afterEach(() => vi.unstubAllGlobals());

test.each([false, true])(
  "editing a product reveals the populated editor; reduced motion: %s",
  async (reduced) => {
    const scroll = vi.fn();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced })),
    );
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    const item = {
      id: 1,
      name: "Teclado",
      slug: "teclado",
      description: "Mecanico",
      warranty: "",
      category: 2,
      brand: 3,
      is_active: true,
      images: [],
      total_stock: reduced ? 7 : 0,
    };
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/admin/products/1/") return item;
      if (path.includes("/products/?"))
        return { count: 1, results: [item], next: null, previous: null };
      if (path.includes("/limits/")) return {};
      return { results: [], next: null };
    });
    try {
      const user = userEvent.setup();
      render(<ProductManager />);
      expect(scroll).not.toHaveBeenCalled();
      const edit = await screen.findByRole("button", {
        name: "Editar Teclado",
      });
      await user.click(edit);
      const heading = await screen.findByRole("heading", {
        name: "Editar producto: Teclado",
      });
      expect(heading).toHaveFocus();
      expect(screen.getByLabelText("Unidades disponibles")).toHaveTextContent(
        reduced ? "7 unidades" : "0 unidades",
      );
      expect(
        screen.getByRole("link", { name: "Añadir o ajustar unidades →" }),
      ).toHaveAttribute("href", "/admin/inventario");
      expect(screen.getByLabelText("Nombre del producto")).toHaveValue(
        "Teclado",
      );
      expect(scroll).toHaveBeenLastCalledWith({
        block: "start",
        behavior: reduced ? "instant" : "smooth",
      });
      // Selecting the same record again must still navigate to the editor.
      await user.click(edit);
      expect(scroll).toHaveBeenCalledTimes(2);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  },
);
