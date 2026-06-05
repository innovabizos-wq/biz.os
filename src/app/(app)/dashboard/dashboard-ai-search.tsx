"use client";

import { Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const suggestions = [
  "Analiza mis ventas de este mes...",
  "Que pedidos necesitan seguimiento?",
  "Resume las cuentas por cobrar...",
  "Cuales productos tienen bajo stock?",
];

export function DashboardAiSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const currentSuggestion = useMemo(
    () => suggestions[suggestionIndex % suggestions.length],
    [suggestionIndex],
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const doneTyping = !isDeleting && visibleText === currentSuggestion;
    const doneDeleting = isDeleting && visibleText.length === 0;
    const timeout = window.setTimeout(
      () => {
        if (doneTyping) {
          setIsDeleting(true);
          return;
        }

        if (doneDeleting) {
          setIsDeleting(false);
          setSuggestionIndex((current) => current + 1);
          return;
        }

        setVisibleText((current) =>
          isDeleting
            ? current.slice(0, -1)
            : currentSuggestion.slice(0, current.length + 1),
        );
      },
      doneTyping ? 1400 : isDeleting ? 34 : 58,
    );

    return () => window.clearTimeout(timeout);
  }, [currentSuggestion, isDeleting, visibleText]);

  return (
    <form className="dashboard-ai-search" onSubmit={(event) => event.preventDefault()}>
      <Sparkles aria-hidden="true" size={24} />
      <label className="sr-only" htmlFor="dashboard-ai-input">
        Asistente IA
      </label>
      <input
        autoComplete="off"
        id="dashboard-ai-input"
        name="dashboard-ai-input"
        placeholder={visibleText || "Que necesitas hoy?"}
        ref={inputRef}
        type="text"
      />
      <kbd>Ctrl K</kbd>
      <button aria-label="Enviar pregunta" type="submit">
        <Send aria-hidden="true" size={18} />
      </button>
    </form>
  );
}
