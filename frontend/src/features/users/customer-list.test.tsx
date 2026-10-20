import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerList } from "./customer-list";
import { api, ApiError } from "@/services/api";

const mockCustomers = [
  {
    id: 1,
    name: "Juan Perez",
    email: "juan@test.com",
    created_at: "2026-03-15T10:00:00Z",
    order_count: 2,
  },
  {
    id: 2,
    name: "Maria Lopez",
    email: "maria@test.com",
    created_at: "2026-03-20T14:30:00Z",
    order_count: 0,
  },
];

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: vi.fn((path: string) => {
      if (path.includes("/admin/customers/?q=Juan")) {
        return Promise.resolve({
          count: 1,
          previous: null,
          next: null,
          results: [mockCustomers[0]],
        });
      }
      if (path.includes("/admin/customers/")) {
        return Promise.resolve({
          count: 2,
          previous: null,
          next: null,
          results: mockCustomers,
        });
      }
      return Promise.reject(new Error("Not found"));
    }),
  };
});

describe("CustomerList (CO-62 HU-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders customer table with names, emails, dates and order counts", async () => {
    render(<CustomerList />);

    expect(screen.getByRole("status")).toHaveTextContent(/cargando clientes/i);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.getByText("juan@test.com")).toBeInTheDocument();
      expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
      expect(screen.getByText("maria@test.com")).toBeInTheDocument();
    });

    // Order counts displayed
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("filters customer results by search query", async () => {
    render(<CustomerList />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText("Buscar cliente");
    fireEvent.change(searchInput, { target: { value: "Juan" } });

    const submitBtn = screen.getByRole("button", { name: /buscar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.queryByText("Maria Lopez")).not.toBeInTheDocument();
    });
  });

  it("requests the next page and preserves the submitted search", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      count: 21,
      next: "/admin/customers/?page=2",
      previous: null,
      results: [mockCustomers[0]],
    });
    render(<CustomerList />);
    const next = await screen.findByRole("button", { name: "Siguiente" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await waitFor(() =>
      expect(vi.mocked(api)).toHaveBeenLastCalledWith(
        "/admin/customers/?q=&page=2",
      ),
    );
  });

  it("shows empty results and blocks non-admin access with a clear error", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    render(<CustomerList />);
    await screen.findByText(/No se encontraron clientes/);
    vi.mocked(api).mockRejectedValueOnce(
      new ApiError(403, "forbidden", "Forbidden"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Buscar" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes permisos para consultar clientes.",
    );
  });
});
