export const POST_NOTE_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
] as const;

export type PostNoteColor = (typeof POST_NOTE_COLORS)[number];

export type PostNote = {
  color: PostNoteColor;
  content: string;
  createdAt: string;
  height: number;
  id: string;
  lastFocusedAt: string;
  positionX: number;
  positionY: number;
  remindAt: string | null;
  scopeKey: string;
  updatedAt: string;
  width: number;
};

export type PostNotePatch = Partial<
  Pick<
    PostNote,
    | "color"
    | "content"
    | "height"
    | "lastFocusedAt"
    | "positionX"
    | "positionY"
    | "width"
  >
>;
