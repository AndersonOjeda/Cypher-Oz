import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { api } from "@/services/api";
import { AdminShell } from "./admin-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/clientes" }));
vi.mock("@/services/api", () => ({ api: vi.fn() }));
beforeEach(() => {
  vi.mocked(api).mockReset();
});

test("renders the administrative menu only after an admin session is confirmed", async () => {
  vi.mocked(api).mockResolvedValue({ role: "ADMIN" });
  render(
    <AdminShell>
      <h1>Clientes de la tienda</h1>
    </AdminShell>,
  );
  expect(
    await screen.findByRole("navigation", {
      name: "Secciones de administración",
    }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test.each(["CLIENT", "unauthenticated"])(
  "does not expose administrative navigation to %s",
  async (role) => {
    if (role === "CLIENT") vi.mocked(api).mockResolvedValue({ role });
    else vi.mocked(api).mockRejectedValue(new Error("Sin sesión"));
    render(
      <AdminShell>
        <h1>Acceso administrativo</h1>
      </AdminShell>,
    );
    await screen.findByRole("heading", { name: "Acceso administrativo" });
    expect(
      screen.queryByRole("navigation", { name: "Secciones de administración" }),
    ).not.toBeInTheDocument();
  },
);
