import { test, expect, type Page } from "@playwright/test";

async function login(
  page: Page,
  email = "admin@tti.example",
  password = "E2e-Only!TestPassword8472",
) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
}

test("HU-03 perfil y direcciones persisten, cambian principal y confirman eliminación", async ({
  page,
}, testInfo) => {
  const email = `perfil-${testInfo.project.name}-${Date.now()}@example.com`;
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(response.url());
  });
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Ana Perfil");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill("Perfil-Only!TestPassword8472");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu cuenta está lista" }),
  ).toBeVisible();
  await login(page, email, "Perfil-Only!TestPassword8472");
  await expect(
    page.getByText("No tienes direcciones guardadas."),
  ).toBeVisible();
  await page.getByLabel("Nombre completo").fill("Ana Actualizada");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText("Perfil actualizado.")).toBeVisible();
  for (const label of ["Casa", "Oficina"]) {
    await page.getByLabel("Etiqueta", { exact: true }).fill(label);
    await page.getByLabel("Recibe", { exact: true }).fill("Ana Actualizada");
    await page.getByLabel("Teléfono", { exact: true }).fill("3001234567");
    await page
      .getByLabel("Dirección", { exact: true })
      .fill("Calle 18 # 20-30");
    if (label === "Oficina")
      await page.getByLabel("Usar como dirección principal").check();
    await page.getByRole("button", { name: "Agregar dirección" }).click();
    await expect(
      page.getByRole("button", { name: `Editar ${label}`, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByText("Oficina - principal", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Casa - principal", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Editar Casa", exact: true }).click();
  await page.getByLabel("Dirección", { exact: true }).fill("Carrera 9 # 10-25");
  await page.getByRole("button", { name: "Guardar dirección" }).click();
  await expect(page.getByText("Dirección actualizada.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Ana Actualizada" }),
  ).toBeVisible();
  await expect(
    page.getByText("Carrera 9 # 10-25, Pasto, Nariño", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Oficina - principal", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await testInfo.attach(`${testInfo.project.name}-perfil`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Eliminar Casa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Editar Casa", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Eliminar Casa", exact: true })
    .click();
  await expect(page.getByText("Dirección eliminada.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Editar Casa", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Editar Oficina", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("HU-20 categorías y marcas: alta, duplicado, edición, actividad y borrado", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "Administrar catálogo" }).click();
  for (const [tab, resource] of [
    ["Categorías", "categories"],
    ["Marcas", "brands"],
  ]) {
    const name = `Sprint1 ${resource} ${testInfo.project.name} ${Date.now()}`;
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    const slug = await page
      .getByLabel("Identificador", { exact: true })
      .inputValue();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByLabel("Buscar por nombre").fill(name);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Editar ${name}`, exact: true }),
    ).toBeVisible();
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(name);
    await page
      .getByRole("button", { name: `Editar ${name}`, exact: true })
      .click();
    await page.getByLabel("Nombre", { exact: true }).fill(`${name} editado`);
    await page.getByLabel("Activo", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const edit = page.getByRole("button", {
      name: `Editar ${name} editado`,
      exact: true,
    });
    await expect(edit).toBeVisible();
    const publicResponse = await page.request.get(
      `/api/v1/${resource}/?search=${encodeURIComponent(name)}`,
    );
    expect(publicResponse.status()).toBe(200);
    expect(JSON.stringify(await publicResponse.json())).not.toContain(slug);
    await testInfo.attach(`${testInfo.project.name}-${resource}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: `Eliminar ${name} editado`, exact: true })
      .click();
    await expect(edit).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("EN-01 y HU-30 configuración persistente y canal habilitable", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "Configuración", exact: true }).click();
  const hours = page.getByLabel("Plazo para reportar pago (horas)");
  await expect(hours).toHaveValue("12");
  try {
    await hours.fill("18");
    await page.getByLabel("Canal habilitado").uncheck();
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();
    await page.reload();
    await expect(hours).toHaveValue("18");
    await expect(
      page.getByRole("link", { name: /Contactar a TTI por WhatsApp/ }),
    ).toHaveCount(0);
    await page.getByLabel("Canal habilitado").check();
    await page.getByLabel("Número con código de país").fill("invalid");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(
      page.getByText("Usa código de país y número, solo dígitos."),
    ).toBeVisible();
    await testInfo.attach(`${testInfo.project.name}-configuracion`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  } finally {
    const csrf = (await (await page.request.get("/api/v1/auth/csrf/")).json())
      .csrfToken;
    const restored = await page.request.patch("/api/v1/admin/settings/", {
      headers: { "X-CSRFToken": csrf },
      data: {
        unpaid_order_timeout_hours: 12,
        whatsapp_enabled: true,
        whatsapp_number: "12025550123",
        whatsapp_message: "Hola & gracias ¿TTI?",
      },
    });
    expect(restored.status()).toBe(200);
  }
});
