import { expect, test, type APIRequestContext } from "@playwright/test";

async function csrf(context: APIRequestContext) {
  return (await (await context.get("/api/v1/auth/csrf/")).json()).csrfToken;
}

test("Sprint 4: carrito real, autenticación tardía, cambios, entrega y privacidad", async ({
  page,
  playwright,
  browser,
}, info) => {
  test.setTimeout(120000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500)
      failures.push(`${response.status()} ${response.url()}`);
  });
  const stamp = `${info.project.name}-${Date.now()}`;
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
  });
  try {
    expect(
      (
        await admin.post("/api/v1/auth/login/", {
          headers: { "X-CSRFToken": await csrf(admin) },
          data: {
            email: "admin@tti.example",
            password: "E2e-Only!TestPassword8472",
          },
        })
      ).status(),
    ).toBe(200);
    const headers = { "X-CSRFToken": await csrf(admin) };
    async function create(path: string, data: object) {
      const response = await admin.post(`/api/v1/admin/${path}/`, {
        headers,
        data,
      });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    }
    const category = await create("categories", {
      name: `Sprint 4 ${stamp}`,
      slug: `s4-${stamp}`,
      is_active: true,
    });
    const brand = await create("brands", {
      name: `Sprint 4 ${stamp}`,
      slug: `s4-${stamp}`,
      is_active: true,
    });
    const product = await create("products", {
      name: `Producto Sprint 4 ${stamp}`,
      slug: `s4-${stamp}`,
      description: "Prueba integrada aislada",
      category: category.id,
      brand: brand.id,
      is_active: true,
    });
    const variant = await create(`products/${product.id}/variants`, {
      sku: `S4-${stamp}`,
      name: "Estándar",
      price: "50000.00",
      is_active: true,
    });
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 3,
      reason: "Sprint 4 E2E",
    });
    const email = `sprint4-${stamp}@example.com`;
    const password = "Sprint4-Only!Pass8472";
    expect(
      (
        await page.request.post("/api/v1/auth/register/", {
          headers: { "X-CSRFToken": await csrf(page.request) },
          data: { name: `Cliente ${stamp}`, email, password },
        })
      ).status(),
    ).toBe(201);
    await page.goto(`/catalogo/${product.slug}`);
    await page
      .getByRole("button", { name: "Añadir al carrito", exact: true })
      .click();
    await page.goto("/comprar");
    await expect(
      page.getByText(/Disponibilidad y precios confirmados/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("tti.purchase.cart")!).items[0]
            .unit_price,
      ),
    ).toBe("50000.00");
    expect(
      (
        await page.request.post("/api/v1/checkout/preview/", {
          headers: { "X-CSRFToken": await csrf(page.request) },
          data: {
            items: [{ variant_id: variant.id, quantity: 1 }],
            delivery_mode: "PICKUP",
          },
        })
      ).status(),
    ).toBe(401);
    await page
      .getByRole("link", { name: "Iniciar sesión para continuar" })
      .click();
    await create("inventory/adjustments", {
      variant: variant.id,
      quantity: -3,
      reason: "Cambio de stock durante autenticación",
    });
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(page).toHaveURL(/\/comprar$/);
    await page.getByRole("radio", { name: /Recogida en tienda/i }).check();
    await expect(page.getByText(/Agotado temporalmente/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeDisabled();
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 3,
      reason: "Reposición tras login",
    });
    await page.getByRole("button", { name: "Revalidar carrito ahora" }).click();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeEnabled();
    expect(
      (
        await admin.patch(`/api/v1/admin/variants/${variant.id}/`, {
          headers,
          data: { price: "60000.00" },
        })
      ).status(),
    ).toBe(200);
    const validationRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/checkout/validate/") &&
        request.method() === "POST",
    );
    await page.getByRole("button", { name: "Revalidar carrito ahora" }).click();
    expect((await validationRequest).postDataJSON().items[0].unit_price).toBe(
      "50000.00",
    );
    await expect(
      page.getByRole("button", { name: "Aceptar precios actualizados" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Aceptar precios actualizados" })
      .click();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeEnabled();
    for (const [path, entity] of [
      ["variants", variant],
      ["products", product],
      ["categories", category],
      ["brands", brand],
    ] as const) {
      expect(
        (
          await admin.patch(`/api/v1/admin/${path}/${entity.id}/`, {
            headers,
            data: { is_active: false },
          })
        ).status(),
      ).toBe(200);
      await page
        .getByRole("button", { name: "Revalidar carrito ahora" })
        .click();
      await expect(
        page.getByText("Este producto ya no está a la venta."),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Revisar total" }),
      ).toBeDisabled();
      expect(
        (
          await admin.patch(`/api/v1/admin/${path}/${entity.id}/`, {
            headers,
            data: { is_active: true },
          })
        ).status(),
      ).toBe(200);
      await page
        .getByRole("button", { name: "Revalidar carrito ahora" })
        .click();
      await expect(
        page.getByRole("button", { name: "Revisar total" }),
      ).toBeEnabled();
    }
    await create("inventory/adjustments", {
      variant: variant.id,
      quantity: -3,
      reason: "Agotamiento Sprint 4 E2E",
    });
    await page.getByRole("button", { name: "Revalidar carrito ahora" }).click();
    await expect(page.getByText(/Agotado temporalmente/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeDisabled();
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 3,
      reason: "Restauración Sprint 4 E2E",
    });
    await page.getByRole("button", { name: "Revalidar carrito ahora" }).click();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeEnabled();
    await page.getByRole("radio", { name: /Zona especial/i }).check();
    await expect(
      page.getByText("Tarifa pendiente de confirmación"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar total" }),
    ).toBeDisabled();
    await page.getByRole("radio", { name: /Recogida en tienda/i }).check();
    await page.getByRole("button", { name: "Revisar total" }).click();
    await expect(
      page.getByRole("region", { name: "Revisión de compra" }),
    ).toContainText("60.000,00");
    await page.screenshot({
      path: `../docs/evidence/sprint-4/checkout-${info.project.name}.png`,
      fullPage: true,
    });
    const orderResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/orders/") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirmar pedido" }).click();
    const response = await orderResponse;
    expect(response.status()).toBe(201);
    const order = await response.json();
    expect(order.total).toBe("60000.00");
    expect(order.shipping).toBe("0.00");
    await expect(page).toHaveURL(new RegExp(`/pedidos/${order.number}$`));
    expect((await page.request.get("/api/v1/admin/customers/")).status()).toBe(
      403,
    );
    await page.goto(`/catalogo/${product.slug}`);
    await page
      .getByRole("button", { name: "Añadir al carrito", exact: true })
      .click();
    expect(
      (
        await page.request.post("/api/v1/auth/logout/", {
          headers: { "X-CSRFToken": await csrf(page.request) },
        })
      ).status(),
    ).toBe(204);
    await page.goto("/comprar");
    await expect(
      page.getByRole("link", { name: "Iniciar sesión para continuar" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Disponibilidad y precios confirmados/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("tti.purchase.cart")!).items,
      ),
    ).toHaveLength(1);
    const adminBrowser = await browser.newContext({
      storageState: await admin.storageState(),
      viewport: page.viewportSize()!,
    });
    try {
      const customers = await adminBrowser.newPage();
      await customers.goto("http://localhost:3001/admin/clientes");
      await customers
        .getByRole("searchbox", { name: "Buscar cliente" })
        .fill(email);
      await customers
        .getByRole("button", { name: "Buscar", exact: true })
        .click();
      await expect(
        customers.getByRole("cell", { name: email, exact: true }),
      ).toBeVisible();
      await customers.screenshot({
        path: `../docs/evidence/sprint-4/customers-${info.project.name}.png`,
        fullPage: true,
      });
      expect(
        await customers.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await adminBrowser.close();
    }
    expect(failures).toEqual([]);
  } finally {
    await admin.dispose();
  }
});
