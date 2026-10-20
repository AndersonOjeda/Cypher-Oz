import { expect, test, type APIRequestContext } from "@playwright/test";

async function csrf(context: APIRequestContext) {
  return (await (await context.get("/api/v1/auth/csrf/")).json()).csrfToken;
}

test("Sprint 5: ciclo de pedido, instrucciones de pago, reporte de pago y cancelación con restitución de stock", async ({
  page,
  playwright,
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
    // 1. Admin login
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

    const adminHeaders = { "X-CSRFToken": await csrf(admin) };

    // Helper to create catalog items
    async function create(path: string, data: object) {
      const response = await admin.post(`/api/v1/admin/${path}/`, {
        headers: adminHeaders,
        data,
      });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    }

    const category = await create("categories", {
      name: `Sprint 5 Cat ${stamp}`,
      slug: `s5-cat-${stamp}`,
      is_active: true,
    });
    const brand = await create("brands", {
      name: `Sprint 5 Brand ${stamp}`,
      slug: `s5-brand-${stamp}`,
      is_active: true,
    });
    const product = await create("products", {
      name: `Producto Sprint 5 ${stamp}`,
      slug: `s5-${stamp}`,
      description: "Prueba E2E Sprint 5",
      category: category.id,
      brand: brand.id,
      is_active: true,
    });
    const variant = await create("variants", {
      product: product.id,
      sku: `S5-${stamp.toUpperCase().slice(0, 10)}`,
      name: "Edición Sprint 5",
      price: "75000.00",
      is_active: true,
    });

    // Add initial inventory: 10 units
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 10,
      reason: "Entrada inicial Sprint 5",
    });

    // 2. Client registration & login
    const clientEmail = `cliente-${stamp}@example.com`;
    const clientPass = "ClienteSeguro!1234";

    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill(`Cliente ${stamp}`);
    await page.getByLabel("Correo electrónico").fill(clientEmail);
    await page.getByLabel("Contraseña", { exact: true }).fill(clientPass);
    await page.getByLabel("Confirmar contraseña").fill(clientPass);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // In case registration redirects or asks for login
    if (page.url().includes("/login")) {
      await page.getByLabel("Correo electrónico").fill(clientEmail);
      await page.getByLabel("Contraseña").fill(clientPass);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
    }
    await page.waitForURL((url) => !url.pathname.includes("/login") && !url.pathname.includes("/registro"));

    // 3. Add to cart & checkout
    await page.goto(`/catalogo/${product.slug}`);
    await page.getByRole("button", { name: "Añadir al carrito", exact: true }).click();

    await page.goto("/comprar");
    await page.getByRole("radio", { name: /Recogida en tienda/i }).check();
    await page.getByRole("button", { name: "Revisar total" }).click();

    const orderPromise = page.waitForResponse(
      (r) => r.url().includes("/orders/") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirmar pedido" }).click();
    const orderRes = await orderPromise;
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();
    const orderNumber = orderData.number;

    // 4. Test HU-13: Payment Instructions & Copy
    await page.getByRole("link", { name: /Instrucciones de pago/i }).click();
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderNumber}/pago`));
    await expect(page.getByText(new RegExp(`Pedido ${orderNumber}`))).toBeVisible();
    await expect(page.getByText(/Plazo original para reportar:/i)).toBeVisible();

    // 5. Test HU-14: Report Payment
    await page.getByLabel("Referencia del pago").fill(`REF-${stamp}`);
    await page.getByRole("button", { name: /Reportar pago/i }).click();

    await expect(
      page.getByText("Pendiente de revisión. Fondos aún no confirmados."),
    ).toBeVisible();
    await expect(page.getByText(`Referencia: REF-${stamp}`)).toBeVisible();

    // 6. Test HU-25: Cancellation & Stock Restitution
    // Create second order to test cancellation
    await page.goto(`/catalogo/${product.slug}`);
    await page.getByRole("button", { name: "Añadir al carrito", exact: true }).click();
    await page.goto("/comprar");
    await page.getByRole("radio", { name: /Recogida en tienda/i }).check();
    await page.getByRole("button", { name: "Revisar total" }).click();

    const order2Promise = page.waitForResponse(
      (r) => r.url().includes("/orders/") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirmar pedido" }).click();
    const order2Res = await order2Promise;
    expect(order2Res.status()).toBe(201);

    // Current stock before cancellation should be 10 - 1 - 1 = 8
    const stockBeforeCancel = await admin.get(`/api/v1/admin/inventory/?search=${variant.sku}`, {
      headers: adminHeaders,
    });
    const stockJson1 = await stockBeforeCancel.json();
    expect(stockJson1.results[0].available_quantity).toBe(8);

    // Cancel order 2
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Cancelar pedido/i }).click();

    await expect(
      page.getByText(/Pedido cancelado exitosamente/i),
    ).toBeVisible();
    await expect(page.getByText(/Pedido: Cancelado/i)).toBeVisible();

    // Verify stock is restituted: 8 + 1 = 9
    const stockAfterCancel = await admin.get(`/api/v1/admin/inventory/?search=${variant.sku}`, {
      headers: adminHeaders,
    });
    const stockJson2 = await stockAfterCancel.json();
    expect(stockJson2.results[0].available_quantity).toBe(9);

    expect(failures).toEqual([]);
  } finally {
    await admin.dispose();
  }
});
