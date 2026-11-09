import { expect, test, type APIRequestContext } from "@playwright/test";
import { verifyRegisteredEmail } from "./helpers";

async function csrf(context: APIRequestContext) {
  return (await (await context.get("/api/v1/auth/csrf/")).json()).csrfToken;
}

test("Sprint 8: compra verificada, reseña pública, reporte y moderación", async ({
  page,
  browser,
  playwright,
}, info) => {
  test.setTimeout(120000);
  const stamp = `${info.project.name}-${Date.now()}`;
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
  });
  let adminBrowserContext:
    Awaited<ReturnType<typeof browser.newContext>> | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500)
      errors.push(`${response.status()} ${response.url()}`);
  });

  try {
    const adminLogin = await admin.post("/api/v1/auth/login/", {
      headers: { "X-CSRFToken": await csrf(admin) },
      data: {
        email: "admin@tti.example",
        password: "E2e-Only!TestPassword8472",
      },
    });
    expect(adminLogin.status()).toBe(200);

    async function create(path: string, data: object) {
      const response = await admin.post(`/api/v1/admin/${path}/`, {
        headers: { "X-CSRFToken": await csrf(admin) },
        data,
      });
      expect(response.status(), await response.text()).toBe(201);
      return response.json();
    }

    const category = await create("categories", {
      name: `Sprint 8 ${stamp}`,
      slug: `s8-${stamp}`,
      is_active: true,
    });
    const brand = await create("brands", {
      name: `Sprint 8 ${stamp}`,
      slug: `s8-${stamp}`,
      is_active: true,
    });
    const product = await create("products", {
      name: `Producto Sprint 8 ${stamp}`,
      slug: `s8-${stamp}`,
      description:
        "Producto sintético para regresión de confianza y reputación.",
      warranty: "Garantía de prueba de 12 meses",
      category: category.id,
      brand: brand.id,
      is_active: true,
    });
    const variant = await create(`products/${product.id}/variants`, {
      sku: `S8-${stamp}`,
      name: "Estándar",
      price: "50000.00",
      is_active: true,
    });
    await create("inventory/entries", {
      variant: variant.id,
      quantity: 2,
      reason: "Regresión Sprint 8 aislada",
    });

    const email = `sprint8-${stamp}@example.com`;
    const password = "Sprint8-Only!Pass8472";
    const register = await page.request.post("/api/v1/auth/register/", {
      headers: { "X-CSRFToken": await csrf(page.request) },
      data: { name: `Cliente ${stamp}`, email, password },
    });
    expect(register.status(), await register.text()).toBe(201);
    await verifyRegisteredEmail(page.request, email);
    const login = await page.request.post("/api/v1/auth/login/", {
      headers: { "X-CSRFToken": await csrf(page.request) },
      data: { email, password },
    });
    expect(login.status(), await login.text()).toBe(200);

    await page.goto(`/catalogo/${product.slug}`);
    await expect(
      page.getByRole("heading", { name: "Opiniones de compradores" }),
    ).toBeVisible();
    await expect(
      page.getByText("Este producto aún no tiene reseñas"),
    ).toBeVisible();
    const commercial = page.getByRole("region", {
      name: "Información de compra",
    });
    await expect(commercial).toContainText("Pago reportado");
    await expect(commercial).toContainText("Pago confirmado");
    await expect(commercial).toContainText("garantía aplicable");
    await page.goto("/comprar");
    const checkoutCommercial = page.getByRole("region", {
      name: "Información de compra",
    });
    await expect(checkoutCommercial).toContainText("Pago reportado");
    await expect(checkoutCommercial).toContainText("Pago confirmado");

    const headers = { "X-CSRFToken": await csrf(page.request) };
    const cart = {
      items: [{ variant_id: variant.id, quantity: 1 }],
      delivery_mode: "PICKUP",
      address_id: null,
    };
    const preview = await page.request.post("/api/v1/checkout/preview/", {
      headers,
      data: cart,
    });
    expect(preview.status(), await preview.text()).toBe(200);
    const orderResponse = await page.request.post("/api/v1/orders/", {
      headers: { ...headers, "Idempotency-Key": `s8-${stamp}` },
      data: { ...cart, quote_token: (await preview.json()).quote_token },
    });
    expect(orderResponse.status(), await orderResponse.text()).toBe(201);
    const order = await orderResponse.json();
    const reportPayment = await page.request.post(
      `/api/v1/orders/${order.number}/payment-report/`,
      { headers, data: { reference: `S8-${stamp}` } },
    );
    expect(reportPayment.status(), await reportPayment.text()).toBe(200);

    const paymentList = await admin.get(
      `/api/v1/admin/payments/?q=${encodeURIComponent(email)}`,
    );
    expect(paymentList.status(), await paymentList.text()).toBe(200);
    const reportedPayment = (await paymentList.json()).results.find(
      (payment: { order_number: string }) =>
        payment.order_number === order.number,
    );
    expect(reportedPayment).toBeTruthy();
    const paymentId = reportedPayment.id as number;
    const confirm = await admin.post(
      `/api/v1/admin/payments/${paymentId}/confirm/`,
      {
        headers: { "X-CSRFToken": await csrf(admin) },
      },
    );
    expect(confirm.status(), await confirm.text()).toBe(200);
    for (const target_status of ["PREPARING", "SHIPPED", "DELIVERED"]) {
      const transition = await admin.post(
        `/api/v1/admin/orders/${order.number}/transition/`,
        {
          headers: { "X-CSRFToken": await csrf(admin) },
          data: { target_status },
        },
      );
      expect(transition.status(), await transition.text()).toBe(200);
    }

    await page.goto(`/pedidos/${order.number}`);
    const reviewForm = page.locator(".review-form");
    await expect(reviewForm).toBeVisible();
    await reviewForm.getByLabel("Calificación").selectOption("4");
    await reviewForm
      .getByLabel("Tu opinión")
      .fill(`Compra verificada ${stamp}`);
    await reviewForm.getByRole("button", { name: "Publicar reseña" }).click();
    await expect(
      reviewForm.getByRole("button", { name: "Guardar cambios" }),
    ).toBeVisible();

    await reviewForm.getByLabel("Calificación").focus();
    await expect(reviewForm.getByLabel("Calificación")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(reviewForm.getByLabel("Tu opinión")).toBeFocused();
    await reviewForm.getByLabel("Tu opinión").fill(`Compra verificada ${stamp} editada`);
    const editResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/reviews/") &&
        response.request().method() === "PATCH",
    );
    await page.keyboard.press("Tab");
    await expect(reviewForm.getByRole("button", { name: "Guardar cambios" })).toBeFocused();
    await page.keyboard.press("Enter");
    expect((await editResponse).status()).toBe(200);

    await page.goto(`/catalogo/${product.slug}`);
    const publicReviews = page.getByRole("region", {
      name: "Opiniones de compradores",
    });
    await expect(publicReviews).toContainText("4,0");
    await expect(publicReviews).toContainText("Compra verificada");
    await expect(publicReviews).toContainText(`Compra verificada ${stamp}`);
    await expect(publicReviews).toContainText("Editada");
    await publicReviews
      .getByRole("button", { name: "Reportar opinión" })
      .click();
    await publicReviews
      .getByLabel("Motivo")
      .fill("Solicito revisión del contenido");
    await publicReviews.getByRole("button", { name: "Enviar reporte" }).click();
    await expect(publicReviews.getByRole("status")).toContainText(
      "La opinión sigue visible mientras la revisamos",
    );

    adminBrowserContext = await browser.newContext({
      storageState: await admin.storageState(),
      viewport: page.viewportSize()!,
    });
    const adminPage = await adminBrowserContext.newPage();
    adminPage.on("pageerror", (error) => errors.push(error.message));
    await adminPage.goto("/admin/resenas");
    const moderationCard = adminPage
      .locator(".review-moderation-card")
      .filter({ hasText: `Compra verificada ${stamp}` });
    await expect(moderationCard).toBeVisible();
    await expect(moderationCard).toContainText("1 reportes abiertos");
    await moderationCard
      .getByLabel("Motivo (obligatorio)")
      .fill("Ocultación temporal para comprobar agregados");
    await moderationCard.getByRole("button", { name: "Ocultar" }).click();
    await expect(moderationCard).toContainText("HIDDEN");

    const publicAfterHide = await page.request.get(
      `/api/v1/products/${product.slug}/reviews/`,
    );
    expect(publicAfterHide.status()).toBe(200);
    expect((await publicAfterHide.json()).summary.review_count).toBe(0);

    await moderationCard
      .getByLabel("Motivo (obligatorio)")
      .fill("Restauración tras terminar la comprobación");
    await moderationCard.getByRole("button", { name: "Restaurar" }).click();
    await expect(moderationCard).toContainText("VISIBLE");
    const publicAfterRestore = await page.request.get(
      `/api/v1/products/${product.slug}/reviews/`,
    );
    expect((await publicAfterRestore.json()).summary.review_count).toBe(1);

    await page.goto(`/catalogo/${product.slug}`);
    await expect(page.getByText(`Compra verificada ${stamp}`)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/evidence/sprint-8/reviews-${info.project.name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await adminBrowserContext?.close();
    await admin.dispose();
  }
});
