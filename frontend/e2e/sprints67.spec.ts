import { test, expect, type APIRequestContext } from "@playwright/test";

async function csrf(api: APIRequestContext) {
  return (await (await api.get("/api/v1/auth/csrf/")).json()).csrfToken;
}

test("Sprints 6/7: rejection correction, funds review, delivery, cancellation and comparison", async ({ page, browser, playwright }, info) => {
  test.setTimeout(150000);
  const stamp = `${info.project.name}-${Date.now()}`;
  const admin = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    expect((await admin.post("/api/v1/auth/login/", { headers: { "X-CSRFToken": await csrf(admin) }, data: { email: "admin@tti.example", password: "E2e-Only!TestPassword8472" } })).status()).toBe(200);
    async function create(path: string, data: object) {
      const response = await admin.post(`/api/v1/admin/${path}/`, { headers: { "X-CSRFToken": await csrf(admin) }, data });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    }
    const category = await create("categories", { name: `Complete ${stamp}`, slug: `complete-${stamp}`, is_active: true });
    const brand = await create("brands", { name: `Complete ${stamp}`, slug: `complete-${stamp}`, is_active: true });
    const products = [];
    let variantId = 0;
    for (let n = 0; n < 2; n++) {
      const product = await create("products", { name: `Complete ${stamp} ${n}`, slug: `complete-${stamp}-${n}`, description: "Isolated acceptance product", category: category.id, brand: brand.id, is_active: true });
      const variant = await create(`products/${product.id}/variants`, { sku: `COMPLETE-${stamp}-${n}`, name: "Standard", price: "45000.00", is_active: true });
      await create("inventory/entries", { variant: variant.id, quantity: 10, reason: "Isolated completion acceptance" });
      products.push(product);
      variantId = variant.id;
    }
    await page.goto(`/comparar?ids=${products.map(p => p.id).join(",")}`);
    await expect(page.getByRole("heading", { name: /Compara/i })).toBeVisible();
    for (const product of products) await expect(page.getByText(product.name, { exact: true }).first()).toBeVisible();
    const email = `complete-${stamp}@example.com`;
    const password = "Completion-Only!Pass8472";
    expect((await page.request.post("/api/v1/auth/register/", { headers: { "X-CSRFToken": await csrf(page.request) }, data: { name: `Complete ${stamp}`, email, password } })).status()).toBe(201);
    expect((await page.request.post("/api/v1/auth/login/", { headers: { "X-CSRFToken": await csrf(page.request) }, data: { email, password } })).status()).toBe(200);
    async function order(suffix: string) {
      const headers = { "X-CSRFToken": await csrf(page.request) };
      const payload = { items: [{ variant_id: variantId, quantity: 1 }], delivery_mode: "PICKUP", address_id: null };
      const preview = await page.request.post("/api/v1/checkout/preview/", { headers, data: payload });
      expect(preview.status()).toBe(200);
      const created = await page.request.post("/api/v1/orders/", { headers: { ...headers, "Idempotency-Key": `complete-${stamp}-${suffix}` }, data: { ...payload, quote_token: (await preview.json()).quote_token } });
      expect(created.status()).toBe(201);
      return created.json();
    }
    const purchase = await order("delivery");
    await page.goto(`/pedidos/${purchase.number}/pago`);
    await page.getByLabel("Referencia del pago").fill(`REF-${stamp}`);
    await page.getByRole("button", { name: "Reportar pago", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pago reportado" })).toBeVisible();
    adminContext = await browser.newContext({ storageState: await admin.storageState(), viewport: page.viewportSize()! });
    const adminPage = await adminContext.newPage();
    adminPage.on("pageerror", error => errors.push(error.message));
    adminPage.on("dialog", dialog => dialog.accept());
    await adminPage.goto("/admin/pagos");
    await adminPage.getByLabel("Buscar pago").fill(email);
    await adminPage.getByRole("button", { name: "Rechazar", exact: true }).click();
    await adminPage.getByLabel(/Motivo obligatorio/).fill("Referencia no acreditada de prueba");
    await adminPage.getByRole("button", { name: "Confirmar Rechazo", exact: true }).click();
    await expect(adminPage.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Referencia no acreditada de prueba")).toBeVisible();
    await page.getByLabel("Referencia del pago").fill(`CORRECTED-${stamp}`);
    await page.getByRole("button", { name: "Reportar pago", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pago reportado" })).toBeVisible();
    await adminPage.getByRole("button", { name: "Filtrar", exact: true }).click();
    await adminPage.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(adminPage.getByText(/Pago confirmado exitosamente/)).toBeVisible();
    await adminPage.goto(`/admin/pedidos/${purchase.number}`);
    await expect(adminPage.getByRole("dialog")).toBeVisible();
    await adminPage.getByRole("button", { name: "Cerrar", exact: true }).click();
    await adminPage.getByLabel("Buscar pedido").fill(purchase.number);
    for (const action of ["Preparar", "Despachar", "Entregar"]) await adminPage.getByRole("button", { name: action, exact: true }).click();
    await page.goto(`/pedidos/${purchase.number}`);
    await expect(page.getByRole("link", { name: /Contactar por WhatsApp sobre el pedido/ })).toHaveAttribute("href", new RegExp(purchase.number));
    expect((await (await page.request.get(`/api/v1/orders/${purchase.number}/`)).json()).status).toBe("DELIVERED");
    const cancelled = await order("cancel");
    await page.goto(`/pedidos/${cancelled.number}`);
    await page.getByRole("button", { name: /Cancelar Pedido/i }).click();
    await page.getByRole("button", { name: /Confirmar Cancelaci/i }).click();
    await expect(page.getByText(/Pedido cancelado exitosamente/)).toBeVisible();
    expect((await (await page.request.get(`/api/v1/orders/${cancelled.number}/`)).json()).status).toBe("CANCELLED");
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/completion-${info.project.name}.png`, fullPage: true });
  } finally {
    await adminContext?.close();
    await admin.dispose();
  }
});
