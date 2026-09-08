import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthForm } from "./auth-form";
import { api, ApiError } from "@/services/api";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  api: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

async function fill(register = false) {
  const user = userEvent.setup();
  if (register)
    await user.type(screen.getByLabelText("Nombre completo"), "Ana Torres");
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "ana@example.com",
  );
  await user.type(
    screen.getByLabelText("Contraseña"),
    "Una-clave!Distinta8472",
  );
  return user;
}

test("registration feedback after API success", async () => {
  vi.mocked(api).mockResolvedValue({});
  render(<AuthForm mode="register" />);
  const user = await fill(true);
  await user.click(screen.getByRole("button", { name: /Crear cuenta/ }));
  expect(
    await screen.findByRole("heading", { name: "Tu cuenta está lista" }),
  ).toBeVisible();
  expect(api).toHaveBeenCalledWith(
    "/auth/register/",
    expect.objectContaining({ method: "POST" }),
  );
});

test("invalid email stops request", async () => {
  render(<AuthForm mode="register" />);
  await userEvent.type(
    screen.getByLabelText("Correo electrónico"),
    "not-email",
  );
  await userEvent.click(screen.getByRole("button", { name: /Crear cuenta/ }));
  expect(await screen.findByText("Ingresa un correo válido.")).toBeVisible();
  expect(api).not.toHaveBeenCalled();
});

test("duplicate email is displayed", async () => {
  vi.mocked(api).mockRejectedValue(
    new ApiError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "Ya existe una cuenta con este correo.",
    ),
  );
  render(<AuthForm mode="register" />);
  const user = await fill(true);
  await user.click(screen.getByRole("button", { name: /Crear cuenta/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ya existe una cuenta",
  );
});

test("backend password policy errors are displayed at field", async () => {
  vi.mocked(api).mockRejectedValue(
    new ApiError(400, "validation_error", "Revisa los datos.", {
      password: ["Contraseña demasiado común."],
    }),
  );
  render(<AuthForm mode="register" />);
  const user = await fill(true);
  await user.click(screen.getByRole("button", { name: /Crear cuenta/ }));
  expect(await screen.findByText("Contraseña demasiado común.")).toBeVisible();
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("login goes to account", async () => {
  vi.mocked(api).mockResolvedValue({});
  render(<AuthForm mode="login" />);
  const user = await fill();
  await user.click(screen.getByRole("button", { name: /Iniciar sesión/ }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/cuenta"));
});

test("wrong password keeps form available and shows error", async () => {
  vi.mocked(api).mockRejectedValue(
    new ApiError(
      401,
      "authentication_failed",
      "Correo o contraseña incorrectos.",
    ),
  );
  render(<AuthForm mode="login" />);
  const user = await fill();
  await user.click(screen.getByRole("button", { name: /Iniciar sesión/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Correo o contraseña incorrectos.",
  );
  expect(push).not.toHaveBeenCalled();
});

test("pending request disables submit", async () => {
  vi.mocked(api).mockReturnValue(new Promise(() => {}));
  render(<AuthForm mode="login" />);
  const user = await fill();
  await user.click(screen.getByRole("button", { name: /Iniciar sesión/ }));
  expect(
    await screen.findByRole("button", { name: /Un momento/ }),
  ).toBeDisabled();
});
