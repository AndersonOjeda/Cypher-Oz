import { test, expect, Page } from "@playwright/test";

const password = "Una-clave!Distinta8472";
async function login(page: Page, email: string, pass = password) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(pass);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test("registro, duplicado, credenciales, sesión persistente, permisos y logout", async ({
  page,
  context,
}, testInfo) => {
  const email = `cliente-${testInfo.project.name}-${Date.now()}@example.com`;
  const errors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !msg.text().includes("Failed to load resource")
    )
      errors.push(msg.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500)
      serverErrors.push(`${response.status()} ${response.url()}`);
  });
  const health = await page.request.get("/health/");
  expect(await health.json()).toEqual({ status: "ok", database: "postgresql" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "La tecnología",
  );
  await page.getByRole("link", { name: "Crear mi cuenta" }).click();
  await page.getByLabel("Nombre completo").fill("Ana Prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  const registration = page.waitForResponse(
    (r) =>
      r.url().includes("/auth/register/") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  expect((await registration).status()).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Tu cuenta está lista" }),
  ).toBeVisible();
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Otra Prueba");
  await page.getByLabel("Correo electrónico").fill(email.toUpperCase());
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Ya existe una cuenta",
  );
  await login(page, email, "Contraseña-incorrecta!");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Correo o contraseña incorrectos",
  );
  await login(page, email);
  await expect(
    page.getByRole("heading", { name: "Hola, Ana Prueba" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Ana Prueba" }),
  ).toBeVisible();
  const cookies = await context.cookies();
  for (const name of ["tti_access", "tti_refresh"]) {
    expect(cookies.find((cookie) => cookie.name === name)?.httpOnly).toBe(true);
  }
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect((await page.request.get("/api/v1/admin/settings/")).status()).toBe(
    403,
  );
  const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
    .csrfToken;
  expect(
    (
      await page.request.post("/api/v1/auth/refresh/", {
        headers: { "X-CSRFToken": csrf },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Ana Prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/v1/users/me/")).status()).toBe(401);
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
  expect(serverErrors).toEqual([]);
});

test("WhatsApp configurado, responsive, accesible y sin cubrir CTA", async ({
  page,
}, testInfo) => {
  for (const route of ["/", "/registro", "/login"]) {
    await page.goto(route);
    const link = page.getByRole("link", {
      name: /Contactar a TTI por WhatsApp/,
    });
    await expect(link).toBeVisible();
    const url = new URL((await link.getAttribute("href"))!);
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/12025550123");
    expect(url.searchParams.get("text")).toBe("Hola & gracias ¿TTI?");
    expect(await link.getAttribute("rel")).toContain("noopener");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const cta =
      route === "/"
        ? page.getByRole("link", { name: "Crear mi cuenta" })
        : page.getByRole("button", {
            name: route === "/registro" ? "Crear cuenta" : "Iniciar sesión",
          });
    await cta.scrollIntoViewIfNeeded();
    const a = (await cta.boundingBox())!;
    const b = (await link.boundingBox())!;
    expect(
      a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y,
    ).toBe(true);
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(
      `${testInfo.project.name}-${route.replaceAll("/", "") || "home"}`,
      { body: screenshot, contentType: "image/png" },
    );
  }
});

test("administrador autorizado y visitante rechazado", async ({ page }) => {
  expect((await page.request.get("/api/v1/admin/settings/")).status()).toBe(
    401,
  );
  await login(page, "admin@tti.example", "E2e-Only!TestPassword8472");
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
  expect((await page.request.get("/api/v1/admin/settings/")).status()).toBe(
    200,
  );
});
