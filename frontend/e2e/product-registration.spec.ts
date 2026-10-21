import { expect, test } from "@playwright/test";

test("registro sencillo guarda precio y unidades; otra presentación genera su código y suma existencias", async ({
  page,
}, testInfo) => {
  const suffix = `ux-${testInfo.project.name}-${Date.now()}`;
  const name = `Registro sencillo ${suffix}`;
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@tti.example");
  await page.getByLabel("Contraseña").fill("E2e-Only!TestPassword8472");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("link", { name: "Administrar catálogo" }),
  ).toBeVisible();
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const ids: number[] = [];
  for (const kind of ["categories", "brands"]) {
    const response = await page.request.post(`/api/v1/admin/${kind}/`, {
      headers: { "X-CSRFToken": csrf },
      data: { name: `${kind} ${suffix}`, slug: `${kind}-${suffix}` },
    });
    expect(response.status()).toBe(201);
    ids.push((await response.json()).id);
  }
  await page.getByRole("link", { name: "Administrar catálogo" }).click();
  await page.getByLabel("Nombre del producto", { exact: true }).fill(name);
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption(String(ids[0]));
  await page.getByLabel("Marca", { exact: true }).selectOption(String(ids[1]));
  await page
    .getByLabel("Precio de venta (COP)", { exact: true })
    .fill("125000.50");
  await page
    .getByRole("spinbutton", { name: "Unidades disponibles", exact: true })
    .fill("7");
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Producto de prueba del registro simplificado.");
  await expect(page.getByLabel("Identificador del producto")).toHaveCount(0);
  const creation = page.waitForResponse(
    (r) =>
      r.url().endsWith("/admin/products/") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Guardar y continuar con fotos" })
    .click();
  const response = await creation;
  expect(response.status()).toBe(201);
  const product = await response.json();
  expect(product.total_stock).toBe(7);
  await page.getByRole("button", { name: "Terminar registro" }).click();
  await expect(
    page.getByRole("heading", { name: "Registro terminado" }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Ver o editar este producto" })
    .click();
  await expect(
    page.getByRole("status", { name: "Unidades disponibles", exact: true }),
  ).toHaveText("7 unidades");
  await expect(page.getByLabel("Nombre de la presentación")).toHaveCount(0);
  await page.getByRole("button", { name: "Añadir otra presentación" }).click();
  await expect(
    page.getByRole("heading", { name: "Añadir una presentación" }),
  ).toBeFocused();
  await page.getByLabel("Nombre de la presentación").fill("Azul · 256 GB");
  await page
    .getByLabel("Precio de venta (COP)", { exact: true })
    .fill("150000");
  await page
    .getByRole("spinbutton", { name: "Unidades disponibles", exact: true })
    .fill("3");
  await expect(page.getByLabel("SKU", { exact: true })).not.toBeVisible();
  const variantCreation = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/products/${product.id}/variants/`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Guardar presentación", exact: true })
    .click();
  const variantResponse = await variantCreation;
  expect(variantResponse.status()).toBe(201);
  const variant = await variantResponse.json();
  expect(variant.sku).toMatch(/^TTI-/);
  expect(variant.stock).toBe(3);
  await expect(
    page.getByRole("status", { name: "Unidades disponibles", exact: true }),
  ).toHaveText("10 unidades");
  const publicResponse = await page.request.get(
    `/api/v1/products/?search=${encodeURIComponent(name)}`,
  );
  expect(publicResponse.status()).toBe(200);
  const listed = (await publicResponse.json()).results.find(
    (item: { id: number }) => item.id === product.id,
  );
  expect(listed).toMatchObject({
    total_stock: 10,
    is_available: true,
    variants_count: 2,
  });
  await page.reload();
  await page
    .getByRole("button", { name: `Editar ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Unidades disponibles", exact: true }),
  ).toHaveText("10 unidades");
  await expect(
    page.getByText("3 unidades disponibles", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
