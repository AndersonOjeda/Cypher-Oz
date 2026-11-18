import { expect, test } from "@playwright/test";

test("variant images persist and change with the selected model", async ({
  page,
}, info) => {
  const suffix = `variant-images-${info.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@tti.example");
  await page.getByLabel("Contraseña").fill("E2e-Only!TestPassword8472");
  const login = page.waitForResponse(
    (r) => r.url().endsWith("/auth/login/") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  expect((await login).status()).toBe(200);
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  const headers = { "X-CSRFToken": csrf };
  const ids: number[] = [];
  for (const kind of ["categories", "brands"]) {
    const response = await page.request.post(`/api/v1/admin/${kind}/`, {
      headers,
      data: { name: `${kind}-${suffix}`, slug: `${kind}-${suffix}` },
    });
    expect(response.status()).toBe(201);
    ids.push((await response.json()).id);
  }
  const created = await page.request.post("/api/v1/admin/products/", {
    headers,
    data: {
      name: suffix,
      slug: suffix,
      description: "Dos colores para comprobar sus imágenes.",
      category: ids[0],
      brand: ids[1],
      is_active: true,
      initial_price: "100000",
      initial_stock: 2,
    },
  });
  expect(created.status()).toBe(201);
  const product = await created.json();
  const variants = await (
    await page.request.get(`/api/v1/admin/products/${product.id}/variants/`)
  ).json();
  const standard = variants.results[0];
  const whiteResponse = await page.request.post(
    `/api/v1/admin/products/${product.id}/variants/`,
    {
      headers,
      data: {
        name: "Blanco",
        sku: `WHITE-${suffix}`,
        price: "105000",
        is_active: true,
        attributes: [],
      },
    },
  );
  expect(whiteResponse.status()).toBe(201);
  const white = await whiteResponse.json();
  await page.goto(`/admin/catalogo?editar=${product.id}`);
  await expect(
    page.getByRole("heading", { name: `Editar producto: ${suffix}` }),
  ).toBeVisible();
  const png = await page.screenshot();
  for (const [variant, alt] of [
    [standard.id, "Modelo estándar"],
    [white.id, "Modelo blanco"],
  ] as const) {
    await page
      .getByLabel("Variante / modelo de la nueva imagen")
      .selectOption(String(variant));
    await page
      .getByLabel("Archivo de imagen")
      .setInputFiles({ name: "color.png", mimeType: "image/png", buffer: png });
    await page.getByLabel("Descripción de la nueva imagen").fill(alt);
    const uploaded = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/products/${product.id}/images/`) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Añadir imagen", exact: true })
      .click();
    const response = await uploaded;
    expect(response.status()).toBe(201);
    expect((await response.json()).variant_id).toBe(variant);
    await expect(
      page.getByRole("img", { name: alt, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByLabel("Variante / modelo de la imagen", { exact: true }).nth(1),
  ).toHaveValue(String(white.id));
  await page.goto(`/catalogo/${product.slug}`);
  const image = page.locator(".main-image-box img");
  await expect(image).toHaveAttribute("alt", "Modelo estándar");
  const standardUrl = await image.getAttribute("src");
  await page.getByRole("radio", { name: /Blanco/ }).click();
  await expect(image).toHaveAttribute("alt", "Modelo blanco");
  await expect
    .poll(() =>
      image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
    )
    .toBe(true);
  expect(await image.getAttribute("src")).not.toBe(standardUrl);
  await page.getByRole("radio", { name: /Estándar/ }).click();
  await expect(image).toHaveAttribute("alt", "Modelo estándar");
});
