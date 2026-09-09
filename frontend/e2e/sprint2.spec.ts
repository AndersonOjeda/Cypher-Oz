import { test, expect, Page } from "@playwright/test";

async function adminLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@tti.example");
  await page.getByLabel("Contraseña").fill("E2e-Only!TestPassword8472");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: "Administrar catálogo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tu catálogo",
  );
}

test("administrar catálogo completo con imágenes en almacenamiento real", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const category = `Accesorios ${suffix}`;
  const brand = `Marca ${suffix}`;
  const product = `Teclado ${suffix}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await adminLogin(page);
  for (const [tab, name] of [
    ["Categorías", category],
    ["Marcas", brand],
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Editar ${name}`, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Productos", exact: true }).click();
  await page.getByLabel("Nombre del producto", { exact: true }).fill(product);
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption({ label: category });
  await page
    .getByLabel("Marca", { exact: true })
    .selectOption({ label: brand });
  await page
    .getByLabel("Descripción del producto", { exact: true })
    .fill("Teclado USB de prueba, distribución en español.");
  await page.getByLabel("Garantía", { exact: true }).fill("12 meses");
  await page.getByLabel("Producto activo", { exact: true }).check();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/admin/products/") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const data = await response.json();
  await expect(
    page.getByRole("heading", { name: "Imágenes del producto" }),
  ).toBeVisible();
  // A screenshot provides valid PNG bytes; uploads travel through Next -> Django -> S3.
  const png = await page.screenshot();
  await page
    .getByLabel("Archivo de imagen")
    .setInputFiles({ name: "teclado.png", mimeType: "image/png", buffer: png });
  await page
    .getByLabel("Descripción de la nueva imagen")
    .fill("Vista frontal del teclado de prueba");
  await page
    .getByRole("button", { name: "Añadir imagen", exact: true })
    .click();
  const img = page.getByRole("img", {
    name: "Vista frontal del teclado de prueba",
    exact: true,
  });
  await expect(img).toBeVisible();
  await expect
    .poll(() =>
      img.evaluate(
        (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const source = (await img.getAttribute("src"))!;
  expect(source).toContain("tti-catalog-e2e");
  expect((await page.request.get(source)).status()).toBe(200);
  await page
    .getByLabel("Descripción de imagen", { exact: true })
    .fill("Imagen principal actualizada");
  await page.getByLabel("Orden", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Guardar imagen", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Imagen principal actualizada" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: `Editar ${product}`, exact: true })
    .click();
  await expect(page.getByLabel("Garantía", { exact: true })).toHaveValue(
    "12 meses",
  );
  await expect(
    page.getByRole("img", { name: "Imagen principal actualizada" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await testInfo.attach(`${testInfo.project.name}-catalog`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page
    .getByLabel("Archivo de imagen")
    .setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("broken"),
    });
  await page
    .getByLabel("Descripción de la nueva imagen")
    .fill("Archivo inválido");
  await page
    .getByRole("button", { name: "Añadir imagen", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "no es válida",
  );
  await page.getByRole("button", { name: "Categorías", exact: true }).click();
  await page
    .getByRole("button", { name: `Editar ${category}`, exact: true })
    .click();
  await page.getByLabel("Activo", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/products/${data.id}/`)
      ).json()
    ).catalog_visible,
  ).toBe(false);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Eliminar ${category}`, exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "relaciones",
  );
  await page.getByRole("button", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: `Editar ${product}`, exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Eliminar imagen", exact: true })
    .click();
  await expect(
    page.getByText("Este producto aún no tiene imágenes."),
  ).toBeVisible();
  expect((await page.request.get(source)).status()).toBe(404);
  await page.getByLabel("Producto activo", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(
    page.getByText("Producto guardado. Puedes gestionar sus imágenes abajo."),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Eliminar ${product}`, exact: true })
    .click();
  await expect(page.getByText("Producto eliminado.")).toBeVisible();
  for (const [tab, name] of [
    ["Categorías", category],
    ["Marcas", brand],
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: `Eliminar ${name}`, exact: true })
      .click();
    await expect(page.getByText("Registro eliminado.")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("visitante no accede al administrador ni a datos del catálogo", async ({
  page,
}) => {
  await page.goto("/admin/catalogo");
  await expect(
    page.getByRole("heading", { name: "Acceso administrativo" }),
  ).toBeVisible();
  for (const endpoint of ["categories", "brands", "products"]) {
    expect(
      (await page.request.get(`/api/v1/admin/${endpoint}/`)).status(),
    ).toBe(401);
  }
  await expect(
    page.getByRole("button", { name: "Guardar producto" }),
  ).toHaveCount(0);
});
