import { afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/services/api";
import { ProductCreate } from "./product-create";
import type { Product } from "./types";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));
vi.mock("./image-manager", () => ({ ImageManager: () => <p>Subir fotos</p> }));
afterEach(() => vi.clearAllMocks());
const taxonomy = {
  id: 1,
  name: "Accesorios",
  slug: "accesorios",
  description: "",
  is_active: true,
};
const product = {
  id: 9,
  name: "Teclado",
  is_active: true,
  images: [],
} as unknown as Product;
function setup(categories = [taxonomy]) {
  const onCreated = vi.fn(),
    onFinish = vi.fn(),
    onNew = vi.fn();
  render(
    <ProductCreate
      categories={categories}
      brands={[taxonomy]}
      limits={{
        max_image_bytes: 10000,
        max_images: 5,
        max_image_dimension: 1000,
      }}
      onCreated={onCreated}
      onFinish={onFinish}
      onNew={onNew}
    />,
  );
  return { user: userEvent.setup(), onCreated, onFinish, onNew };
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre del producto"), "Teclado");
  await user.type(screen.getByLabelText("Precio de venta (COP)"), "125000.50");
  await user.type(screen.getByLabelText("Unidades disponibles"), "10");
  await user.type(screen.getByLabelText("Descripción"), "Teclado inalámbrico");
}
test("registers product and price in one request, skips optional photos and offers a fresh registration", async () => {
  vi.mocked(api).mockResolvedValue(product);
  const { user, onCreated, onFinish, onNew } = setup();
  expect(screen.queryByLabelText(/SKU|Identificador/)).not.toBeInTheDocument();
  await fill(user);
  await user.click(
    screen.getByRole("button", { name: "Guardar y continuar con fotos" }),
  );
  expect(api).toHaveBeenCalledWith("/admin/products/", {
    method: "POST",
    body: JSON.stringify({
      name: "Teclado",
      category: 1,
      brand: 1,
      description: "Teclado inalámbrico",
      warranty: "",
      initial_price: "125000.5",
      initial_stock: 10,
      is_active: true,
    }),
  });
  expect(onCreated).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Subir fotos")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Terminar registro" }));
  expect(
    screen.getByRole("heading", { name: "Registro terminado" }),
  ).toHaveFocus();
  expect(onFinish).not.toHaveBeenCalled();
  expect(
    screen.getByText(/Se registraron 10 unidades disponibles/),
  ).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Registrar otro producto" }),
  );
  expect(onNew).toHaveBeenCalledOnce();
  expect(api).toHaveBeenCalledTimes(1);
});
test("preserves fields after server failure and retries the same form", async () => {
  vi.mocked(api)
    .mockRejectedValueOnce(new Error("No se pudo guardar"))
    .mockResolvedValueOnce(product);
  const { user } = setup();
  await fill(user);
  await user.click(screen.getByLabelText("Mostrar en el catálogo"));
  await user.click(
    screen.getByRole("button", { name: "Guardar y continuar con fotos" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo guardar",
  );
  expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Teclado");
  expect(screen.getByLabelText("Precio de venta (COP)")).toHaveValue(125000.5);
  await user.click(
    screen.getByRole("button", { name: "Guardar y continuar con fotos" }),
  );
  expect(await screen.findByText("Subir fotos")).toBeVisible();
  expect(
    JSON.parse(String(vi.mocked(api).mock.calls[1][1]?.body)).is_active,
  ).toBe(false);
});
test("explains missing categories and prevents registration", () => {
  setup([]);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Primero necesitas una categoría",
  );
  expect(
    screen.getByRole("button", { name: "Guardar y continuar con fotos" }),
  ).toBeDisabled();
});

test("zero stock is explicit and warns that the product will be sold out", async () => {
  vi.mocked(api).mockResolvedValue(product);
  const { user } = setup();
  await fill(user);
  await user.clear(screen.getByLabelText("Unidades disponibles"));
  await user.type(screen.getByLabelText("Unidades disponibles"), "0");
  await user.click(
    screen.getByRole("button", { name: "Guardar y continuar con fotos" }),
  );
  expect(await screen.findByText(/Registraste 0 unidades/)).toBeVisible();
});
