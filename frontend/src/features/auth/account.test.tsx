import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { Account } from "./account";
import { api, ApiError } from "@/services/api";

const { router } = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  api: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

test("session displays server user and logout clears access", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({
      name: "Ana",
      email: "ana@example.com",
      role: "CLIENT",
      addresses: [],
    })
    .mockResolvedValueOnce(undefined);
  render(<Account />);
  expect(
    await screen.findByRole("heading", { name: "Hola, Ana" }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(api).toHaveBeenLastCalledWith("/auth/logout/", { method: "POST" });
});

test("profile and addresses can be edited", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({
      name: "Ana",
      email: "ana@example.com",
      role: "CLIENT",
      addresses: [],
    })
    .mockResolvedValueOnce({
      name: "Ana Maria",
      email: "ana@example.com",
      role: "CLIENT",
      addresses: [],
    })
    .mockResolvedValueOnce({
      id: 7,
      label: "Casa",
      recipient_name: "Ana Maria",
      phone: "3001234567",
      address_line: "Calle 18 # 20-30",
      city: "Pasto",
      state: "Narino",
      notes: "",
      is_default: true,
    })
    .mockResolvedValueOnce(undefined);
  render(<Account />);
  await screen.findByRole("heading", { name: "Hola, Ana" });
  await userEvent.clear(screen.getByLabelText("Nombre completo"));
  await userEvent.type(screen.getByLabelText("Nombre completo"), "Ana Maria");
  await userEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
  await screen.findByText("Perfil actualizado.");
  expect(api).toHaveBeenCalledWith("/users/me/", {
    method: "PATCH",
    body: JSON.stringify({ name: "Ana Maria", email: "ana@example.com" }),
  });
  await userEvent.type(screen.getByLabelText("Etiqueta"), "Casa");
  await userEvent.type(screen.getByLabelText("Recibe"), "Ana Maria");
  await userEvent.type(screen.getByLabelText("Teléfono"), "3001234567");
  await userEvent.type(screen.getByLabelText("Dirección"), "Calle 18 # 20-30");
  await userEvent.click(
    screen.getByRole("button", { name: "Agregar dirección" }),
  );
  expect(await screen.findByText("Casa - principal")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Eliminar Casa" }));
  await screen.findByText("Dirección eliminada.");
  expect(api).toHaveBeenLastCalledWith("/users/me/addresses/7/", {
    method: "DELETE",
  });
});

test("unauthenticated account redirects to login", async () => {
  vi.mocked(api).mockRejectedValue(
    new ApiError(401, "unauthorized", "Sin sesion"),
  );
  render(<Account />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
});

test("network failure shows controlled error", async () => {
  vi.mocked(api).mockRejectedValue(new Error("No pudimos conectar."));
  render(<Account />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No pudimos conectar.",
  );
});
