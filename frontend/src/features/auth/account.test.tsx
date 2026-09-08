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
beforeEach(() => vi.clearAllMocks());
test("session displays server user and logout clears access", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({
      name: "Ana",
      email: "ana@example.com",
      role: "CLIENT",
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
test("unauthenticated account redirects to login", async () => {
  vi.mocked(api).mockRejectedValue(
    new ApiError(401, "unauthorized", "Sin sesión"),
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
