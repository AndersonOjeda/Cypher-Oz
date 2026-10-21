import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AiAssistant } from "./ai-assistant";

describe("AiAssistant component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ available: true }),
        }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("hides the assistant when the server has no configured key", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ available: false }),
    } as Response);
    render(<AiAssistant />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: /Abrir asistente virtual/i }),
    ).not.toBeInTheDocument();
  });

  test("shows throttling feedback and returns focus on Escape", async () => {
    render(<AiAssistant />);
    const toggle = await screen.findByRole("button", {
      name: /Abrir asistente virtual/i,
    });
    fireEvent.click(toggle);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response);
    fireEvent.change(screen.getByLabelText(/Escribe tu mensaje/i), {
      target: { value: "Hola" },
    });
    fireEvent.click(screen.getByLabelText(/Enviar mensaje/i));
    expect(await screen.findByText(/Espera un minuto/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("renders the floating toggle button", async () => {
    render(<AiAssistant />);
    const toggleBtn = await screen.findByRole("button", {
      name: /Abrir asistente virtual/i,
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.getByText("Asistente IA")).toBeInTheDocument();
  });

  test("opens chat panel on click and displays welcome message", async () => {
    render(<AiAssistant />);
    const toggleBtn = await screen.findByRole("button", {
      name: /Abrir asistente virtual/i,
    });
    fireEvent.click(toggleBtn);

    expect(
      screen.getByRole("dialog", { name: /Asistente virtual de TTI/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Asistente TTI")).toBeInTheDocument();
    expect(
      screen.getByText(/¡Hola! 👋 Soy el asistente virtual de TTI/i),
    ).toBeInTheDocument();
  });

  test("sends user message and displays assistant response", async () => {
    const fakeReply = "Tenemos varios cargadores disponibles.";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: fakeReply, available: true }),
    } as Response);

    render(<AiAssistant />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Abrir asistente virtual/i }),
    );

    const input = screen.getByLabelText(/Escribe tu mensaje/i);
    const submitBtn = screen.getByLabelText(/Enviar mensaje/i);

    fireEvent.change(input, { target: { value: "¿Tienen cargadores?" } });
    fireEvent.click(submitBtn);

    expect(screen.getByText("¿Tienen cargadores?")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(fakeReply)).toBeInTheDocument();
    });

    const request = vi
      .mocked(fetch)
      .mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(request![1]!.body as string)).toEqual({
      message: "\u00bfTienen cargadores?",
      history: [],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/assistant/chat/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  test("closes panel when close button is clicked", async () => {
    render(<AiAssistant />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Abrir asistente virtual/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Cerrar" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
