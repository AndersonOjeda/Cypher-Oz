import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderReviewForm, ProductReviews, ReportReviewButton } from "./reviews";
import { api } from "@/services/api";

vi.mock("@/services/api", async (original) => ({ ...(await original<typeof import("@/services/api")>()), api: vi.fn() }));
const apiMock = vi.mocked(api);

describe("Sprint 8 review UI", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders public ratings and a privacy-minimal verified review", async () => {
    apiMock.mockResolvedValue({
      count: 1, next: null, previous: null,
      summary: { average_rating: 4.5, average_rating_display: "4,5", review_count: 1 },
      results: [{ id: 7, product_id: 2, rating: 5, comment: "Funciona muy bien", author_name: "Ana P.", verified_purchase: true, verified_label: "Compra verificada", is_edited: false, edited_at: null, created_at: "2026-11-01T12:00:00Z" }],
    } as never);
    render(<ProductReviews slug="audifonos" />);
    expect(await screen.findByText("Funciona muy bien")).toBeInTheDocument();
    expect(screen.getByText("4,5")).toBeInTheDocument();
    expect(screen.getByText(/Compra verificada/)).toBeInTheDocument();
  });

  it("creates a verified review from the selected order item", async () => {
    apiMock.mockResolvedValue({ id: 9, rating: 5, comment: "Excelente producto" } as never);
    const onSaved = vi.fn();
    render(<OrderReviewForm orderItemId={42} existing={null} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Tu opinión"), { target: { value: "Excelente producto" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/reviews/", expect.objectContaining({ method: "POST", body: JSON.stringify({ order_item_id: 42, rating: 5, comment: "Excelente producto" }) })));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("reports an opinion and leaves it visible while moderation is pending", async () => {
    apiMock.mockResolvedValue({} as never);
    render(<ReportReviewButton reviewId={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Reportar opinión" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Debe ser revisada" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(await screen.findByRole("status")).toHaveTextContent("La opinión sigue visible");
    expect(apiMock).toHaveBeenCalledWith("/reviews/7/report/", expect.objectContaining({ method: "POST" }));
  });
});
