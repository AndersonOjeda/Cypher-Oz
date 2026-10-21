import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminAccountMenu, AdminNavigation } from "./admin-navigation";

test("marks the active section including a nested order page and separates personal links", () => {
  render(<AdminNavigation pathname="/admin/pedidos/ABC-123" />);
  const navigation = screen.getByRole("navigation", {
    name: "Secciones de administración",
  });
  expect(
    within(navigation).getByRole("link", { name: "Gestión de pedidos" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    within(navigation).getByRole("link", { name: "Inventario" }),
  ).not.toHaveAttribute("aria-current");
  expect(
    within(navigation).queryByRole("link", { name: "Mis pedidos" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Mis pedidos" })).toHaveAttribute(
    "href",
    "/pedidos",
  );
});

test("mobile toggle supports Escape, returns focus and closes after selecting a section", async () => {
  const user = userEvent.setup();
  render(<AdminNavigation pathname="/admin/catalogo" />);
  const toggle = screen.getByRole("button", { name: /Menú de administración/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await user.tab();
  await user.keyboard("{Escape}");
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await user.click(toggle);
  await user.click(screen.getByRole("link", { name: "Administrar catálogo" }));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("account groups secondary tools in a disclosure and keeps the catalog entry visible", async () => {
  const user = userEvent.setup();
  render(<AdminAccountMenu />);
  expect(
    screen.getByRole("link", { name: "Administrar catálogo" }),
  ).toBeVisible();
  const summary = screen.getByText("Más herramientas de administración");
  expect(summary.closest("details")).not.toHaveAttribute("open");
  await user.click(summary);
  expect(summary.closest("details")).toHaveAttribute("open");
  expect(screen.getByRole("link", { name: "Configuración" })).toBeVisible();
});
