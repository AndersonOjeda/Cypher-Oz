import { expect, test } from "@playwright/test";

test("secretary reviews drafts, saves real stock unpublished and prepares a printable catalog", async ({
  page,
}, info) => {
  const suffix = `secretary-${info.project.name}-${Date.now()}`;
  const name = `Cargador ${suffix}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/secretaria");
  await expect(
    page.getByRole("heading", { name: "Acceso administrativo" }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@tti.example");
  await page.getByLabel("Contraseña").fill("E2e-Only!TestPassword8472");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("link", { name: "Administrar catálogo", exact: true }),
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
  await page.route("**/api/v1/admin/assistant/intake/", (route) =>
    route.fulfill({
      json: {
        products: [
          {
            name,
            description: "Cargador de prueba",
            price: null,
            stock: null,
            category_name: `categories ${suffix}`,
            brand_name: `brands ${suffix}`,
          },
        ],
      },
    }),
  );
  await page.goto("/admin/secretaria");
  await page
    .getByLabel("Información de los productos")
    .fill(`${name}, precio de venta 125000 COP, cuatro unidades`);
  await page.getByRole("button", { name: "Preparar borradores" }).click();
  await expect(
    page.getByRole("heading", { name: "2. Revisa y guarda" }),
  ).toBeFocused();
  await expect(page.getByLabel("Precio de venta (COP)")).toHaveValue("");
  await page.getByLabel("Precio de venta (COP)").fill("125000");
  await page.getByLabel("Unidades disponibles").fill("4");
  await page
    .getByRole("combobox", { name: "Categoría", exact: true })
    .selectOption(String(ids[0]));
  await page
    .getByRole("combobox", { name: "Marca", exact: true })
    .selectOption(String(ids[1]));
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/admin/products/") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Confirmar y guardar sin publicar" })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const product = await response.json();
  expect(product.is_active).toBe(false);
  expect(product.total_stock).toBe(4);
  const opened = page.context().waitForEvent("page");
  await page.getByRole("link", { name: /Añadir fotos y publicar/ }).click();
  const editor = await opened;
  await expect(
    editor.getByRole("heading", { name: `Editar producto: ${name}` }),
  ).toBeFocused();
  await expect(
    editor.getByRole("status", { name: "Unidades disponibles", exact: true }),
  ).toHaveText("4 unidades");
  await editor.close();
  await expect(
    page.getByRole("heading", { name: "2. Revisa y guarda" }),
  ).toBeVisible();
  const publish = await page.request.patch(
    `/api/v1/admin/products/${product.id}/`,
    { headers: { "X-CSRFToken": csrf }, data: { is_active: true } },
  );
  expect(publish.status()).toBe(200);
  const publicResponse = await page.request.get(
    `/api/v1/products/?search=${encodeURIComponent(name)}`,
  );
  const snapshot = (await publicResponse.json()).results.find(
    (p: { id: number }) => p.id === product.id,
  );
  expect(snapshot).toBeTruthy();
  await page.route("**/api/v1/admin/assistant/catalog/", (route) =>
    route.fulfill({
      json: {
        title: "Accesorios para estudiar",
        introduction: "Una selección para tus clases.",
        products: [snapshot],
        prepared_at: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/admin/secretaria");
  await page.getByRole("button", { name: /Preparar un catálogo/ }).click();
  await page
    .getByLabel("Instrucciones para el catálogo")
    .fill("Para estudiantes");
  await page.getByLabel("Buscar productos").fill(name);
  const found = page.waitForResponse(
    (r) =>
      r.url().includes("/api/v1/products/?") &&
      r.url().includes("search=Cargador"),
  );
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await found;
  await page
    .getByRole("button", { name: "Elegir disponibles de esta página" })
    .click();
  await page.getByRole("button", { name: "Preparar catálogo con IA" }).click();
  const preview = page.getByRole("article", {
    name: "Vista previa del catálogo",
  });
  await expect(preview.getByText("4 unidades disponibles")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "2. Revisa y comparte" }),
  ).toBeFocused();
  await page.screenshot({
    path: `test-results/secretary-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "Secretaria IA", exact: true }),
  ).not.toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Accesorios para estudiar" }),
  ).toBeVisible();
  if (info.project.name === "desktop")
    await page.pdf({
      path: "test-results/secretary-catalog.pdf",
      format: "A4",
      printBackground: true,
    });
  expect(errors).toEqual([]);
});
