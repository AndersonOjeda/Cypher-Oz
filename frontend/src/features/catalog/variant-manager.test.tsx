import { beforeEach, expect, test, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api, ApiError } from "@/services/api";
import { VariantManager } from "./variant-manager";
import type { CategoryAttribute, Product, Variant } from "./types";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api).mockReset();
});

const product: Product = {
  id: 10,
  name: "Teclado",
  slug: "teclado",
  description: "Teclado mecánico",
  warranty: "",
  category: 2,
  brand: 3,
  category_name: "Accesorios",
  brand_name: "TTI",
  is_active: true,
  catalog_visible: true,
  catalog_available: false,
  images: [],
};
const color: CategoryAttribute = {
  id: 4,
  category: 2,
  name: "Color",
  code: "color",
};
const variant: Variant = {
  id: 20,
  product: 10,
  name: "Estándar",
  sku: "TEC-001",
  price: "125000.50",
  is_active: true,
  catalog_available: true,
  attributes: [],
  updated_at: "2026-09-08T12:00:00Z",
};
const empty = { count: 0, next: null, previous: null, results: [] };

function catalogMock(initial: Variant[] = [], attrs = [color]) {
  let variants = initial;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.includes("/categories/")) return attrs;
    if (options?.method === "POST" || options?.method === "PATCH") {
      const saved = { ...variant, ...JSON.parse(String(options.body)) };
      saved.attributes = saved.attributes.map(
        (item: { attribute: number; value: string }) => ({ ...color, ...item }),
      );
      variants = [saved];
      return saved;
    }
    if (path === "/admin/variants/20/") return variants[0];
    return { ...empty, count: variants.length, results: variants };
  });
}

test("creates a standard variant with a decimal string and only filled category attributes", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  catalogMock(
    [],
    [color, { id: 5, category: 2, name: "Capacidad", code: "capacidad" }],
  );
  render(<VariantManager product={product} onChange={changed} />);
  await screen.findByLabelText("Color (opcional)");
  await openOptions(user);
  expect(screen.getByLabelText("Nombre de la presentación")).toHaveValue(
    "Estándar",
  );
  await user.type(screen.getByLabelText("SKU", { exact: true }), "tec-001");
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "125000.50");
  await user.type(screen.getByLabelText("Color (opcional)"), "Negro");
  await user.click(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  );
  await screen.findByText(/Presentación guardada/);
  const request = vi
    .mocked(api)
    .mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(request[0]).toBe("/admin/products/10/variants/");
  expect(JSON.parse(String(request[1]?.body))).toEqual({
    name: "Estándar",
    sku: "TEC-001",
    initial_stock: 0,
    price: "125000.5",
    is_active: true,
    attributes: [{ attribute: 4, value: "Negro" }],
  });
  expect(changed).toHaveBeenCalledWith(10);
  expect(await screen.findByText(/125\.000,50/)).toBeVisible();
});

test("duplicate SKU error preserves editable values and allows correction", async () => {
  const user = userEvent.setup();
  catalogMock();
  render(<VariantManager product={product} onChange={vi.fn()} />);
  await screen.findByLabelText("Color (opcional)");
  await openOptions(user);
  await user.type(screen.getByLabelText("SKU", { exact: true }), "DUPLICADO");
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "899.99");
  await user.type(screen.getByLabelText("Color (opcional)"), "Rojo");
  vi.mocked(api).mockRejectedValueOnce(
    new ApiError(409, "conflict", "Revisa los datos", {
      sku: ["Ya existe una variante con este SKU."],
    }),
  );
  await user.click(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ya existe una variante con este SKU.",
  );
  expect(screen.getByLabelText("SKU", { exact: true })).toHaveValue(
    "DUPLICADO",
  );
  expect(screen.getByLabelText("Precio de venta (COP)")).toHaveValue(899.99);
  expect(screen.getByLabelText("Color (opcional)")).toHaveValue("Rojo");
  await user.clear(screen.getByLabelText("SKU", { exact: true }));
  await user.type(screen.getByLabelText("SKU", { exact: true }), "TEC-NUEVO");
  await user.click(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  );
  await screen.findByText(/Presentación guardada/);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("edits price including zero as a decimal string and changes active status separately", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  catalogMock([variant]);
  render(
    <VariantManager
      product={{ ...product, catalog_available: true }}
      onChange={changed}
    />,
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Cambiar nombre o precio de Estándar",
    }),
  );
  expect(screen.getByLabelText("Precio de venta (COP)")).toHaveValue(125000.5);
  await user.clear(screen.getByLabelText("Precio de venta (COP)"));
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "0.00");
  await user.click(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  );
  await screen.findByText(/Presentación guardada/);
  expect(vi.mocked(api)).toHaveBeenCalledWith(
    "/admin/variants/20/",
    expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"price":"0"'),
    }),
  );
  expect(await screen.findByText(/\$\s*0,00/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Ocultar presentación Estándar" }),
  );
  await screen.findByText("Variante desactivada.");
  expect(vi.mocked(api)).toHaveBeenCalledWith("/admin/variants/20/", {
    method: "PATCH",
    body: '{"is_active":false}',
  });
  expect(
    screen.getByLabelText("Mostrar esta presentación al cliente"),
  ).not.toBeChecked();
  expect(changed).toHaveBeenCalledTimes(2);
});

