import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerList } from "./customer-list";

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
        return Promise.resolve([mockCustomers[0]]);
      }
      if (path.includes("/admin/customers/")) {
        return Promise.resolve(mockCustomers);
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
});

