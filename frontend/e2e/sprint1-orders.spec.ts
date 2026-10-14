import { test, expect, type APIRequestContext } from "@playwright/test";

const password = "Purchase-Only!Pass8472";

async function csrf(context: APIRequestContext) {
  return (await (await context.get("/api/v1/auth/csrf/")).json()).csrfToken;
}

test("checkout relee dirección y pedido conserva snapshot; reintento no duplica", async ({
  page,
  playwright,
  browser,
}, info) => {
  test.setTimeout(90000);
  const stamp = `${info.project.name}-${Date.now()}`;
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
  });
  try {
    const login = await admin.post("/api/v1/auth/login/", {
      headers: { "X-CSRFToken": await csrf(admin) },
      data: {
        email: "admin@tti.example",
        password: "E2e-Only!TestPassword8472",
      },
    });
    expect(login.status()).toBe(200);
    const headers = { "X-CSRFToken": await csrf(admin) };
    const create = async (path: string, data: object) => {
      const response = await admin.post(`/api/v1/admin/${path}/`, {
        headers,
        data,
      });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    };
    const category = await create("categories", {
      name: `Pedido ${stamp}`,
      slug: `pedido-${stamp}`,
      is_active: true,
    });
    const brand = await create("brands", {
      name: `Marca ${stamp}`,
      slug: `marca-${stamp}`,
      is_active: true,
    });
    const product = await create("products", {
      name: `Teclado ${stamp}`,
      slug: `teclado-${stamp}`,
      description: "Producto de prueba de integración",
      category: category.id,
      brand: brand.id,
      is_active: true,
    });
    const variant = await create(`products/${product.id}/variants`, {
      sku: `ORDER-${stamp}`,
      name: "Estándar",
      price: "40000.00",
      is_active: true,
    });
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 3,
      reason: "Preparación E2E checkout",
    });
    const email = `checkout-${stamp}@example.com`;
    const register = await page.request.post("/api/v1/auth/register/", {
      headers: { "X-CSRFToken": await csrf(page.request) },
      data: { name: "Cliente Checkout", email, password },
    });
    expect(register.status()).toBe(201);
    await page.goto("/comprar");
    await page.getByLabel("Buscar productos").fill(product.name);
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await page
      .getByRole("link", { name: "Iniciar sesión para continuar" })
      .click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(page).toHaveURL(/\/comprar$/);
    await expect(
      page.getByRole("heading", { name: "Tu compra" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Gestionar direcciones" }).click();
    await page.getByLabel("Etiqueta", { exact: true }).fill("Casa pedido");
    await page.getByLabel("Recibe", { exact: true }).fill("Cliente Checkout");
    await page.getByLabel("Teléfono", { exact: true }).fill("3001234567");
    await page
      .getByLabel("Dirección", { exact: true })
      .fill("Calle snapshot 10");
    await page
      .getByRole("button", { name: "Agregar dirección", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Editar Casa pedido", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Editar Casa pedido", exact: true })
      .click();
    await page
      .getByLabel("Dirección", { exact: true })
      .fill("Calle snapshot 25");
    await page
      .getByRole("button", { name: "Guardar dirección", exact: true })
      .click();
    await expect(page.getByText("Dirección actualizada.")).toBeVisible();
    await page.goto("/comprar");
    await expect(
      page.getByRole("combobox", { name: "Dirección", exact: true }),
    ).toContainText("Calle snapshot 25");
    await page.getByLabel("Buscar productos").fill(product.name);
    await page
      .getByRole("button", { name: "Revisar total", exact: true })
      .click();
    const review = page.getByRole("region", { name: "Revisión de compra" });
    await expect(review).toContainText("Calle snapshot 25");
    await expect(review).toContainText("45.000,00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/evidence/sprint-1-current/checkout-${info.project.name}.png`,
      fullPage: true,
    });
    await page.route(
      "**/api/v1/orders/",
      async (route) => {
        const committed = await route.fetch();
        expect(committed.status()).toBe(201);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Confirmar pedido", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Recuperar confirmación" }),
    ).toBeEnabled();
    await page.reload();
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/orders/") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Recuperar confirmación", exact: true })
      .click();
    const response = await created;
    expect(response.status()).toBe(200);
    const order = await response.json();
    await expect(page).toHaveURL(new RegExp(`/pedidos/${order.number}$`));
    await expect(
      page.getByText("Pedido: Pendiente", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Pago: Pendiente", { exact: true }),
    ).toBeVisible();
    const replay = await page.request.post("/api/v1/orders/", {
      headers: {
        "X-CSRFToken": await csrf(page.request),
        "Idempotency-Key": response.request().headers()["idempotency-key"],
      },
      data: response.request().postDataJSON(),
    });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).number).toBe(order.number);
    await page.goto("/cuenta");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Eliminar Casa pedido", exact: true })
      .click();
    await expect(page.getByText("Dirección eliminada.")).toBeVisible();
    const edited = await admin.patch(`/api/v1/admin/variants/${variant.id}/`, {
      headers,
      data: { price: "60000.00", sku: `CHANGED-${stamp}` },
    });
    expect(edited.status()).toBe(200);
    await page.goto(`/pedidos/${order.number}`);
    await expect(
      page.getByText("Calle snapshot 25", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/SKU ORDER-/)).toBeVisible();
    await expect(page.getByText(/45.000,00/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/evidence/sprint-1-current/order-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Instrucciones de pago" }).click();
    await expect(
      page.getByRole("heading", { name: "Instrucciones de pago" }),
    ).toBeVisible();
    const stock = await admin.get(
      `/api/v1/admin/inventory/?search=${encodeURIComponent(`CHANGED-${stamp}`)}`,
    );
    await page.getByLabel("Referencia del pago").fill(`TRANSFER-${stamp}`);
    await page
      .getByRole("button", { name: "Reportar pago", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pago reportado", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Pendiente de revisión. Fondos aún no confirmados."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(`Referencia: TRANSFER-${stamp}`, { exact: true }),
    ).toBeVisible();
    const repeatedReport = await page.request.post(
      `/api/v1/orders/${order.number}/payment-report/`,
      {
        headers: { "X-CSRFToken": await csrf(page.request) },
        data: { reference: `TRANSFER-${stamp}` },
      },
    );
    expect(repeatedReport.status()).toBe(200);
    expect((await repeatedReport.json()).status).toBe("REPORTED");
    await page.screenshot({
      path: `../docs/evidence/sprint-1-current/payment-${info.project.name}.png`,
      fullPage: true,
    });
    expect(stock.status()).toBe(200);
    const movements = await admin.get(
      `/api/v1/admin/inventory/movements/?variant=${variant.id}`,
    );
    expect(
      (await movements.json()).results.filter(
        (movement: { type: string }) => movement.type === "SALE",
      ),
    ).toHaveLength(1);
    const adminBrowser = await browser.newContext({
      storageState: await admin.storageState(),
      viewport: page.viewportSize()!,
    });
    try {
      const stockPage = await adminBrowser.newPage();
      await stockPage.goto("http://localhost:3001/admin/inventario");
      await stockPage
        .getByLabel("Buscar SKU o producto")
        .fill(`CHANGED-${stamp}`);
      await stockPage
        .getByRole("button", { name: /Registrar entrada:/ })
        .click();
      await stockPage.getByLabel("Cantidad de entrada").fill("2");
      await stockPage
        .getByLabel("Motivo", { exact: true })
        .fill("Reposición de prueba");
      await stockPage.getByRole("button", { name: "Guardar entrada" }).click();
      await expect(stockPage.getByText(/4 unidades/)).toBeVisible();
      expect(
        await stockPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await stockPage.screenshot({
        path: `../docs/evidence/sprint-1-current/inventory-${info.project.name}.png`,
        fullPage: true,
      });
    } finally {
      await adminBrowser.close();
    }
    await page.goto("/admin/inventario");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Solo administradores",
    );
  } finally {
    await admin.dispose();
  }
});
