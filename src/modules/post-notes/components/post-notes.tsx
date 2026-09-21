"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { DeletePostNoteDialog } from "@/modules/post-notes/components/delete-post-note-dialog";
import {
  PostNoteCard,
  type PostViewport,
} from "@/modules/post-notes/components/post-note";
import {
  POST_NOTE_MIN_HEIGHT,
  POST_NOTE_MIN_WIDTH,
} from "@/modules/post-notes/schemas";
import type { PostNote, PostNotePatch } from "@/modules/post-notes/types";

const AUTOSAVE_DELAY_MS = 650;
const DEFAULT_NOTE_WIDTH = 300;
const DEFAULT_NOTE_HEIGHT = 260;

type NotesResponse = { notes: PostNote[] };
type NoteResponse = { note: PostNote };
type ApiErrorResponse = { error?: string };

function subscribeToHydration() {
  return () => undefined;
}

function getScopeKey(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "inicio";
  const normalized = firstSegment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "inicio";
}

async function getResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function PostNoteIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 28 28">
      <path d="M6.2 3.8h15.6a2.4 2.4 0 0 1 2.4 2.4v11.5L16 25H6.2a2.4 2.4 0 0 1-2.4-2.4V6.2a2.4 2.4 0 0 1 2.4-2.4Z" />
      <path d="M16 25v-5a2.3 2.3 0 0 1 2.3-2.3h5.9M9 10h10M9 14h7" />
      <path className="post-note-icon-plus" d="M9 19h4m-2-2v4" />
    </svg>
  );
}

