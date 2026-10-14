import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("QA - UTF-8 and Spanish Orthography Verification (CO-74)", () => {
  const targetFiles = [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/catalogo/page.tsx",
    "src/features/catalog/public-catalog.tsx",
    "src/features/catalog/product-detail.tsx",
    "src/features/orders/purchase.tsx",
    "src/features/orders/cart-storage.ts",
  ];

  it("ensures all public pages and components are valid UTF-8 without byte order marks or mojibake", () => {
    for (const relativePath of targetFiles) {
      const fullPath = path.resolve(__dirname, "../../..", relativePath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const buffer = fs.readFileSync(fullPath);
      // Verify no UTF-8 BOM (0xEF, 0xBB, 0xBF)
      if (buffer.length >= 3) {
        const hasBom =
          buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        expect(hasBom).toBe(false);
      }

      const content = buffer.toString("utf-8");
      // Check for common Latin-1 mojibake double encoding artifacts (Ã¡, Ã©, Ã±, etc.)
      expect(content).not.toMatch(/Ã[¡©­³º±]/);
      expect(content).not.toMatch(/[\uFFFD]/); // Unicode replacement character
    }
  });

  it("verifies accurate Spanish characters (á, é, í, ó, ú, ñ, ¡, ¿) in catalog and detail texts", () => {
    const catalogPath = path.resolve(
      __dirname,
      "../../../src/features/catalog/public-catalog.tsx",
    );
    const catalogContent = fs.readFileSync(catalogPath, "utf-8");

    expect(catalogContent).toContain("Catálogo de Productos");
    expect(catalogContent).toContain("Nariño");
    expect(catalogContent).toContain("garantía");
    expect(catalogContent).toContain("Categoría");
    expect(catalogContent).toContain("Mínimo");
    expect(catalogContent).toContain("Máximo");
    expect(catalogContent).toContain("¡Oferta!");

    const detailPath = path.resolve(
      __dirname,
      "../../../src/features/catalog/product-detail.tsx",
    );
    const detailContent = fs.readFileSync(detailPath, "utf-8");

    expect(detailContent).toContain("Catálogo");
    expect(detailContent).toContain("Garantía TTI");
    expect(detailContent).toContain("Descripción del producto");
    expect(detailContent).toContain("¡Añadido al carrito con éxito!");
    expect(detailContent).toContain("Añadir al carrito");
  });
});
