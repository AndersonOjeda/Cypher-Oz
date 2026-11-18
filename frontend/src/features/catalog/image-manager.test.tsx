import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/services/api";
import { ImageManager } from "./image-manager";

vi.mock("@/services/api", () => ({ api: vi.fn() }));
const photo = {
  id: 7,
  url: "https://example.com/white.webp",
  alt_text: "Blanco",
  sort_order: 2,
  width: 100,
  height: 100,
  byte_size: 100,
  variant_id: 9,
};
const limits = {
  max_image_bytes: 1048576,
  max_image_dimension: 2000,
  max_images: 10,
};

beforeEach(() => {
  vi.mocked(api).mockReset();
});

test("loads all variant pages, keeps the saved assignment, and can make an image general", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.includes("page=1"))
      return {
        results: [{ id: 8, name: "Negro", is_active: true }],
        next: "page2",
      };
    if (path.includes("page=2"))
      return {
        results: [{ id: 9, name: "Blanco", is_active: true }],
        next: null,
      };
    if (options?.method === "PATCH") return { ...photo, variant_id: null };
    return [{ ...photo, variant_id: null }];
  });
  render(
    <ImageManager productId={7} initialImages={[photo]} limits={limits} />,
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText("Variante / modelo de la imagen"),
    ).toBeEnabled(),
  );
  const selector = screen.getByLabelText("Variante / modelo de la imagen");
  expect(selector).toHaveValue("9");
  expect(
    within(selector).getByRole("option", { name: "Negro" }),
  ).toBeInTheDocument();
  await user.selectOptions(selector, "");
  await user.click(screen.getByRole("button", { name: "Guardar imagen" }));
  await screen.findByText("Imagen actualizada.");
  const patch = vi
    .mocked(api)
    .mock.calls.find(([, options]) => options?.method === "PATCH");
  expect(JSON.parse(patch![1]!.body as string)).toMatchObject({
    variant_id: null,
  });
});
