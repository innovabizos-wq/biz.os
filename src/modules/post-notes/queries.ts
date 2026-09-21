import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  CreatePostNoteInput,
  UpdatePostNoteInput,
} from "@/modules/post-notes/schemas";
import type { PostNote, PostNoteColor } from "@/modules/post-notes/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

const MAX_NOTES_PER_SCOPE = 20;

type PostNoteRow = {
  color: PostNoteColor;
  content: string;
  created_at: string;
  height: number;
  id: string;
  last_focused_at: string;
  position_x: number;
  position_y: number;
  remind_at: string | null;
  scope_key: string;
  updated_at: string;
  width: number;
};

const POST_NOTE_COLUMNS =
  "id, scope_key, content, color, position_x, position_y, width, height, last_focused_at, remind_at, created_at, updated_at";

function mapPostNote(row: PostNoteRow): PostNote {
  return {
    color: row.color,
    content: row.content,
    createdAt: row.created_at,
    height: row.height,
    id: row.id,
    lastFocusedAt: row.last_focused_at,
    positionX: row.position_x,
    positionY: row.position_y,
    remindAt: row.remind_at,
    scopeKey: row.scope_key,
    updatedAt: row.updated_at,
    width: row.width,
  };
}

export async function listPostNotes(
  tenant: TenantContext,
  scopeKey: string,
): Promise<CoreResult<PostNote[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_post_notes")
    .select(POST_NOTE_COLUMNS)
    .eq("empresa_id", tenant.empresaId)
    .eq("profile_id", tenant.profileId)
    .eq("scope_key", scopeKey)
    .order("last_focused_at", { ascending: true })
    .returns<PostNoteRow[]>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar tus notas Post.", error);
  }

  return ok((data ?? []).map(mapPostNote));
}

export async function createPostNote(
  tenant: TenantContext,
  input: CreatePostNoteInput,
): Promise<CoreResult<PostNote>> {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("user_post_notes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", tenant.empresaId)
    .eq("profile_id", tenant.profileId)
    .eq("scope_key", input.scopeKey);

  if (countError) {
    return fail("PERMISSION_DENIED", "No se pudo crear la nota Post.", countError);
  }

  if ((count ?? 0) >= MAX_NOTES_PER_SCOPE) {
    return fail(
      "VALIDATION_ERROR",
      `Puedes tener hasta ${MAX_NOTES_PER_SCOPE} notas Post por modulo.`,
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_post_notes")
    .insert({
      color: input.color ?? "yellow",
      empresa_id: tenant.empresaId,
      height: input.height ?? 260,
      last_focused_at: now,
      position_x: input.positionX ?? 0.72,
      position_y: input.positionY ?? 0.14,
      profile_id: tenant.profileId,
      scope_key: input.scopeKey,
      width: input.width ?? 300,
    })
    .select(POST_NOTE_COLUMNS)
    .single<PostNoteRow>();

  if (error || !data) {
    return fail("PERMISSION_DENIED", "No se pudo crear la nota Post.", error);
  }

  return ok(mapPostNote(data));
}

export async function updatePostNote(
  tenant: TenantContext,
  input: UpdatePostNoteInput,
): Promise<CoreResult<PostNote>> {
  const values: Record<string, number | string> = {};

  if (input.color !== undefined) values.color = input.color;
  if (input.content !== undefined) values.content = input.content;
  if (input.height !== undefined) values.height = input.height;
  if (input.lastFocusedAt !== undefined) values.last_focused_at = input.lastFocusedAt;
  if (input.positionX !== undefined) values.position_x = input.positionX;
  if (input.positionY !== undefined) values.position_y = input.positionY;
  if (input.width !== undefined) values.width = input.width;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_post_notes")
    .update(values)
    .eq("id", input.id)
    .eq("empresa_id", tenant.empresaId)
    .eq("profile_id", tenant.profileId)
    .select(POST_NOTE_COLUMNS)
    .maybeSingle<PostNoteRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo guardar la nota Post.", error);
  }

  if (!data) {
    return fail("VALIDATION_ERROR", "La nota Post ya no existe.");
  }

  return ok(mapPostNote(data));
}

export async function deletePostNote(
  tenant: TenantContext,
  noteId: string,
): Promise<CoreResult<boolean>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_post_notes")
    .delete()
    .eq("id", noteId)
    .eq("empresa_id", tenant.empresaId)
    .eq("profile_id", tenant.profileId);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo eliminar la nota Post.", error);
  }

  return ok(true);
}
