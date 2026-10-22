"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Move to the editor after React has rendered the requested record. */
export function useEditorNavigation() {
  const editorRef = useRef<HTMLHeadingElement>(null);
  const [request, setRequest] = useState(0);
  const showEditor = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    if (!request) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    editor.scrollIntoView?.({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [request]);

  return {
    editorRef,
    showEditor,
  };
}
