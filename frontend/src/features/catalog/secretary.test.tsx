import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/services/api";
import { Secretary } from "./secretary";

const fixtures = vi.hoisted(() => ({
  role: "ADMIN",
  product: {
    id: 4,
    name: "Cargador Anker",
    slug: "cargador-anker",
    category: { id: 1, name: "Cargadores" },
    brand: { id: 2, name: "Anker" },
    min_price: "120000.00",
    max_price: "120000.00",
    image_url: null,
    total_stock: 4,
    is_available: true,
    variants_count: 1,
    promotional_min_price: null,
    has_promotion: false,
  },
}));
vi.mock("@/services/api", () => ({ api: vi.fn() }));
vi.mock("./shared", () => ({
  slugify: (value: string) => value.toLowerCase(),
  errorText: (error: Error) => error.message,
  allTaxonomy: vi.fn(async (kind: string) =>
    kind === "brands"
      ? [{ id: 2, name: "Anker", is_active: true }]
      : [{ id: 1, name: "Cargadores", is_active: true }],
  ),
  useResource: (path: string) =>
    path === "/users/me/"
      ? { data: { role: fixtures.role }, loading: false, error: "" }
      : {
          data: { results: [fixtures.product], next: null, previous: null },
          loading: false,
          error: "",
        },
}));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(api).mockReset();
  fixtures.role = "ADMIN";
});

test("customers cannot open the secretary workspace", () => {
  fixtures.role = "CLIENT";
  render(<Secretary />);
  expect(
    screen.getByRole("heading", { name: "Acceso administrativo" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Preparar borradores" }),
  ).not.toBeInTheDocument();
});

test("reviews missing values and saves only on explicit confirmation, unpublished", async () => {
  const user = userEvent.setup();
  vi.mocked(api)
    .mockResolvedValueOnce({
      products: [
        {
          name: "Cargador Anker",
          description: "USB-C",
          price: null,
          stock: null,
          category_name: "Cargadores",
          brand_name: "Anker",
        },
      ],
    })
    .mockResolvedValueOnce({ id: 20, name: "Cargador Anker" });
  render(<Secretary />);
  await user.type(
    screen.getByLabelText("Información de los productos"),
    "Cargador Anker USB-C",
  );
  await user.click(screen.getByRole("button", { name: "Preparar borradores" }));
  const price = await screen.findByLabelText("Precio de venta (COP)");
  expect(price).toHaveValue(null);
  expect(screen.getByLabelText("Unidades disponibles")).toHaveValue(null);
  expect(api).toHaveBeenCalledTimes(1);
  await user.type(price, "120000");
  await user.type(screen.getByLabelText("Unidades disponibles"), "4");
  await user.click(
    screen.getByRole("button", { name: "Confirmar y guardar sin publicar" }),
  );
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(
    JSON.parse(vi.mocked(api).mock.calls[1][1]!.body as string),
  ).toMatchObject({
    initial_stock: 4,
    initial_price: "120000",
    is_active: false,
    category: 1,
    brand: 2,
  });
  expect(
    await screen.findByText(/guardado sin publicar, con su precio y unidades/),
  ).toBeInTheDocument();
});

test("catalog preview uses the returned database snapshot and supports print", async () => {
  const user = userEvent.setup();
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  vi.mocked(api).mockResolvedValue({
    title: "Para estudiar",
    introduction: "Accesorios para tus clases",
    products: [fixtures.product],
    prepared_at: "2026-10-21T15:00:00Z",
  });
  render(<Secretary />);
  await user.click(
    screen.getByRole("button", { name: /Preparar un catálogo/ }),
  );
  await user.type(
    screen.getByLabelText("Instrucciones para el catálogo"),
    "Para estudiantes",
  );
  await user.click(
    screen.getByRole("button", { name: "Elegir disponibles de esta página" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Preparar catálogo con IA" }),
  );
  const preview = await screen.findByRole("article", {
    name: "Vista previa del catálogo",
  });
  expect(
    within(preview).getByText("4 unidades disponibles"),
  ).toBeInTheDocument();
  expect(within(preview).getByRole("link")).toHaveAttribute(
    "href",
    "/catalogo/cargador-anker",
  );
  expect(
    JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string),
  ).toMatchObject({ product_ids: [4], brief: "Para estudiantes" });
  await user.click(
    screen.getByRole("button", { name: "Imprimir / guardar PDF" }),
  );
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});

test("shows preparation errors without claiming that products were saved", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockRejectedValue(
    new Error("Servicio temporalmente no disponible"),
  );
  render(<Secretary />);
  await user.type(
    screen.getByLabelText("Información de los productos"),
    "Cargador",
  );
  await user.click(screen.getByRole("button", { name: "Preparar borradores" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Servicio temporalmente no disponible",
  );
  expect(
    screen.queryByRole("button", { name: "Confirmar y guardar sin publicar" }),
  ).not.toBeInTheDocument();
});

test("can create a brand read from the provider without leaving the review", async () => {
  const user = userEvent.setup();
  vi.mocked(api)
    .mockResolvedValueOnce({
      products: [
        {
          name: "Mouse",
          description: "",
          price: null,
          stock: null,
          category_name: "Cargadores",
          brand_name: "Logitech",
        },
      ],
    })
    .mockResolvedValueOnce({ id: 9, name: "Logitech", is_active: true });
  render(<Secretary />);
  await user.type(
    screen.getByLabelText("Información de los productos"),
    "Mouse Logitech",
  );
  await user.click(screen.getByRole("button", { name: "Preparar borradores" }));
  await user.click(
    await screen.findByRole("button", { name: "Crear marca «Logitech»" }),
  );
  expect(api).toHaveBeenLastCalledWith(
    "/admin/brands/",
    expect.objectContaining({ method: "POST" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Marca" })).toHaveValue("9"),
  );
  expect(
    screen.getByRole("button", { name: "Confirmar y guardar sin publicar" }),
  ).toBeInTheDocument();
});
