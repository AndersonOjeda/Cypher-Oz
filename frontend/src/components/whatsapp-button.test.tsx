import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { WhatsAppLink, whatsappUrl } from "./whatsapp-button";

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
