"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const INITIAL_MESSAGES: Message[] = [
  {
    role: "assistant",
    content:
      "¡Hola! 👋 Soy el asistente virtual de TTI. Puedo ayudarte a buscar productos, consultar disponibilidad y precios. ¿En qué te puedo ayudar?",
  },
];

export function AiAssistant() {
  const [available, setAvailable] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/assistant/chat/", { signal: controller.signal })
      .then(
        async (response) =>
          response.ok && (await response.json()).available === true,
      )
      .then((enabled) => {
        if (!controller.signal.aborted) setAvailable(enabled);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof listRef.current?.scrollTo === "function") {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/assistant/chat/", {
        method: "POST",
        signal: AbortSignal.timeout(26000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages
            .filter((message) => message !== INITIAL_MESSAGES[0])
            .slice(-10),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Has enviado varios mensajes. Espera un minuto e intenta de nuevo."
            : "El asistente no está disponible ahora. Intenta más tarde.",
        );
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "No pude procesar tu solicitud.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error && error.name === "Error"
              ? error.message
              : "Hubo un error de conexión. Intenta de nuevo.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!available) return null;

  return (
    <>
      <button
        ref={toggleRef}
        className="ai-assistant-toggle"
        onClick={() => setOpen(!open)}
        aria-label={
          open ? "Cerrar asistente virtual" : "Abrir asistente virtual"
        }
        aria-expanded={open}
        aria-controls="ai-assistant-panel"
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7Z" />
            <path d="M9 21h6M10 17v1M14 17v1" />
          </svg>
        )}
        {!open && <span>Asistente IA</span>}
      </button>

      {open && (
        <aside
          id="ai-assistant-panel"
          className="ai-assistant-panel"
          role="dialog"
          aria-label="Asistente virtual de TTI"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              toggleRef.current?.focus();
            }
          }}
        >
          <header className="ai-assistant-header">
            <div>
              <strong>Asistente TTI</strong>
              <small>Consulta el catálogo de la tienda</small>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div
            className="ai-assistant-messages"
            ref={listRef}
            role="log"
            aria-live="polite"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
                {msg.role === "assistant" && (
                  <span className="ai-avatar">🤖</span>
                )}
                <p>{msg.content}</p>
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-assistant">
                <span className="ai-avatar">🤖</span>
                <p className="ai-typing">
                  Escribiendo<span>...</span>
                </p>
              </div>
            )}
          </div>

          <form className="ai-assistant-input" onSubmit={send}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre productos, precios..."
              maxLength={500}
              disabled={loading}
              aria-label="Escribe tu mensaje"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar mensaje"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="m22 2-11 11" />
              </svg>
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
