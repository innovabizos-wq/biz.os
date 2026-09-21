"use client";

import { MoreHorizontal, Palette, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  POST_NOTE_MAX_CONTENT_LENGTH,
  POST_NOTE_MAX_HEIGHT,
  POST_NOTE_MAX_WIDTH,
  POST_NOTE_MIN_HEIGHT,
  POST_NOTE_MIN_WIDTH,
} from "@/modules/post-notes/schemas";
import {
  POST_NOTE_COLORS,
  type PostNote,
  type PostNoteColor,
  type PostNotePatch,
} from "@/modules/post-notes/types";

export type PostViewport = {
  height: number;
  width: number;
};

type PostNoteProps = {
  autoFocus: boolean;
  note: PostNote;
  onChange: (noteId: string, patch: PostNotePatch) => void;
  onCommit: (noteId: string, patch?: PostNotePatch) => void;
  onFocus: (noteId: string) => void;
  onRequestDelete: (note: PostNote) => void;
  viewport: PostViewport;
  zIndex: number;
};

type Frame = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type PointerOperation = {
  initialFrame: Frame;
  latestFrame: Frame;
  pointerId: number;
  startX: number;
  startY: number;
};

const COLOR_STYLES: Record<PostNoteColor, { background: string; label: string }> = {
  blue: { background: "#d9efff", label: "Azul" },
  green: { background: "#dff6cf", label: "Verde" },
  pink: { background: "#ffd9e8", label: "Rosa" },
  purple: { background: "#eadcff", label: "Morado" },
  yellow: { background: "#fff1a8", label: "Amarillo" },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function getFrame(note: PostNote, viewport: PostViewport): Frame {
  const width = Math.min(
    note.width,
    Math.max(POST_NOTE_MIN_WIDTH, viewport.width - 16),
  );
  const height = Math.min(
    note.height,
    Math.max(POST_NOTE_MIN_HEIGHT, viewport.height - 16),
  );
  const maxLeft = Math.max(0, viewport.width - width);
  const maxTop = Math.max(0, viewport.height - height);

  return {
    height,
    left: clamp(note.positionX * maxLeft, 0, maxLeft),
    top: clamp(note.positionY * maxTop, 0, maxTop),
    width,
  };
}

function framePositionPatch(frame: Frame, viewport: PostViewport): PostNotePatch {
  const availableX = Math.max(0, viewport.width - frame.width);
  const availableY = Math.max(0, viewport.height - frame.height);

  return {
    positionX: availableX === 0 ? 0 : frame.left / availableX,
    positionY: availableY === 0 ? 0 : frame.top / availableY,
  };
}

export function PostNoteCard({
  autoFocus,
  note,
  onChange,
  onCommit,
  onFocus,
  onRequestDelete,
  viewport,
  zIndex,
}: PostNoteProps) {
  const [draftFrame, setDraftFrame] = useState<Frame | null>(null);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dragRef = useRef<PointerOperation | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<PointerOperation | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const frame = draftFrame ?? getFrame(note, viewport);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsColorMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsColorMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  const noteStyle = useMemo(
    () =>
      ({
        "--post-note-background": COLOR_STYLES[note.color].background,
        height: frame.height,
        left: frame.left,
        top: frame.top,
        width: frame.width,
        zIndex,
      }) as CSSProperties,
    [frame.height, frame.left, frame.top, frame.width, note.color, zIndex],
  );

  function handleDragStart(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;

    onFocus(note.id);

    const target = event.target as HTMLElement;
    if (target.closest("[data-post-control='true']")) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      initialFrame: frame,
      latestFrame: frame,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDraftFrame(frame);
  }

  function handleDragMove(event: ReactPointerEvent<HTMLElement>) {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;

    const maxLeft = Math.max(0, viewport.width - operation.initialFrame.width);
    const maxTop = Math.max(0, viewport.height - operation.initialFrame.height);

    const nextFrame = {
      ...operation.initialFrame,
      left: clamp(
        operation.initialFrame.left + event.clientX - operation.startX,
        0,
        maxLeft,
      ),
      top: clamp(
        operation.initialFrame.top + event.clientY - operation.startY,
        0,
        maxTop,
      ),
    };
    operation.latestFrame = nextFrame;
    setDraftFrame(nextFrame);
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLElement>) {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;

    const finalFrame = operation.latestFrame;
    dragRef.current = null;
    setDraftFrame(null);
    onCommit(note.id, framePositionPatch(finalFrame, viewport));
  }

  function handleResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    onFocus(note.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      initialFrame: frame,
      latestFrame: frame,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDraftFrame(frame);
  }

  function handleResizeMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const operation = resizeRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;

    const maximumWidth = Math.min(
      POST_NOTE_MAX_WIDTH,
      Math.max(POST_NOTE_MIN_WIDTH, viewport.width - operation.initialFrame.left),
    );
    const maximumHeight = Math.min(
      POST_NOTE_MAX_HEIGHT,
      Math.max(POST_NOTE_MIN_HEIGHT, viewport.height - operation.initialFrame.top),
    );

    const nextFrame = {
      ...operation.initialFrame,
      height: Math.round(
        clamp(
          operation.initialFrame.height + event.clientY - operation.startY,
          POST_NOTE_MIN_HEIGHT,
          maximumHeight,
        ),
      ),
      width: Math.round(
        clamp(
          operation.initialFrame.width + event.clientX - operation.startX,
          POST_NOTE_MIN_WIDTH,
          maximumWidth,
        ),
      ),
    };
    operation.latestFrame = nextFrame;
    setDraftFrame(nextFrame);
  }

  function handleResizeEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const operation = resizeRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;

    const finalFrame = operation.latestFrame;
    resizeRef.current = null;
    setDraftFrame(null);
    onCommit(note.id, {
      ...framePositionPatch(finalFrame, viewport),
      height: finalFrame.height,
      width: finalFrame.width,
    });
  }

  function handleColorChange(color: PostNoteColor) {
    setIsMenuOpen(false);
    setIsColorMenuOpen(false);
    onCommit(note.id, { color });
  }

  return (
    <article
      aria-label="Nota Post"
      className="post-note-card pointer-events-auto absolute"
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerCancel={handleDragEnd}
      onPointerUp={handleDragEnd}
      style={noteStyle}
    >
      <div aria-hidden="true" className="post-note-fold" />
      <div aria-hidden="true" className="post-note-grip">
        <span />
        <span />
        <span />
      </div>

      <div className="post-note-menu-root" data-post-control="true" ref={menuRef}>
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label="Opciones de la nota"
          className="post-note-menu-trigger"
          onClick={() => {
            setIsMenuOpen((current) => !current);
            setIsColorMenuOpen(false);
          }}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={22} strokeWidth={2.2} />
        </button>

        {isMenuOpen ? (
          <div aria-label="Opciones de la nota" className="post-note-menu" role="menu">
            <button
              aria-expanded={isColorMenuOpen}
              className="post-note-menu-item"
              onClick={() => setIsColorMenuOpen((current) => !current)}
              role="menuitem"
              type="button"
            >
              <Palette aria-hidden="true" size={17} />
              <span>Color</span>
              <span aria-hidden="true" className="post-note-menu-chevron">
                ›
              </span>
            </button>

            {isColorMenuOpen ? (
              <div aria-label="Colores de la nota" className="post-note-color-options">
                {POST_NOTE_COLORS.map((color) => (
                  <button
                    aria-label={COLOR_STYLES[color].label}
                    aria-pressed={note.color === color}
                    className="post-note-color-swatch"
                    key={color}
                    onClick={() => handleColorChange(color)}
                    style={{ backgroundColor: COLOR_STYLES[color].background }}
                    title={COLOR_STYLES[color].label}
                    type="button"
                  />
                ))}
              </div>
            ) : null}

            <div className="post-note-menu-divider" />
            <button
              className="post-note-menu-item post-note-menu-delete"
              onClick={() => {
                setIsMenuOpen(false);
                onRequestDelete(note);
              }}
              role="menuitem"
              type="button"
            >
              <Trash2 aria-hidden="true" size={17} />
              <span>Eliminar</span>
            </button>
          </div>
        ) : null}
      </div>

      <textarea
        aria-label="Contenido de la nota Post"
        className="post-note-textarea"
        data-post-control="true"
        maxLength={POST_NOTE_MAX_CONTENT_LENGTH}
        onBlur={() => onCommit(note.id)}
        onChange={(event) => onChange(note.id, { content: event.target.value })}
        placeholder="Escribe una nota…"
        ref={textareaRef}
        spellCheck="true"
        value={note.content}
      />

      <button
        aria-label="Cambiar tamano de la nota"
        className="post-note-resize-handle"
        data-post-control="true"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerCancel={handleResizeEnd}
        onPointerUp={handleResizeEnd}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 18 18">
          <path d="M5 15 15 5M10 15l5-5" />
        </svg>
      </button>
    </article>
  );
}
