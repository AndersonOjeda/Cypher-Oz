import { expect, test } from "@playwright/test";

test("HU-32 solicita recuperación sin revelar si la cuenta existe", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  await page
    .getByLabel("Correo electrónico")
    .fill(`desconocido-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Si el correo está registrado, recibirás instrucciones",
  );
  await expect(
    page.getByRole("link", { name: "Volver al inicio de sesión" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("HU-32 rechaza confirmación sin token", async ({ page }) => {
  await page.goto("/restablecer-contrasena");
  await expect(
    page.getByText("El enlace de recuperación está incompleto.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cambiar contraseña" }),
  ).toHaveCount(0);
});
