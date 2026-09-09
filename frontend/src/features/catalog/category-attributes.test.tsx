import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api, ApiError } from "@/services/api";
import { CategoryAttributes } from "./category-attributes";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api).mockReset();
});

test("creates a category attribute and preserves conflicting values for correction", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <CategoryAttributes
      categoryId={2}
      attributes={[]}
      loading={false}
      onChange={onChange}
    />,
  );
  await user.click(screen.getByText("Atributos de la categoría"));
  await user.type(screen.getByLabelText("Nombre del atributo"), "Resolución");
  expect(screen.getByLabelText("Código del atributo")).toHaveValue(
    "resolucion",
  );
  vi.mocked(api).mockRejectedValueOnce(
    new ApiError(409, "conflict", "Revisa los datos", {
      code: ["Este código ya existe en la categoría."],
    }),
  );
  await user.click(screen.getByRole("button", { name: "Guardar atributo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Este código ya existe",
  );
  expect(screen.getByLabelText("Nombre del atributo")).toHaveValue(
    "Resolución",
  );
  await user.clear(screen.getByLabelText("Código del atributo"));
  await user.type(
    screen.getByLabelText("Código del atributo"),
    "resolucion-pantalla",
  );
  vi.mocked(api).mockResolvedValueOnce({});
  await user.click(screen.getByRole("button", { name: "Guardar atributo" }));
  await screen.findByText("Atributo guardado.");
  expect(api).toHaveBeenLastCalledWith("/admin/categories/2/attributes/", {
    method: "POST",
    body: JSON.stringify({ name: "Resolución", code: "resolucion-pantalla" }),
  });
  expect(onChange).toHaveBeenCalledOnce();
});

test("edits a category attribute without moving its category", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockResolvedValue({});
  render(
    <CategoryAttributes
      categoryId={2}
      attributes={[{ id: 4, category: 2, name: "Color", code: "color" }]}
      loading={false}
      onChange={vi.fn()}
    />,
  );
  await user.click(screen.getByText("Atributos de la categoría"));
  await user.click(
    screen.getByRole("button", { name: "Editar atributo Color" }),
  );
  await user.clear(screen.getByLabelText("Nombre del atributo"));
  await user.type(screen.getByLabelText("Nombre del atributo"), "Acabado");
  await user.click(screen.getByRole("button", { name: "Guardar atributo" }));
  await screen.findByText("Atributo guardado.");
  expect(api).toHaveBeenCalledWith("/admin/attributes/4/", {
    method: "PATCH",
    body: JSON.stringify({ name: "Acabado", code: "color" }),
  });
});
