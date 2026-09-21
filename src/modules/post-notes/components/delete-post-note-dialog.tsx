"use client";

import { useEffect, useRef } from "react";

type DeletePostNoteDialogProps = {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeletePostNoteDialog({
  isDeleting,
  onCancel,
  onConfirm,
}: DeletePostNoteDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="post-note-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target && !isDeleting) onCancel();
      }}
    >
      <div
        aria-describedby="post-note-delete-description"
        aria-labelledby="post-note-delete-title"
        aria-modal="true"
        className="post-note-dialog"
        role="alertdialog"
      >
        <div aria-hidden="true" className="post-note-dialog-icon">
          <svg viewBox="0 0 24 24">
            <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
          </svg>
        </div>
        <h2 id="post-note-delete-title">¿Eliminar esta nota?</h2>
        <p id="post-note-delete-description">
          La nota se eliminará de forma permanente. Esta acción no se puede deshacer.
        </p>
        <div className="post-note-dialog-actions">
          <button
            className="post-note-dialog-cancel"
            disabled={isDeleting}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="post-note-dialog-confirm"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
