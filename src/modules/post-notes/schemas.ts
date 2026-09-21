import { z } from "zod";

import { POST_NOTE_COLORS } from "@/modules/post-notes/types";

export const POST_NOTE_MIN_WIDTH = 220;
export const POST_NOTE_MAX_WIDTH = 560;
export const POST_NOTE_MIN_HEIGHT = 180;
export const POST_NOTE_MAX_HEIGHT = 560;
export const POST_NOTE_MAX_CONTENT_LENGTH = 4_000;

export const postNoteScopeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "El modulo de la nota no es valido.");

export const postNoteColorSchema = z.enum(POST_NOTE_COLORS);

const positionSchema = z.number().finite().min(0).max(1);
const widthSchema = z
  .number()
  .int()
  .min(POST_NOTE_MIN_WIDTH)
  .max(POST_NOTE_MAX_WIDTH);
const heightSchema = z
  .number()
  .int()
  .min(POST_NOTE_MIN_HEIGHT)
  .max(POST_NOTE_MAX_HEIGHT);

export const createPostNoteSchema = z.object({
  color: postNoteColorSchema.optional(),
  height: heightSchema.optional(),
  positionX: positionSchema.optional(),
  positionY: positionSchema.optional(),
  scopeKey: postNoteScopeSchema,
  width: widthSchema.optional(),
});

export const updatePostNoteSchema = z
  .object({
    color: postNoteColorSchema.optional(),
    content: z.string().max(POST_NOTE_MAX_CONTENT_LENGTH).optional(),
    height: heightSchema.optional(),
    id: z.string().uuid(),
    lastFocusedAt: z.string().datetime({ offset: true }).optional(),
    positionX: positionSchema.optional(),
    positionY: positionSchema.optional(),
    width: widthSchema.optional(),
  })
  .refine(
    (input) =>
      Object.entries(input).some(
        ([key, value]) => key !== "id" && value !== undefined,
      ),
    { message: "No hay cambios para guardar." },
  );

export const deletePostNoteSchema = z.object({
  id: z.string().uuid(),
});

export type CreatePostNoteInput = z.infer<typeof createPostNoteSchema>;
export type UpdatePostNoteInput = z.infer<typeof updatePostNoteSchema>;