test("blocks save until category attributes load and retries their failure", async () => {
  const user = userEvent.setup();
  let rejectAttributes!: (reason: Error) => void;
  vi.mocked(api).mockImplementation((path) =>
    path.includes("/categories/")
      ? new Promise((_, reject) => {
          rejectAttributes = reject;
        })
      : Promise.resolve(empty),
  );
  render(<VariantManager product={product} onChange={vi.fn()} />);
  expect(
    await screen.findByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  ).toBeDisabled();
  await act(async () =>
    rejectAttributes(new Error("Sin conexión con atributos")),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Sin conexión con atributos",
  );
  expect(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  ).toBeDisabled();
  catalogMock();
  await user.click(
    screen.getByRole("button", { name: "Reintentar atributos" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", {
        name: /Guardar presentación|Guardar cambios/,
      }),
    ).toBeEnabled(),
  );
});

test("switching the selected product clears the previous SKU and category values", async () => {
  const user = userEvent.setup();
  catalogMock();
  const { rerender } = render(
    <VariantManager key="10-2" product={product} onChange={vi.fn()} />,
  );
  await screen.findByLabelText("Color (opcional)");
  await openOptions(user);
  await user.type(screen.getByLabelText("SKU", { exact: true }), "NO-COPIAR");
  await user.type(screen.getByLabelText("Color (opcional)"), "Rojo");
  catalogMock([], [{ id: 8, category: 7, name: "Memoria", code: "memoria" }]);
  rerender(
    <VariantManager
      key="11-7"
      product={{ ...product, id: 11, category: 7 }}
      onChange={vi.fn()}
    />,
  );
  expect(await screen.findByLabelText("Memoria (opcional)")).toHaveValue("");
  expect(screen.getByLabelText("SKU", { exact: true })).toHaveValue("");
  expect(screen.queryByLabelText("Color (opcional)")).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith(
    "/admin/categories/7/attributes/",
    expect.anything(),
  );
});

test("keeps the save action disabled while the mutation is pending", async () => {
  const user = userEvent.setup();
  catalogMock();
  render(<VariantManager product={product} onChange={vi.fn()} />);
  await screen.findByLabelText("Color (opcional)");
  await openOptions(user);
  await user.type(screen.getByLabelText("SKU", { exact: true }), "TEC-001");
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "50");
  let complete!: (saved: Variant) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await user.click(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  );
  expect(
    screen.getByRole("button", { name: "Guardando presentación…" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("SKU", { exact: true })).toBeDisabled();
  await act(async () => complete(variant));
  expect(await screen.findByText(/Presentación guardada/)).toBeVisible();
});

test("shows nested attribute validation from the API without losing the entered value", async () => {
  const user = userEvent.setup();
  catalogMock();
  render(<VariantManager product={product} onChange={vi.fn()} />);
  await screen.findByLabelText("Color (opcional)");
  await openOptions(user);
  await user.type(screen.getByLabelText("SKU", { exact: true }), "TEC-001");
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "50");
  await user.type(screen.getByLabelText("Color (opcional)"), "Azul");
  const failure = Object.assign(
    new ApiError(400, "invalid", "Revisa los datos"),
    {
      details: { attributes: [{ attribute: ["Este atributo ya no existe."] }] },
    },
  );
  vi.mocked(api).mockRejectedValueOnce(failure);
  await user.click(
    screen.getByRole("button", {
      name: /Guardar presentación|Guardar cambios/,
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Atributos: Atributo: Este atributo ya no existe.",
  );
  expect(screen.getByLabelText("Color (opcional)")).toHaveValue("Azul");
  expect(screen.getByLabelText("Precio de venta (COP)")).toHaveValue(50);
});

async function openOptions(user: ReturnType<typeof userEvent.setup>) {
  const stock = screen.queryByLabelText("Unidades disponibles");
  if (stock && (stock as HTMLInputElement).value === "")
    await user.type(stock, "0");
  for (const label of [
    "Código interno (opcional)",
    "Características adicionales (opcional)",
  ]) {
    const summary = screen.queryByText(label);
    if (summary && !summary.closest("details")?.open) await user.click(summary);
  }
}

test("guides a first-time user and adds a presentation with stock without asking for an internal code", async () => {
  const user = userEvent.setup();
  catalogMock([variant]);
  render(<VariantManager product={product} onChange={vi.fn()} />);
  await screen.findByRole("button", {
    name: "Cambiar nombre o precio de Estándar",
  });
  expect(screen.getByText(/¿Solo vendes una versión/)).toBeVisible();
  expect(
    screen.queryByLabelText("Nombre de la presentación"),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Añadir otra presentación" }),
  );
  expect(
    screen.getByRole("heading", { name: "Añadir una presentación" }),
  ).toHaveFocus();
  await user.clear(screen.getByLabelText("Nombre de la presentación"));
  await user.type(
    screen.getByLabelText("Nombre de la presentación"),
    "Negro · 128 GB",
  );
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "50000");
  await user.clear(screen.getByLabelText("Unidades disponibles"));
  await user.type(screen.getByLabelText("Unidades disponibles"), "5");
  await user.click(
    screen.getByRole("button", { name: "Guardar presentación" }),
  );
  await screen.findByText(/Presentación guardada/);
  const request = vi
    .mocked(api)
    .mock.calls.find(([, options]) => options?.method === "POST");
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
    name: "Negro · 128 GB",
    price: "50000",
    initial_stock: 5,
  });
  expect(JSON.parse(String(request?.[1]?.body))).not.toHaveProperty("sku");
});
