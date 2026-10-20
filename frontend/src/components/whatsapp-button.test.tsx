import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import {
  OrderWhatsAppButton,
  WhatsAppLink,
  orderWhatsAppUrl,
  whatsappUrl,
} from "./whatsapp-button";

const settings = {
  whatsapp_enabled: true,
  whatsapp_number: "12025550123",
  whatsapp_message: "Hola & gracias ¿TTI?",
};

test("URL encodes configured message", () => {
  const url = new URL(whatsappUrl(settings)!);
  expect(url.origin).toBe("https://wa.me");
  expect(url.pathname).toBe("/12025550123");
  expect(url.searchParams.get("text")).toBe(settings.whatsapp_message);
});

test("disabled channel is hidden", () => {
  render(<WhatsAppLink settings={{ ...settings, whatsapp_enabled: false }} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("invalid number is not linked", () => {
  expect(
    whatsappUrl({ ...settings, whatsapp_number: "javascript:alert(1)" }),
  ).toBeNull();
});

test("accessible safe new-tab link", () => {
  render(<WhatsAppLink settings={settings} />);
  const link = screen.getByRole("link", {
    name: /Contactar a TTI por WhatsApp/,
  });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

// CO-72 HU-31: WhatsApp contextual desde pedido
test("CO-72 HU-31: orderWhatsAppUrl formats message with order number and encodes URI", () => {
  const orderNumber = "ORD-2026-ABC-123";
  const urlString = orderWhatsAppUrl(settings, orderNumber);
  expect(urlString).not.toBeNull();
  const url = new URL(urlString!);
  expect(url.origin).toBe("https://wa.me");
  expect(url.pathname).toBe("/12025550123");
  expect(url.searchParams.get("text")).toBe("Hola, necesito asistencia con mi pedido #ORD-2026-ABC-123");
});

test("CO-72 HU-31: orderWhatsAppUrl returns null when disabled", () => {
  expect(orderWhatsAppUrl({ ...settings, whatsapp_enabled: false }, "ORD-123")).toBeNull();
});

test("CO-72 HU-31: OrderWhatsAppButton renders link with order context and privacy safe target", () => {
  render(<OrderWhatsAppButton orderNumber="ORD-999" settings={settings} />);
  const link = screen.getByRole("link", {
    name: /Contactar por WhatsApp sobre el pedido #ORD-999/,
  });
  expect(link).toBeInTheDocument();
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(link.getAttribute("href")).toContain("ORD-999");
  // Privacy check: no tokens, passwords or confidential fields
  expect(link.getAttribute("href")).not.toContain("password");
  expect(link.getAttribute("href")).not.toContain("token");
});
