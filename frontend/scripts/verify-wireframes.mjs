import { chromium, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      new URL("../../docs/wireframes.html", import.meta.url).href,
    );
    const links = page
      .getByRole("navigation", { name: "Vistas del MVP" })
      .getByRole("link");
    await expect(links).toHaveCount(28);
    for (let i = 0; i < 28; i++) {
      await links.nth(i).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        `UI-${String(i + 1).padStart(2, "0")}`,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByLabel("Estado de la vista").selectOption("error");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await links.nth(5).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("UI-09");
    await links.nth(13).click();
    await page.getByLabel("Estado del pago").selectOption("Reportado");
    await expect(
      page.getByText("Pago en revisión. Aún no confirmado."),
    ).toBeVisible();
    await page.screenshot({
      path: fileURLToPath(
        new URL(
          `../../docs/evidence/sprint-1-current/wireframes-${width}.png`,
          import.meta.url,
        ),
      ),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: 28 wireframes, mobile/desktop navigation, overflow, error recovery and payment state.",
  );
} finally {
  await browser.close();
}
