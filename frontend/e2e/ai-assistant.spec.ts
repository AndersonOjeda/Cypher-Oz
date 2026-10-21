import { expect, test } from "@playwright/test";

test("assistant handles a conversation, errors and keyboard access", async ({
  page,
}, info) => {
  const payloads: { message: string; history: unknown[] }[] = [];
  await page.route("**/api/v1/assistant/chat/", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
    } else {
      payloads.push(route.request().postDataJSON());
      await route.fulfill(
        payloads.length === 1
          ? { json: { reply: "Hay cargadores disponibles en el catálogo." } }
          : { status: 429, json: { detail: "Throttled" } },
      );
    }
  });
  await page.goto("/catalogo");
  const toggle = page.getByRole("button", { name: "Abrir asistente virtual" });
  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Asistente virtual de TTI" });
  const input = page.getByRole("textbox", { name: "Escribe tu mensaje" });
  await expect(input).toBeFocused();
  await input.fill("¿Tienen cargadores?");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(
    dialog.getByText("Hay cargadores disponibles en el catálogo."),
  ).toBeVisible();
  expect(payloads[0]).toEqual({ message: "¿Tienen cargadores?", history: [] });
  await input.fill("Gracias");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(dialog.getByText(/Espera un minuto/)).toBeVisible();
  expect(payloads[1].history).toHaveLength(2);
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  await page.screenshot({
    path: `test-results/ai-assistant-${info.project.name}.png`,
  });
  await input.focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir asistente virtual" }),
  ).toBeFocused();
});

test("assistant stays hidden without an API key", async ({ page }) => {
  await page.route("**/api/v1/assistant/chat/", (route) =>
    route.fulfill({ json: { available: false } }),
  );
  await page.goto("/catalogo");
  await expect(
    page.getByRole("heading", { name: /Catálogo/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir asistente virtual" }),
  ).toHaveCount(0);
});
