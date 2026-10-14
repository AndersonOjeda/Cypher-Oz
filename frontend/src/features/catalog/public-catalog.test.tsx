import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicCatalog } from "./public-catalog";

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn((path: string) => {
    if (path.includes("/categories/")) {
      return Promise.resolve({
        results: [
          { id: 1, name: "Computadores", slug: "computadores", is_active: true },
          { id: 2, name: "Audio", slug: "audio", is_active: true },
        ],
        count: 2,
        next: null,
        previous: null,
      });
    }
    if (path.includes("/brands/")) {
      return Promise.resolve({
        results: [
          { id: 10, name: "Lenovo", slug: "lenovo", is_active: true },
          { id: 20, name: "Sony", slug: "sony", is_active: true },
        ],
        count: 2,
        next: null,
        previous: null,
      });
    }
    if (path.includes("/products/")) {
      if (path.includes("search=inexistente")) {
        return Promise.resolve({
          count: 0,
          next: null,
          previous: null,
          results: [],
        });
      }
      return Promise.resolve({
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 101,
            name: "Laptop ThinkPad E14",
            slug: "laptop-thinkpad-e14",
            category: { id: 1, name: "Computadores", slug: "computadores" },
            brand: { id: 10, name: "Lenovo", slug: "lenovo" },
            image_url: "https://example.com/thinkpad.webp",
            min_price: "3200000.00",
            max_price: "3500000.00",
            promotional_min_price: "2990000.00",
            has_promotion: true,
            total_stock: 5,
            is_available: true,
            variants_count: 2,
          },
          {
            id: 102,
            name: "Auriculares WH-1000XM5",
            slug: "auriculares-wh-1000xm5",
            category: { id: 2, name: "Audio", slug: "audio" },
            brand: { id: 20, name: "Sony", slug: "sony" },
            image_url: null,
            min_price: "1500000.00",
            max_price: "1500000.00",
            promotional_min_price: null,
            has_promotion: false,
            total_stock: 0,
            is_available: false,
            variants_count: 1,
          },
        ],
      });
    }
    return Promise.reject(new Error(`Unhandled path: ${path}`));
  }),
};
});

describe("PublicCatalog Component (HU-04 / HU-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("renders catalog products with images, prices, promo badges, and stock availability", async () => {
    render(<PublicCatalog />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando catálogo de productos...");

    await waitFor(() => {
      expect(screen.getByText("Laptop ThinkPad E14")).toBeInTheDocument();
      expect(screen.getByText("Auriculares WH-1000XM5")).toBeInTheDocument();
    });

    // Check promo badge for promotional product
    expect(screen.getByText("¡Oferta!")).toBeInTheDocument();

    // Check stock indicators
    expect(screen.getByText(/5 disponibles/i)).toBeInTheDocument();
    expect(screen.getByText(/Agotado/i)).toBeInTheDocument();

    // Check links to details
    const links = screen.getAllByRole("link", { name: "Ver detalle" });
    expect(links[0]).toHaveAttribute("href", "/catalogo/laptop-thinkpad-e14");
  });

  it("allows searching and updates query parameters", async () => {
    render(<PublicCatalog />);

    await waitFor(() => {
      expect(screen.getByText("Laptop ThinkPad E14")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Ej. Laptop, Monitor/i);
    fireEvent.change(searchInput, { target: { value: "ThinkPad" } });
    fireEvent.submit(searchInput.closest("form")!);

    expect(pushMock).toHaveBeenCalledWith("/catalogo?search=ThinkPad");
  });

  it("filters by category and brand", async () => {
    render(<PublicCatalog />);

    await waitFor(() => {
      expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText("Categoría");
    fireEvent.change(categorySelect, { target: { value: "computadores" } });

    expect(pushMock).toHaveBeenCalledWith("/catalogo?category=computadores");

    const brandSelect = screen.getByLabelText("Marca");
    fireEvent.change(brandSelect, { target: { value: "lenovo" } });

    expect(pushMock).toHaveBeenCalledWith("/catalogo?brand=lenovo");
  });

  it("shows empty state when no products match filters", async () => {
    mockSearchParams = new URLSearchParams("search=inexistente");
    render(<PublicCatalog />);

    await waitFor(() => {
      expect(
        screen.getByText("No se encontraron productos"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Restablecer filtros" }),
    ).toBeInTheDocument();
  });
});
