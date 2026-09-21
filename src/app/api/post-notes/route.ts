import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  createPostNote,
  deletePostNote,
  listPostNotes,
  updatePostNote,
} from "@/modules/post-notes/queries";
import {
  createPostNoteSchema,
  deletePostNoteSchema,
  postNoteScopeSchema,
  updatePostNoteSchema,
} from "@/modules/post-notes/schemas";
import type { TenantContext } from "@/types/core";

async function requireTenant() {
  const result = await getCurrentTenantContext();

  if (!result.ok || !result.data) {
    return {
      response: NextResponse.json(
        { error: result.ok ? "Debes iniciar sesion." : result.error.message },
        { status: 401 },
      ),
      tenant: null,
    };
  }

  return { response: null, tenant: result.data satisfies TenantContext };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = await requireTenant();
  if (!auth.tenant) return auth.response;

  const scopeResult = postNoteScopeSchema.safeParse(
    new URL(request.url).searchParams.get("scopeKey"),
  );

  if (!scopeResult.success) {
    return NextResponse.json({ error: "El modulo de la nota no es valido." }, { status: 400 });
  }

  const result = await listPostNotes(auth.tenant, scopeResult.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 503 });
  }

  return NextResponse.json({ notes: result.data });
}

export async function POST(request: Request) {
  const auth = await requireTenant();
  if (!auth.tenant) return auth.response;

  const parsed = createPostNoteSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Los datos de la nota no son validos." }, { status: 400 });
  }

  const result = await createPostNote(auth.tenant, parsed.data);

  if (!result.ok) {
    const status = result.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json({ note: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireTenant();
  if (!auth.tenant) return auth.response;

  const parsed = updatePostNoteSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Los cambios de la nota no son validos." }, { status: 400 });
  }

  const result = await updatePostNote(auth.tenant, parsed.data);

  if (!result.ok) {
    const status = result.error.code === "VALIDATION_ERROR" ? 404 : 503;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json({ note: result.data });
}

export async function DELETE(request: Request) {
  const auth = await requireTenant();
  if (!auth.tenant) return auth.response;

  const parsed = deletePostNoteSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "La nota que deseas eliminar no es valida." }, { status: 400 });
  }

  const result = await deletePostNote(auth.tenant, parsed.data.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 503 });
  }

  return NextResponse.json({ deleted: true });
}
