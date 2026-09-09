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
