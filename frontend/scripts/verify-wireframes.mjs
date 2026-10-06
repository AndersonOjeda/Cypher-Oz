import { chromium, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch();
const results = [];
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
    await page.keyboard.press("Tab");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(links.nth(1)).toBeFocused();
    await expect(links.nth(1)).toHaveCSS("outline-style", "solid");
    await expect(links.nth(1)).toHaveCSS("outline-width", "3px");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "UI-02",
    );
    const contrast = await page.evaluate(() => {
      const luminance = (color) => {
        const rgb = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
        const linear = rgb.map((value) => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      return ["body", ".caption", ".primary", '[aria-current="page"]'].map(
        (selector) => {
          const element = document.querySelector(selector);
          let backgroundElement = element;
          while (
            getComputedStyle(backgroundElement).backgroundColor ===
            "rgba(0, 0, 0, 0)"
          ) {
            backgroundElement = backgroundElement.parentElement;
          }
          const foreground = luminance(getComputedStyle(element).color);
          const background = luminance(
            getComputedStyle(backgroundElement).backgroundColor,
          );
          return {
            selector,
            ratio:
              (Math.max(foreground, background) + 0.05) /
              (Math.min(foreground, background) + 0.05),
          };
        },
      );
    });
    for (const { ratio } of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
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
    for (const state of ["loading", "empty"]) {
      await page.getByLabel("Estado de la vista").selectOption(state);
      await expect(page.getByRole("status")).toBeVisible();
    }
    await page.getByLabel("Estado de la vista").selectOption("stock");
    await expect(page.locator(".primary")).toBeDisabled();
    await page.getByLabel("Estado de la vista").selectOption("normal");
    await links.nth(5).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "UI-09",
    );
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
    results.push({
      width,
      views: 28,
      keyboard: "passed",
      focus: "passed",
      states: "passed",
      contrast,
    });
    await page.close();
  }
  console.log(
    "PASS: 28 wireframes, mobile/desktop, keyboard/focus, text contrast, overflow, loading/empty/error/stock and payment state.",
  );
  await writeFile(
    new URL(
      "../../docs/evidence/sprint-1-current/wireframes-checks.json",
      import.meta.url,
    ),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        results,
        scope: "Basic checks, not a full accessibility certification",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
