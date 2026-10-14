import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/services/api";
import { PasswordResetConfirm, PasswordResetRequest } from "./password-reset";

vi.mock("@/services/api", async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));

beforeEach(() => vi.mocked(api).mockReset());

test("requests recovery and shows the generic response", async () => {
  vi.mocked(api).mockResolvedValue({
    message:
      "Si el correo está registrado, recibirás instrucciones para continuar.",
  });
  render(<PasswordResetRequest />);
  await userEvent.type(
    screen.getByLabelText("Correo electrónico"),
    "cliente@example.com",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Enviar instrucciones" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Si el correo está registrado",
  );
  expect(api).toHaveBeenCalledWith(
    "/auth/password-reset/request/",
    expect.objectContaining({ method: "POST" }),
  );
});

test("requires matching passwords before confirming", async () => {
  render(<PasswordResetConfirm token="token-valido-de-prueba-con-longitud" />);
  await userEvent.type(
    screen.getByLabelText("Nueva contraseña"),
    "Nueva-clave!9842",
  );
  await userEvent.type(
    screen.getByLabelText("Confirmar contraseña"),
    "Distinta-clave!9842",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Cambiar contraseña" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("no coinciden");
  expect(api).not.toHaveBeenCalled();
});

test("confirms a valid token and links back to login", async () => {
  vi.mocked(api).mockResolvedValue({
    message: "Contraseña actualizada. Ya puedes iniciar sesión.",
  });
  render(<PasswordResetConfirm token="token-valido-de-prueba-con-longitud" />);
  await userEvent.type(
    screen.getByLabelText("Nueva contraseña"),
    "Nueva-clave!9842",
  );
  await userEvent.type(
    screen.getByLabelText("Confirmar contraseña"),
    "Nueva-clave!9842",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Cambiar contraseña" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Contraseña actualizada",
  );
  expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
    "href",
    "/login",
  );
});
