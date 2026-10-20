import { expect, test, type APIRequestContext } from "@playwright/test";

async function csrf(context: APIRequestContext) {
  return (await (await context.get("/api/v1/auth/csrf/")).json()).csrfToken;
}

test("Sprint 5: instructions, persistent deadline, report and unique SALE", async ({
  page,
  playwright,
  context,
}, info) => {
  test.setTimeout(90000);
  const stamp = `${info.project.name}-${Date.now()}`;
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let original:
    | { payment_instructions: string; unpaid_order_timeout_hours: number }
    | undefined;
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
    const adminHeaders = { "X-CSRFToken": await csrf(admin) };
    const settings = await (await admin.get("/api/v1/admin/settings/")).json();
    original = {
      payment_instructions: settings.payment_instructions,
      unpaid_order_timeout_hours: settings.unpaid_order_timeout_hours,
    };
    async function create(path: string, data: object) {
      const response = await admin.post(`/api/v1/admin/${path}/`, {
        headers: adminHeaders,
        data,
      });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    }
    const category = await create("categories", {
      name: `S5 ${stamp}`,
      slug: `s5-${stamp}`,
      is_active: true,
    });
    const brand = await create("brands", {
      name: `S5 ${stamp}`,
      slug: `s5-${stamp}`,
      is_active: true,
    });
    const product = await create("products", {
      name: `S5 ${stamp}`,
      description: "Synthetic Sprint 5 audit product",
      slug: `s5-${stamp}`,
      category: category.id,
      brand: brand.id,
      is_active: true,
    });
    const variant = await create(`products/${product.id}/variants`, {
      sku: `S5-${stamp}`,
      name: "Test",
      price: "75000.00",
      is_active: true,
    });
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 10,
      reason: "Synthetic Sprint 5 test",
    });
    const email = `s5-${stamp}@example.com`;
    const password = "Sprint5-Only!Pass8472";
    expect(
      (
        await page.request.post("/api/v1/auth/register/", {
          headers: { "X-CSRFToken": await csrf(page.request) },
          data: { name: "Sprint 5 Test", email, password },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await page.request.post("/api/v1/auth/login/", {
          headers: { "X-CSRFToken": await csrf(page.request) },
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    const headers = { "X-CSRFToken": await csrf(page.request) };
    const payload = {
      items: [{ variant_id: variant.id, quantity: 2 }],
      delivery_mode: "PICKUP",
      address_id: null,
    };
    const preview = await page.request.post("/api/v1/checkout/preview/", {
      headers,
      data: payload,
    });
    expect(preview.status()).toBe(200);
    const data = {
      ...payload,
      quote_token: (await preview.json()).quote_token,
    };
    const orderHeaders = { ...headers, "Idempotency-Key": `s5-${stamp}` };
    const created = await page.request.post("/api/v1/orders/", {
      headers: orderHeaders,
      data,
    });
    expect(created.status()).toBe(201);
    const order = await created.json();
    expect(
      (
        await page.request.post("/api/v1/orders/", {
          headers: orderHeaders,
          data,
        })
      ).status(),
    ).toBe(200);
    const path = `/api/v1/orders/${order.number}/payment-instructions/`;
    const before = await (await page.request.get(path)).json();
    const instructions = "Synthetic audit instructions. Do not transfer money.";
    expect(
      (
        await admin.patch("/api/v1/admin/settings/", {
          headers: adminHeaders,
          data: {
            payment_instructions: instructions,
            unpaid_order_timeout_hours: original.unpaid_order_timeout_hours + 1,
          },
        })
      ).status(),
    ).toBe(200);
    const after = await (await page.request.get(path)).json();
    expect(after.instructions).toBe(instructions);
    expect(after.report_deadline_at).toBe(before.report_deadline_at);
    expect(after.total).toBe("150000.00");
    expect(after.payment_status).toBe("PENDING");
    expect((await admin.get(path)).status()).toBe(404);
    const anonymous = await playwright.request.newContext({
      baseURL: "http://localhost:3001",
    });
    try {
      expect((await anonymous.get(path)).status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/pedidos/${order.number}/pago`);
    await expect(page.getByText(instructions, { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Copiar instrucciones", exact: true })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      instructions,
    );
    await page.getByLabel("Referencia del pago").fill(`REF-${stamp}`);
    await page
      .getByRole("button", { name: "Reportar pago", exact: true })
      .click();
    await expect(
      page.getByText("Pendiente de revisión. Fondos aún no confirmados."),
    ).toBeVisible();
    const reported = await (await page.request.get(path)).json();
    expect(reported.payment.status).toBe("REPORTED");
    expect(reported.payment.report_window_active).toBe(false);
    expect(Date.parse(reported.payment.review_deadline_at)).toBeGreaterThan(
      Date.parse(reported.payment.reported_at),
    );
    await page.reload();
    await expect(
      page.getByText(`Referencia: REF-${stamp}`, { exact: true }),
    ).toBeVisible();
    const replay = await page.request.post(
      `/api/v1/orders/${order.number}/payment-report/`,
      { headers, data: { reference: `REF-${stamp}` } },
    );
    expect(replay.status()).toBe(200);
    expect((await replay.json()).review_deadline_at).toBe(
      reported.payment.review_deadline_at,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/evidence/sprint-5/payment-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto(`/pedidos/${order.number}`);
    await expect(page.getByText(order.number, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /cancelar/i })).toBeVisible();
    const cancelled = await page.request.post(`/api/v1/orders/${order.number}/cancel/`, { headers, data: {} });
    expect(cancelled.status()).toBe(200);
    expect((await cancelled.json()).status).toBe("CANCELLED");
    expect((await page.request.post(`/api/v1/orders/${order.number}/cancel/`, { headers, data: {} })).status()).toBe(409);
    const movements = await (
      await admin.get(
        `/api/v1/admin/inventory/movements/?variant=${variant.id}`,
      )
    ).json();
    expect(
      movements.results.filter(
        (movement: { type: string }) => movement.type === "SALE",
      ),
    ).toHaveLength(1);
    expect(
      movements.results.reduce(
        (sum: number, movement: { quantity: number }) =>
          sum + movement.quantity,
        0,
      ),
    ).toBe(10);
    expect(movements.results.filter((movement: { type: string }) => movement.type === "CANCELLATION")).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    if (original)
      expect(
        (
          await admin.patch("/api/v1/admin/settings/", {
            headers: { "X-CSRFToken": await csrf(admin) },
            data: original,
          })
        ).status(),
      ).toBe(200);
    await admin.dispose();
  }
});
