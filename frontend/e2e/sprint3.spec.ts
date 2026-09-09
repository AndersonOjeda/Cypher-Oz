import { test, expect, Page } from "@playwright/test";

async function signInAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@tti.example");
  await page.getByLabel("Contraseña").fill("E2e-Only!TestPassword8472");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("link", { name: "Administrar catálogo" }),
  ).toBeVisible();
}

test("variantes estándar, atributos, precio exacto y disponibilidad persisten", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Failed to load resource")
    )
      errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500)
      errors.push(`${response.status()} ${response.url()}`);
  });
  expect(await (await page.request.get("/health/")).json()).toEqual({
    status: "ok",
    database: "postgresql",
  });
  await signInAdmin(page);
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const headers = { "X-CSRFToken": csrf };
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const ids: number[] = [];
  for (const kind of ["categories", "brands"]) {
    const response = await page.request.post(`/api/v1/admin/${kind}/`, {
      headers,
      data: { name: `${kind} variantes ${suffix}`, slug: `${kind}-${suffix}` },
    });
    expect(response.status()).toBe(201);
    ids.push((await response.json()).id);
  }
  const name = `Auriculares ${suffix}`;
  const response = await page.request.post("/api/v1/admin/products/", {
    headers,
    data: {
      name,
      slug: `auriculares-${suffix}`,
      description: "Producto aislado de prueba",
      category: ids[0],
      brand: ids[1],
      is_active: true,
    },
  });
  expect(response.status()).toBe(201);
  const product = await response.json();
  expect(product.catalog_available).toBe(false);
  await page.getByRole("link", { name: "Administrar catálogo" }).click();
  await page
    .getByRole("button", { name: `Editar ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Variantes del producto" }),
  ).toBeVisible();
  const productSlug = page.getByLabel("Identificador del producto", {
    exact: true,
  });
  await productSlug.fill("identificador inválido");
  expect(
    await productSlug.evaluate((input: HTMLInputElement) =>
      input.checkValidity(),
    ),
  ).toBe(false);
  await productSlug.fill(product.slug);
  await expect(
    page.getByLabel("Nombre de la variante", { exact: true }),
  ).toHaveValue("Estándar");
  const sku = `TTI-${suffix}`.toUpperCase();
  await page.getByLabel("SKU", { exact: true }).fill(sku.toLowerCase());
  await page.getByLabel("Precio (COP)", { exact: true }).fill("0");
  const creation = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/products/${product.id}/variants/`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Guardar variante", exact: true })
    .click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const variant = await created.json();
  expect(variant.price).toBe("0.00");
  expect(variant.name).toBe("Estándar");
  expect(variant.attributes).toEqual([]);
  expect(variant.catalog_available).toBe(true);
  const edit = page.getByRole("button", {
    name: `Editar variante ${sku}`,
    exact: true,
  });
  await expect(edit).toBeVisible();
  await edit.click();
  await page.getByLabel("Precio (COP)", { exact: true }).fill("12345.67");
  const priceChange = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/variants/${variant.id}/`) &&
      r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Guardar variante", exact: true })
    .click();
  expect((await priceChange).status()).toBe(200);
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/variants/${variant.id}/`)
      ).json()
    ).price,
  ).toBe("12345.67");
  await page
    .getByRole("button", { name: "Nueva variante", exact: true })
    .click();
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page.getByLabel("Precio (COP)", { exact: true }).fill("19.99");
  const duplicate = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/products/${product.id}/variants/`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Guardar variante", exact: true })
    .click();
  expect((await duplicate).status()).toBe(409);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Precio (COP)", { exact: true })).toHaveValue(
    "19.99",
  );
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/products/${product.id}/variants/`)
      ).json()
    ).count,
  ).toBe(1);
  await page.getByText("Atributos de la categoría", { exact: true }).click();
  const attributeCode = page.getByLabel("Código del atributo", { exact: true });
  await attributeCode.fill("color?");
  expect(
    await attributeCode.evaluate((input: HTMLInputElement) =>
      input.checkValidity(),
    ),
  ).toBe(false);
  await attributeCode.fill("color");
  await page.getByLabel("Nombre del atributo", { exact: true }).fill("Color");
  await page
    .getByRole("button", { name: "Guardar atributo", exact: true })
    .click();
  await expect(
    page.getByLabel("Color (opcional)", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Editar variante ${sku}`, exact: true })
    .click();
  await page.getByLabel("Nombre de la variante", { exact: true }).fill("Azul");
  await page
    .getByLabel("Color (opcional)", { exact: true })
    .fill("Azul oscuro");
  const attributeChange = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/variants/${variant.id}/`) &&
      r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Guardar variante", exact: true })
    .click();
  expect((await attributeChange).status()).toBe(200);
  await page.reload();
  await page
    .getByRole("button", { name: `Editar ${name}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: `Editar variante ${sku}`, exact: true })
    .click();
  await expect(page.getByLabel("Precio (COP)", { exact: true })).toHaveValue(
    "12345.67",
  );
  await expect(
    page.getByLabel("Color (opcional)", { exact: true }),
  ).toHaveValue("Azul oscuro");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("heading", { name: "Variantes del producto" })
    .scrollIntoViewIfNeeded();
  await testInfo.attach(`${testInfo.project.name}-variants`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page
    .getByRole("button", { name: `Desactivar variante ${sku}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Activar variante ${sku}`, exact: true }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/variants/${variant.id}/`)
      ).json()
    ).catalog_available,
  ).toBe(false);
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/products/${product.id}/`)
      ).json()
    ).catalog_available,
  ).toBe(false);
  await page
    .getByRole("button", { name: `Activar variante ${sku}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Desactivar variante ${sku}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/products/${product.id}/`)
      ).json()
    ).catalog_available,
  ).toBe(true);
  // Data is retained only in the isolated tti_e2e database; no invented order flow.
  expect(errors).toEqual([]);
});

test("visitante y cliente no gestionan variantes, precios ni atributos", async ({
  page,
}, testInfo) => {
  const paths = [
    "products/1/variants/",
    "variants/1/",
    "categories/1/attributes/",
    "attributes/1/",
  ];
  for (const path of paths) {
    expect(
      (
        await page.request.patch(`/api/v1/admin/${path}`, {
          data: { price: "1.00" },
        })
      ).status(),
    ).toBe(401);
  }
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const email = `variant-client-${testInfo.project.name}-${Date.now()}@example.com`;
  const password = "E2e-Client!SecurePass8472";
  expect(
    (
      await page.request.post("/api/v1/auth/register/", {
        headers: { "X-CSRFToken": csrf },
        data: { name: "Cliente variantes", email, password },
      })
    ).status(),
  ).toBe(201);
  const login = await page.request.post("/api/v1/auth/login/", {
    headers: { "X-CSRFToken": csrf },
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  const headers = { "X-CSRFToken": (await login.json()).csrfToken };
  for (const path of paths) {
    expect(
      (
        await page.request.patch(`/api/v1/admin/${path}`, {
          headers,
          data: { price: "1.00" },
        })
      ).status(),
    ).toBe(403);
  }
  await page.goto("/admin/catalogo");
  await expect(
    page.getByRole("heading", { name: "Acceso administrativo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar variante" }),
  ).toHaveCount(0);
});
