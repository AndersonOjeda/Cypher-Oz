import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addToComparison,
  clearComparison,
  getComparisonItems,
  removeFromComparison,
} from "./comparison-storage";
import {
  CompareButton,
  ComparisonFloatingBar,
  ProductComparisonView,
  type ComparisonResponse,
} from "./product-comparator";

// Mock router and navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (param: string) => (param === "ids" ? "1,2" : null),
  }),
}));

const mockComparisonData: ComparisonResponse = {
  category: { id: 1, name: "Monitores", slug: "monitores" },
  attributes: [
    { code: "resolucion", name: "Resolución" },
    { code: "tasa_refresco", name: "Tasa de Refresco" },
  ],
  products: [
    {
      id: 1,
      name: "LG UltraGear 27",
      slug: "lg-ultragear-27",
      category: { id: 1, name: "Monitores", slug: "monitores" },
      brand: { id: 1, name: "LG", slug: "lg" },
      image_url: "https://example.com/lg.jpg",
      description: "Monitor IPS 144Hz",
      warranty: "3 años con fabricante",
      min_price: "1450000.00",
      max_price: "1450000.00",
      promotional_min_price: null,
      has_promotion: false,
      total_stock: 15,
      is_available: true,
      attributes: {
        resolucion: { name: "Resolución", value: "2560x1440 QHD" },
        tasa_refresco: { name: "Tasa de Refresco", value: "165 Hz" },
      },
    },
    {
      id: 2,
      name: "Samsung Odyssey G5",
      slug: "samsung-odyssey-g5",
      category: { id: 1, name: "Monitores", slug: "monitores" },
      brand: { id: 2, name: "Samsung", slug: "samsung" },
      image_url: "https://example.com/sam.jpg",
      description: "Monitor Curvo 144Hz",
      warranty: "2 años con fabricante",
      min_price: "1200000.00",
      max_price: "1200000.00",
      promotional_min_price: "1100000.00",
      has_promotion: true,
      total_stock: 10,
      is_available: true,
      attributes: {
        resolucion: { name: "Resolución", value: "2560x1440 QHD" },
        tasa_refresco: { name: "Tasa de Refresco", value: "144 Hz" },
      },
    },
  ],
};

describe("HU-07 (CO-35): Comparación de Productos", () => {
  beforeEach(() => {
    clearComparison();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockComparisonData,
      })
    );
  });

  describe("comparison-storage logic (CO-106 / CO-108)", () => {
    it("allows adding up to 4 products of the same category", () => {
      const res1 = addToComparison({ id: 10, name: "Prod 1", slug: "p1", category_id: 1 });
      const res2 = addToComparison({ id: 20, name: "Prod 2", slug: "p2", category_id: 1 });
      const res3 = addToComparison({ id: 30, name: "Prod 3", slug: "p3", category_id: 1 });
      const res4 = addToComparison({ id: 40, name: "Prod 4", slug: "p4", category_id: 1 });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res3.success).toBe(true);
      expect(res4.success).toBe(true);
      expect(getComparisonItems()).toHaveLength(4);

      // 5th product rejected
      const res5 = addToComparison({ id: 50, name: "Prod 5", slug: "p5", category_id: 1 });
      expect(res5.success).toBe(false);
      expect(res5.error).toContain("hasta 4 productos");
      expect(getComparisonItems()).toHaveLength(4);
    });

    it("rejects products from different categories", () => {
      addToComparison({ id: 10, name: "Monitor 1", slug: "m1", category_id: 1, category_name: "Monitores" });
      const resDifferent = addToComparison({
        id: 99,
        name: "Audio 1",
        slug: "a1",
        category_id: 2,
        category_name: "Audio",
      });

      expect(resDifferent.success).toBe(false);
      expect(resDifferent.error).toContain("misma categoría");
      expect(getComparisonItems()).toHaveLength(1);
    });

    it("removes product by id", () => {
      addToComparison({ id: 10, name: "P1", slug: "p1", category_id: 1 });
      addToComparison({ id: 20, name: "P2", slug: "p2", category_id: 1 });
      expect(getComparisonItems()).toHaveLength(2);

      removeFromComparison(10);
      expect(getComparisonItems()).toHaveLength(1);
      expect(getComparisonItems()[0].id).toBe(20);
    });
  });

  describe("CompareButton component (CO-107)", () => {
    it("toggles product in comparison", async () => {
      const user = userEvent.setup();
      const item = { id: 100, name: "Teclado Mecánico", slug: "teclado", category_id: 5 };

      render(<CompareButton item={item} />);
      const btn = screen.getByRole("button", { name: /comparar/i });
      expect(btn).toHaveAttribute("aria-pressed", "false");

      await user.click(btn);
      expect(btn).toHaveAttribute("aria-pressed", "true");
      expect(getComparisonItems()).toHaveLength(1);

      await user.click(btn);
      expect(btn).toHaveAttribute("aria-pressed", "false");
      expect(getComparisonItems()).toHaveLength(0);
    });
  });

  describe("ComparisonFloatingBar component (CO-107)", () => {
    it("renders floating bar with counter and action buttons", () => {
      addToComparison({ id: 1, name: "Prod 1", slug: "p1", category_id: 1 });
      addToComparison({ id: 2, name: "Prod 2", slug: "p2", category_id: 1 });

      render(<ComparisonFloatingBar />);
      expect(screen.getByText(/Comparar \(2\/4\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Comparar \(2\)/i })).toBeEnabled();
    });

    it("disables compare button if only 1 item selected", () => {
      addToComparison({ id: 1, name: "Prod 1", slug: "p1", category_id: 1 });

      render(<ComparisonFloatingBar />);
      expect(screen.getByRole("button", { name: /Elige al menos 2/i })).toBeDisabled();
    });
  });

  describe("ProductComparisonView component (CO-106 / CO-107 / CO-108)", () => {
    it("renders comparison matrix table with technical attributes and prices", async () => {
      render(<ProductComparisonView />);

      await waitFor(() => {
        expect(screen.getByText("LG UltraGear 27")).toBeInTheDocument();
        expect(screen.getByText("Samsung Odyssey G5")).toBeInTheDocument();
      });

      // Technical attributes rows
      expect(screen.getByText("Resolución")).toBeInTheDocument();
      expect(screen.getByText("Tasa de Refresco")).toBeInTheDocument();
      expect(screen.getByText("165 Hz")).toBeInTheDocument();
      expect(screen.getByText("144 Hz")).toBeInTheDocument();

      // Warranty & stock
      expect(screen.getByText("3 años con fabricante")).toBeInTheDocument();
      expect(screen.getByText(/✓ En stock \(15 disponibles\)/)).toBeInTheDocument();
    });

    it("displays error when fewer than 2 products are provided", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({
            detail: "Debes seleccionar al menos 2 productos para comparar.",
          }),
        })
      );

      render(<ProductComparisonView />);
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Debes seleccionar al menos 2 productos");
      });
    });
  });
});
