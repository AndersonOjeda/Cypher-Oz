import { chromium, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      baseURL: "http://localhost:3002",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) errors.push(response.url());
    });
    expect((await page.request.get("/health/")).status()).toBe(200);
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("admin@sprint1.example");
    await page.getByLabel("Contraseña").fill("Demo-Sprint1!Clase8472");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(
      page.getByRole("heading", { name: "Hola, Administrador demo" }),
    ).toBeVisible();
    if (width === 1440) await page.screenshot({ path: fileURLToPath(new URL("../../docs/evidence/sprint-1-current/demo-preview.png", import.meta.url)) });
    await page.screenshot({
      path: fileURLToPath(
        new URL(
          `../../docs/evidence/sprint-1-current/account-${width}.png`,
          import.meta.url,
        ),
      ),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Configuración", exact: true })
      .click();
    const settingsResponse = await page.request.get("/api/v1/admin/settings/");
    expect(settingsResponse.status()).toBe(200);
    const settings = await settingsResponse.json();
    await expect(
      page.getByLabel("Plazo para reportar pago (horas)"),
    ).toHaveValue(String(settings.unpaid_order_timeout_hours));
    await expect(page.getByLabel("Canal habilitado")).toBeChecked({
      checked: settings.whatsapp_enabled,
    });
    await expect(page.getByLabel("Número con código de país")).toHaveValue(
      settings.whatsapp_number,
    );
    await page.getByLabel("Tarifa urbana (COP)").fill("");
    await expect(page.getByLabel("Tarifa urbana (COP)")).toHaveValue("");
    await page.getByLabel("Tarifa urbana (COP)").fill(
      String(settings.urban_flat_shipping_rate),
    );
    await page.screenshot({
      path: fileURLToPath(
        new URL(
          `../../docs/evidence/sprint-1-current/settings-${width}.png`,
          import.meta.url,
        ),
      ),
      fullPage: true,
    });
    await page.goto("/admin/catalogo");
    await page.getByRole("button", { name: "Categorías", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Nueva categoría" }),
    ).toBeVisible();
    await page.screenshot({
      path: fileURLToPath(
        new URL(
          `../../docs/evidence/sprint-1-current/categories-${width}.png`,
          import.meta.url,
        ),
      ),
      fullPage: true,
    });
    await page.goto("/comprar");
    await page.getByLabel("Buscar productos").fill("Teclado de demostración");
    await expect(page.getByRole("button", { name: "Agregar", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await page.getByLabel("Modalidad").selectOption("PICKUP");
    await page.getByRole("button", { name: "Revisar total", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirmar pedido", exact: true })).toBeEnabled();
    await page.screenshot({
      path: fileURLToPath(new URL(`../../docs/evidence/sprint-1-current/demo-checkout-${width}.png`, import.meta.url)),
      fullPage: true,
    });
    await page.goto("/admin/inventario");
    await page.getByLabel("Buscar SKU o producto").fill("DEMO-CHECKOUT-01");
    await expect(page.getByRole("button", { name: /Registrar entrada: DEMO-CHECKOUT-01/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: classroom demo health, admin login, account, configuration, categories, checkout preview and inventory in mobile/desktop; no order created.",
  );
} finally {
  await browser.close();
}
