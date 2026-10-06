import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api, ApiError } from "@/services/api";
import { TaxonomyManager } from "./taxonomy-manager";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));
beforeEach(() => vi.mocked(api).mockReset());
const empty = { count: 0, next: null, previous: null, results: [] };

test("creates category with derived slug and preserves server validation errors", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockResolvedValue(empty);
  render(<TaxonomyManager kind="categories" />);
  await screen.findByText(/No hay registros/);
  await user.type(
    screen.getByLabelText("Nombre", { exact: true }),
    "Audio y vídeo",
  );
  expect(screen.getByLabelText("Identificador")).toHaveValue("audio-y-video");
  vi.mocked(api).mockRejectedValueOnce(
    new ApiError(400, "invalid", "Revisa los datos", {
      name: ["Ya existe un registro con este nombre."],
    }),
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe");
  expect(screen.getByLabelText("Nombre", { exact: true })).toHaveValue(
    "Audio y vídeo",
  );
  vi.mocked(api).mockResolvedValue(empty);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByText("Cambios guardados.");
  await waitFor(() =>
    expect(screen.getByLabelText("Nombre", { exact: true })).toHaveValue(""),
  );
});

test("failure can be retried and empty list is not confused with loading", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockRejectedValueOnce(new Error("Sin conexión"));
  render(<TaxonomyManager kind="brands" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
  vi.mocked(api).mockResolvedValue(empty);
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText(/No hay registros/)).toBeVisible();
});
