import { expect, test } from "@playwright/test";

test("admin changes sections using responsive navigation; visitors do not see the menu", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/catalogo");
  await expect(
    page.getByRole("heading", { name: "Acceso administrativo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Secciones de administración" }),
  ).toHaveCount(0);
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@tti.example");
  await page.getByLabel("Contraseña").fill("E2e-Only!TestPassword8472");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page
    .getByRole("link", { name: "Administrar catálogo", exact: true })
    .click();
  const navigation = page.getByRole("navigation", {
    name: "Secciones de administración",
  });
  const toggle = page.getByRole("button", { name: /Menú de administración/ });
  const compact = testInfo.project.name !== "desktop";
  if (compact) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(navigation).not.toBeVisible();
    await toggle.click();
    await expect(navigation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(navigation).not.toBeVisible();
    await toggle.click();
  } else {
    await expect(toggle).not.toBeVisible();
    await expect(navigation).toBeVisible();
  }
  await expect(
    navigation.getByRole("link", { name: "Administrar catálogo" }),
  ).toHaveAttribute("aria-current", "page");
  await navigation
    .getByRole("link", { name: "Inventario", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  if (compact) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
  }
  await expect(
    navigation.getByRole("link", { name: "Inventario", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation
    .getByRole("link", { name: "Configuración", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/configuracion$/);
  await expect(
    page.getByRole("button", { name: "Guardar configuración", exact: true }),
  ).toBeVisible();
  if (compact) await toggle.click();
  await expect(
    navigation.getByRole("link", { name: "Configuración", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    navigation.getByRole("link", { name: "Mis pedidos", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/admin-navigation-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
