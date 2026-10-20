import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY } from "@/features/orders/cart-storage";
import { ProductDetail } from "./product-detail";

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn((path: string) => {
      if (path.includes("/products/laptop-thinkpad/")) {
        return Promise.resolve({
          id: 1,
          name: "Laptop ThinkPad E14",
          slug: "laptop-thinkpad",
          description:
            "Potente portátil para productividad con procesador AMD Ryzen 7.",
          warranty: "12 meses con soporte técnico local en Pasto.",
          category: { id: 1, name: "Computadores", slug: "computadores" },
          brand: { id: 10, name: "Lenovo", slug: "lenovo" },
          images: [
            {
              id: 101,
              url: "https://example.com/thinkpad-1.webp",
              alt_text: "Vista frontal",
              sort_order: 1,
            },
            {
              id: 102,
              url: "https://example.com/thinkpad-2.webp",
              alt_text: "Vista lateral",
              sort_order: 2,
            },
          ],
          variants: [
            {
              id: 201,
              name: "16GB RAM / 512GB SSD",
              sku: "LNV-TP-16",
              price: "3500000.00",
              promotional_price: "3150000.00",
              promotion_name: "Cyber Days",
              stock: 4,
              attributes: [
                { code: "ram", name: "RAM", value: "16GB" },
                { code: "storage", name: "Almacenamiento", value: "512GB" },
              ],
            },
            {
              id: 202,
              name: "32GB RAM / 1TB SSD",
              sku: "LNV-TP-32",
              price: "4200000.00",
              promotional_price: null,
              promotion_name: null,
              stock: 0,
              attributes: [
                { code: "ram", name: "RAM", value: "32GB" },
                { code: "storage", name: "Almacenamiento", value: "1TB" },
              ],
            },
          ],
          total_stock: 4,
          is_available: true,
        });
      }
      return Promise.reject(
        new Error("Producto no encontrado o no disponible."),
      );
    }),
  };
});

describe("ProductDetail Component (HU-06 / HU-08)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders product detail, warranty, specifications and gallery", async () => {
    render(<ProductDetail slug="laptop-thinkpad" />);

    expect(
      screen.getByText("Cargando detalles del producto..."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Laptop ThinkPad E14",
      );
    });

    expect(
      screen.getByText(/12 meses con soporte técnico local en Pasto/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Potente portátil para productividad/i),
    ).toBeInTheDocument();
  });

  it("updates SKU, price, discount badge and stock when changing variant", async () => {
    render(<ProductDetail slug="laptop-thinkpad" />);

    await waitFor(() => {
      expect(screen.getByText(/LNV-TP-16/)).toBeInTheDocument();
    });

    // Variant 1 has promotion
    expect(screen.getAllByText("Cyber Days").length).toBeGreaterThan(0);
    expect(screen.getByText(/4 unidades disponibles/i)).toBeInTheDocument();

    // Select variant 2 (out of stock)
    const variant2Btn = screen.getByRole("radio", {
      name: /32GB RAM \/ 1TB SSD/i,
    });
    fireEvent.click(variant2Btn);

    await waitFor(() => {
      expect(screen.getByText(/LNV-TP-32/)).toBeInTheDocument();
      expect(
        screen.getByText(/Variante actualmente agotada/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Producto agotado" }),
      ).toBeDisabled();
    });
  });

  it("adds variant to anonymous cart in localStorage without login", async () => {
    render(<ProductDetail slug="laptop-thinkpad" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Añadir al carrito/i }),
      ).toBeEnabled();
    });

    const addBtn = screen.getByRole("button", { name: /Añadir al carrito/i });
    fireEvent.click(addBtn);

    // Confirmation message shown
    expect(
      screen.getByText("¡Añadido al carrito con éxito!"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver carrito y finalizar compra/i }),
    ).toHaveAttribute("href", "/comprar");

    // Check localStorage content
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0]).toEqual({
      variant_id: 201,
      quantity: 1,
      label: "Laptop ThinkPad E14 · 16GB RAM / 512GB SSD",
      unit_price: "3150000.00",
    });
  });

  it("shows error state when product is not found", async () => {
    render(<ProductDetail slug="no-existe" />);

    await waitFor(() => {
      expect(
        screen.getByText("Producto no encontrado o no disponible."),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /Reintentar/i }),
    ).toBeInTheDocument();
  });
});
