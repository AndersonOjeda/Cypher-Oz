import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthNavLink } from "./auth-nav-link";
import { api } from "@/services/api";

vi.mock("next/navigation", () => ({
  usePathname: () => "/catalogo",
}));

vi.mock("@/services/api", () => ({
  api: vi.fn(),
}));

describe("AuthNavLink", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("renders Iniciar sesión link when unauthenticated", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Unauthorized"));
    render(<AuthNavLink />);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Iniciar sesión/i }),
      ).toBeVisible();
    });
    expect(
      screen.queryByRole("link", { name: "Administración" }),
    ).not.toBeInTheDocument();
  });

  test("renders Mi cuenta and hides Iniciar sesión for CLIENT user", async () => {
    vi.mocked(api).mockResolvedValue({
      name: "Camila Cliente",
      email: "cliente@cypheroz.co",
      role: "CLIENT",
    });
    render(<AuthNavLink />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Mi cuenta" })).toBeVisible();
    });
    expect(
      screen.queryByRole("link", { name: /Iniciar sesión/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Administración" }),
    ).not.toBeInTheDocument();
  });

  test("renders Administración badge and Mi cuenta for ADMIN user", async () => {
    vi.mocked(api).mockResolvedValue({
      name: "Anderson Admin",
      email: "admin@tti.example",
      role: "ADMIN",
    });
    render(<AuthNavLink />);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Administración" }),
      ).toHaveAttribute("href", "/admin/catalogo");
    });
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute(
      "href",
      "/cuenta",
    );
    expect(
      screen.queryByRole("link", { name: /Iniciar sesión/i }),
    ).not.toBeInTheDocument();
  });
});
