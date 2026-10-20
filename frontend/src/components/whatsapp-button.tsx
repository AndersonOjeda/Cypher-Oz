"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";

export type WhatsAppSettings = {
  whatsapp_enabled: boolean;
  whatsapp_number: string;
  whatsapp_message: string;
};

export function whatsappUrl(settings: WhatsAppSettings) {
  if (
    !settings.whatsapp_enabled ||
    !/^[1-9]\d{7,14}$/.test(settings.whatsapp_number)
  )
    return null;
  return `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(settings.whatsapp_message)}`;
}

export function orderWhatsAppUrl(settings: WhatsAppSettings, orderNumber: string) {
  if (
    !settings.whatsapp_enabled ||
    !/^[1-9]\d{7,14}$/.test(settings.whatsapp_number)
  )
    return null;
  const message = `Hola, necesito asistencia con mi pedido #${orderNumber}`;
  return `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppLink({ settings }: { settings: WhatsAppSettings }) {
  const url = whatsappUrl(settings);
  if (!url) return null;
  return (
    <a
      className="whatsapp"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar a TTI por WhatsApp (abre otra pestaña)"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
        <path d="M8 7c0 5 4 9 9 9l1-3-3-1-1 1c-2-1-3-2-4-4l1-1-1-2Z" />
      </svg>
      <span>Hablemos por WhatsApp</span>
    </a>
  );
}

export function OrderWhatsAppButton({
  orderNumber,
  settings: propSettings,
}: {
  orderNumber: string;
  settings?: WhatsAppSettings;
}) {
  const [settings, setSettings] = useState<WhatsAppSettings | undefined>(propSettings);

  useEffect(() => {
    if (propSettings) return;
    let active = true;
    fetch("/api/v1/settings/public/")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setSettings(data);
      })
      .catch(() => {
        if (active) setSettings(undefined);
      });
    return () => {
      active = false;
    };
  }, [propSettings]);

  const effectiveSettings = propSettings ?? settings;
  if (!effectiveSettings) return null;
  const url = orderWhatsAppUrl(effectiveSettings, orderNumber);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Contactar por WhatsApp sobre el pedido #${orderNumber} (abre en pestaña nueva)`}
      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded shadow-sm transition"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
        <path d="M8 7c0 5 4 9 9 9l1-3-3-1-1 1c-2-1-3-2-4-4l1-1-1-2Z" />
      </svg>
      <span>Asistencia por WhatsApp</span>
    </a>
  );
}

export function WhatsAppButton() {
  const [settings, setSettings] = useState<WhatsAppSettings>();
  useEffect(() => {
    let active = true;
    function load() {
      api<WhatsAppSettings>("/settings/public/")
        .then((data) => {
          if (active) setSettings(data);
        })
        .catch(() => {
          if (active) setSettings(undefined);
        });
    }
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);
  return settings ? <WhatsAppLink settings={settings} /> : null;
}
