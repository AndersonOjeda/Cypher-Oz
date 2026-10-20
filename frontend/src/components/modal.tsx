"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (typeof dialog.close === "function") dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-label={label} onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90vh] max-w-[95vw] rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/50">{children}</dialog>;
}