export function PostNotes() {
  const pathname = usePathname();
  const scopeKey = useMemo(() => getScopeKey(pathname), [pathname]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PostNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<PostNote[]>([]);
  const [viewport, setViewport] = useState<PostViewport>({ height: 800, width: 1280 });
  const pendingPatchesRef = useRef(new Map<string, PostNotePatch>());
  const saveTimersRef = useRef(new Map<string, number>());
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  const flushNote = useCallback(async (noteId: string, keepalive = false) => {
    const patch = pendingPatchesRef.current.get(noteId);
    if (!patch || Object.keys(patch).length === 0) return;

    const timerId = saveTimersRef.current.get(noteId);
    if (timerId !== undefined) window.clearTimeout(timerId);
    saveTimersRef.current.delete(noteId);
    pendingPatchesRef.current.delete(noteId);

    try {
      const response = await fetch("/api/post-notes", {
        body: JSON.stringify({ id: noteId, ...patch }),
        headers: { "Content-Type": "application/json" },
        keepalive,
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "No se pudo guardar la nota Post."));
      }
    } catch (cause) {
      const newerPatch = pendingPatchesRef.current.get(noteId) ?? {};
      pendingPatchesRef.current.set(noteId, { ...patch, ...newerPatch });
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la nota Post.");
    }
  }, []);

  const flushAllNotes = useCallback(
    (keepalive = false) => {
      for (const noteId of pendingPatchesRef.current.keys()) {
        void flushNote(noteId, keepalive);
      }
    },
    [flushNote],
  );

  useEffect(() => {
    function syncViewport() {
      setViewport({ height: window.innerHeight, width: window.innerWidth });
    }

    function handlePageHide() {
      flushAllNotes(true);
    }

    const animationFrameId = window.requestAnimationFrame(syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      flushAllNotes(true);
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushAllNotes]);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    flushAllNotes(true);

    async function loadNotes() {
      setIsLoading(true);
      setError(null);
      setNotes([]);
      setActiveNoteId(null);
      setNewNoteId(null);

      try {
        const response = await fetch(
          `/api/post-notes?scopeKey=${encodeURIComponent(scopeKey)}`,
          { cache: "no-store", signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(await getResponseError(response, "No se pudieron cargar tus notas Post."));
        }

        const payload = (await response.json()) as NotesResponse;
        if (isCurrent) setNotes(payload.notes);
      } catch (cause) {
        if (isCurrent && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(
            cause instanceof Error ? cause.message : "No se pudieron cargar tus notas Post.",
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadNotes();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [flushAllNotes, scopeKey]);

  useEffect(() => {
    const saveTimers = saveTimersRef.current;

    return () => {
      for (const timerId of saveTimers.values()) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  function applyPatch(noteId: string, patch: PostNotePatch) {
    setNotes((current) =>
      current.map((note) => (note.id === noteId ? { ...note, ...patch } : note)),
    );
    pendingPatchesRef.current.set(noteId, {
      ...(pendingPatchesRef.current.get(noteId) ?? {}),
      ...patch,
    });
  }

  function schedulePatch(noteId: string, patch: PostNotePatch) {
    applyPatch(noteId, patch);

    const currentTimer = saveTimersRef.current.get(noteId);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);

    const timerId = window.setTimeout(() => {
      void flushNote(noteId);
    }, AUTOSAVE_DELAY_MS);
    saveTimersRef.current.set(noteId, timerId);
  }

  function commitPatch(noteId: string, patch?: PostNotePatch) {
    if (patch) applyPatch(noteId, patch);
    void flushNote(noteId);
  }

  async function handleCreateNote() {
    if (isCreating || isLoading) return;

    setIsCreating(true);
    setError(null);

    const width = Math.max(
      POST_NOTE_MIN_WIDTH,
      Math.min(DEFAULT_NOTE_WIDTH, viewport.width - 24),
    );
    const height = Math.max(
      POST_NOTE_MIN_HEIGHT,
      Math.min(DEFAULT_NOTE_HEIGHT, viewport.height - 24),
    );
    const availableX = Math.max(0, viewport.width - width);
    const availableY = Math.max(0, viewport.height - height);
    const offset = (notes.length % 5) * 24;
    const left = Math.max(0, Math.min(availableX, viewport.width - width - 54 - offset));
    const top = Math.max(0, Math.min(availableY, 104 + offset));

    try {
      const response = await fetch("/api/post-notes", {
        body: JSON.stringify({
          height,
          positionX: availableX === 0 ? 0 : left / availableX,
          positionY: availableY === 0 ? 0 : top / availableY,
          scopeKey,
          width,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "No se pudo crear la nota Post."));
      }

      const payload = (await response.json()) as NoteResponse;
      setNotes((current) => [...current, payload.note]);
      setActiveNoteId(payload.note.id);
      setNewNoteId(payload.note.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la nota Post.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteNote() {
    if (!deleteCandidate || isDeleting) return;

    const noteId = deleteCandidate.id;
    setIsDeleting(true);
    setError(null);

    const timerId = saveTimersRef.current.get(noteId);
    if (timerId !== undefined) window.clearTimeout(timerId);
    saveTimersRef.current.delete(noteId);
    pendingPatchesRef.current.delete(noteId);

    try {
      const response = await fetch("/api/post-notes", {
        body: JSON.stringify({ id: noteId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "No se pudo eliminar la nota Post."));
      }

      setNotes((current) => current.filter((note) => note.id !== noteId));
      setDeleteCandidate(null);
      setActiveNoteId((current) => (current === noteId ? null : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la nota Post.");
    } finally {
      setIsDeleting(false);
    }
  }

  const handleCancelDelete = useCallback(() => {
    if (!isDeleting) setDeleteCandidate(null);
  }, [isDeleting]);

  const portal = isMounted
    ? createPortal(
        <>
          <div className="post-notes-layer" aria-live="polite">
            {notes.map((note, index) => (
              <PostNoteCard
                autoFocus={newNoteId === note.id}
                key={note.id}
                note={note}
                onChange={schedulePatch}
                onCommit={commitPatch}
                onFocus={(noteId) => {
                  setActiveNoteId(noteId);
                  setNewNoteId(null);
                }}
                onRequestDelete={setDeleteCandidate}
                viewport={viewport}
                zIndex={activeNoteId === note.id ? 80 : index + 1}
              />
            ))}
          </div>

          {error ? (
            <div className="post-note-error" role="status">
              <span>{error}</span>
              <button aria-label="Cerrar aviso" onClick={() => setError(null)} type="button">
                ×
              </button>
            </div>
          ) : null}

          {deleteCandidate ? (
            <DeletePostNoteDialog
              isDeleting={isDeleting}
              onCancel={handleCancelDelete}
              onConfirm={() => void handleDeleteNote()}
            />
          ) : null}
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="post-note-launcher-root">
        <button
          aria-label={`Crear nota Post en ${scopeKey}`}
          className="post-note-launcher"
          disabled={isCreating || isLoading}
          onClick={() => void handleCreateNote()}
          title="Nueva nota Post"
          type="button"
        >
          <PostNoteIcon />
        </button>
        {notes.length > 0 ? (
          <span aria-hidden="true" className="post-note-count">
            {notes.length > 9 ? "9+" : notes.length}
          </span>
        ) : null}
      </div>
      {portal}
    </>
  );
}
