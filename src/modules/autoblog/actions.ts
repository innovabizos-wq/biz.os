"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { generateAutoblogDraft } from "@/modules/autoblog/ai";
import {
  changeAutoblogArticleStatusSchema,
  createAutoblogArticleSchema,
  createAutoblogTopicSchema,
  generateAutoblogDraftSchema,
  updateAutoblogArticleSchema,
  updateAutoblogTopicSchema,
  deleteAutoblogArticleSchema,
  deleteAutoblogTopicSchema
} from "@/modules/autoblog/schemas";
import { getBusinessContext } from "@/modules/business-context/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import {
  canCreateAutoblog,
  canDeleteAutoblog,
  canEditAutoblog,
  canManageAutoblog,
  canPublishAutoblog,
  isAutoblogEnabled,
} from "@/modules/autoblog/queries";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedArticleRow = {
  article_id?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function clean(value: string | undefined) {
  return value ?? null;
}

function parseSourceUrls(value: string | undefined) {
  if (!value) return [];

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (!message) return "No se pudo completar la accion.";
  if (message.toLowerCase().includes("permission") || message.includes("Permiso")) {
    return "No tienes permiso para completar esta accion.";
  }

  return message;
}

function logAutoblogActionError(
  actionName: string,
  error: RpcError,
  context: Record<string, string> = {},
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function revalidateAutoblogPaths(articleId?: string) {
  revalidatePath("/autoblog");
  revalidatePath("/autoblog/nuevo");

  if (articleId) {
    revalidatePath(`/autoblog/${articleId}`);
  }
}

async function requireAutoblogEnabled(path: string) {
  const access = await requireAdminAccess();

  if (!isAutoblogEnabled(access.tenant)) {
    redirectWithError(path, "El modulo Autoblog no esta activo para esta empresa.");
  }

  return access;
}

export async function createAutoblogTopicAction(formData: FormData) {
  const parsed = createAutoblogTopicSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/autoblog/nuevo", "Revisa los datos del tema.");
  }

  const access = await requireAutoblogEnabled("/autoblog/nuevo");

  if (!canCreateAutoblog(access.tenant)) {
    redirectWithError("/autoblog/nuevo", "No tienes permiso para crear temas.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_autoblog_topic", {
    p_description: clean(parsed.data.description),
    p_source_mode: parsed.data.sourceMode,
    p_source_urls: parseSourceUrls(parsed.data.sourceUrlsText),
    p_title: parsed.data.title,
  });

  if (error) {
    logAutoblogActionError("createAutoblogTopicAction", error);
    redirectWithError(
      "/autoblog/nuevo",
      `No se pudo crear el tema: ${safeErrorMessage(error)}`,
    );
  }

  revalidateAutoblogPaths();
  redirectWithSuccess("/autoblog/nuevo", "Tema guardado.");
}

export async function createAutoblogArticleAction(formData: FormData) {
  const parsed = createAutoblogArticleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/autoblog/nuevo", "Revisa los datos del articulo.");
  }

  const access = await requireAutoblogEnabled("/autoblog/nuevo");

  if (!canCreateAutoblog(access.tenant)) {
    redirectWithError("/autoblog/nuevo", "No tienes permiso para crear articulos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_autoblog_article", {
    p_content: parsed.data.content ?? "",
    p_cta: clean(parsed.data.cta),
    p_keywords: clean(parsed.data.keywords),
    p_seo_description: clean(parsed.data.seoDescription),
    p_seo_title: clean(parsed.data.seoTitle),
    p_social_facebook: clean(parsed.data.socialFacebook),
    p_social_instagram: clean(parsed.data.socialInstagram),
    p_social_linkedin: clean(parsed.data.socialLinkedin),
    p_social_whatsapp: clean(parsed.data.socialWhatsapp),
    p_source_mode: parsed.data.sourceMode,
    p_source_notes: clean(parsed.data.sourceNotes),
    p_source_urls: parseSourceUrls(parsed.data.sourceUrlsText),
    p_summary: clean(parsed.data.summary),
    p_title: parsed.data.title,
    p_topic: clean(parsed.data.topic),
  });

  if (error) {
    logAutoblogActionError("createAutoblogArticleAction", error, {
      title: parsed.data.title,
    });
    redirectWithError(
      "/autoblog/nuevo",
      `No se pudo crear el articulo: ${safeErrorMessage(error)}`,
    );
  }

  const articleId = (data as CreatedArticleRow[] | null)?.[0]?.article_id;

  revalidateAutoblogPaths(articleId);
  redirectWithSuccess(
    articleId ? `/autoblog/${articleId}` : "/autoblog",
    "Borrador de articulo creado.",
  );
}

export async function updateAutoblogArticleAction(formData: FormData) {
  const parsed = updateAutoblogArticleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/autoblog", "Revisa los datos del articulo.");
  }

  const articlePath = `/autoblog/${parsed.data.articleId}`;
  const access = await requireAutoblogEnabled(articlePath);

  if (!canEditAutoblog(access.tenant)) {
    redirectWithError(articlePath, "No tienes permiso para editar articulos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_autoblog_article", {
    p_article_id: parsed.data.articleId,
    p_content: parsed.data.content ?? "",
    p_cta: clean(parsed.data.cta),
    p_keywords: clean(parsed.data.keywords),
    p_seo_description: clean(parsed.data.seoDescription),
    p_seo_title: clean(parsed.data.seoTitle),
    p_social_facebook: clean(parsed.data.socialFacebook),
    p_social_instagram: clean(parsed.data.socialInstagram),
    p_social_linkedin: clean(parsed.data.socialLinkedin),
    p_social_whatsapp: clean(parsed.data.socialWhatsapp),
    p_source_mode: parsed.data.sourceMode,
    p_source_notes: clean(parsed.data.sourceNotes),
    p_source_urls: parseSourceUrls(parsed.data.sourceUrlsText),
    p_summary: clean(parsed.data.summary),
    p_title: parsed.data.title,
    p_topic: clean(parsed.data.topic),
  });

  if (error) {
    logAutoblogActionError("updateAutoblogArticleAction", error, {
      articleId: parsed.data.articleId,
    });
    redirectWithError(
      articlePath,
      `No se pudo guardar el articulo: ${safeErrorMessage(error)}`,
    );
  }

  revalidateAutoblogPaths(parsed.data.articleId);
  redirectWithSuccess(articlePath, "Articulo guardado.");
}

export async function changeAutoblogArticleStatusAction(formData: FormData) {
  const parsed = changeAutoblogArticleStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/autoblog", "Estado de articulo invalido.");
  }

  const articlePath = `/autoblog/${parsed.data.articleId}`;
  const access = await requireAutoblogEnabled(articlePath);
  const needsPublishPermission =
    parsed.data.status === "approved" ||
    parsed.data.status === "ready_to_publish";
  const canChange = needsPublishPermission
    ? canPublishAutoblog(access.tenant)
    : parsed.data.status === "archived"
      ? canManageAutoblog(access.tenant)
      : canEditAutoblog(access.tenant);

  if (!canChange) {
    redirectWithError(articlePath, "No tienes permiso para cambiar este estado.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_autoblog_article", {
    p_article_id: parsed.data.articleId,
    p_status: parsed.data.status,
  });

  if (error) {
    logAutoblogActionError("changeAutoblogArticleStatusAction", error, {
      articleId: parsed.data.articleId,
      status: parsed.data.status,
    });
    redirectWithError(
      articlePath,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateAutoblogPaths(parsed.data.articleId);
  redirectWithSuccess(articlePath, "Estado actualizado.");
}

export async function generateAutoblogDraftAction(formData: FormData) {
  const parsed = generateAutoblogDraftSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/autoblog/nuevo", "Agrega un tema para generar el borrador.");
  }

  const access = await requireAutoblogEnabled("/autoblog/nuevo");

  if (!canCreateAutoblog(access.tenant)) {
    redirectWithError("/autoblog/nuevo", "No tienes permiso para generar borradores.");
  }

  const context = await getBusinessContext(access.tenant);
  const draft = await generateAutoblogDraft({
    businessContext: context.ok ? context.data : null,
    sourceNotes: parsed.data.sourceNotes,
    sourceUrls: parseSourceUrls(parsed.data.sourceUrlsText),
    topic: parsed.data.topic,
  });
  const fallbackCta = context.ok ? context.data?.preferredCta ?? null : null;

  if (!draft.ok) {
    redirectWithError("/autoblog/nuevo", draft.message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_autoblog_article", {
    p_content: draft.data.content,
    p_cta: clean(draft.data.cta ?? fallbackCta ?? undefined),
    p_keywords: clean(draft.data.keywords ?? undefined),
    p_seo_description: clean(draft.data.seoDescription ?? undefined),
    p_seo_title: clean(draft.data.seoTitle ?? undefined),
    p_social_facebook: clean(draft.data.socialFacebook ?? undefined),
    p_social_instagram: clean(draft.data.socialInstagram ?? undefined),
    p_social_linkedin: clean(draft.data.socialLinkedin ?? undefined),
    p_social_whatsapp: clean(draft.data.socialWhatsapp ?? undefined),
    p_source_mode: parsed.data.sourceMode,
    p_source_notes: clean(parsed.data.sourceNotes),
    p_source_urls: parseSourceUrls(parsed.data.sourceUrlsText),
    p_summary: clean(draft.data.summary ?? undefined),
    p_title: draft.data.title,
    p_topic: clean(parsed.data.topic),
  });

  if (error) {
    logAutoblogActionError("generateAutoblogDraftAction", error, {
      topic: parsed.data.topic,
    });
    redirectWithError(
      "/autoblog/nuevo",
      `No se pudo guardar el borrador generado: ${safeErrorMessage(error)}`,
    );
  }

  const articleId = (data as CreatedArticleRow[] | null)?.[0]?.article_id;

  revalidateAutoblogPaths(articleId);
  redirectWithSuccess(
    articleId ? `/autoblog/${articleId}` : "/autoblog",
    "Borrador generado con IA.",
  );
}
export async function deleteAutoblogArticleAction(formData: FormData) {
  const parsed = deleteAutoblogArticleSchema.safeParse(getFormData(formData));
  if (!parsed.success) {
    redirectWithError("/autoblog", "ID de articulo invalido.");
  }
  const access = await requireAutoblogEnabled("/autoblog");
  if (!canDeleteAutoblog(access.tenant)) {
    redirectWithError("/autoblog", "No tienes permiso para eliminar articulos.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_autoblog_article", {
    p_article_id: parsed.data.articleId,
  });
  if (error) {
    logAutoblogActionError("deleteAutoblogArticleAction", error, {
      articleId: parsed.data.articleId,
    });
    redirectWithError(
      "/autoblog",
      `No se pudo eliminar el articulo: ${safeErrorMessage(error)}`,
    );
  }
  revalidateAutoblogPaths(parsed.data.articleId);
  redirectWithSuccess("/autoblog", "Articulo eliminado.");
}

export async function deleteAutoblogTopicAction(formData: FormData) {
  const parsed = deleteAutoblogTopicSchema.safeParse(getFormData(formData));
  if (!parsed.success) {
    redirectWithError("/autoblog/nuevo", "ID de tema invalido.");
  }
  const access = await requireAutoblogEnabled("/autoblog/nuevo");
  if (!canDeleteAutoblog(access.tenant)) {
    redirectWithError("/autoblog/nuevo", "No tienes permiso para eliminar temas.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_autoblog_topic", {
    p_topic_id: parsed.data.topicId,
  });
  if (error) {
    logAutoblogActionError("deleteAutoblogTopicAction", error, {
      topicId: parsed.data.topicId,
    });
    redirectWithError(
      "/autoblog/nuevo",
      `No se pudo eliminar el tema: ${safeErrorMessage(error)}`,
    );
  }
  revalidateAutoblogPaths();
  redirectWithSuccess("/autoblog/nuevo", "Tema eliminado.");
}





export async function updateAutoblogTopicAction(formData: FormData) {
  const parsed = updateAutoblogTopicSchema.safeParse(getFormData(formData));
  if (!parsed.success) {
    redirectWithError("/autoblog/nuevo", "Datos del tema invalidos.");
  }
  const access = await requireAutoblogEnabled("/autoblog/nuevo");
  if (!canDeleteAutoblog(access.tenant)) { // TODO: should be canManageAutoblog or canEditAutoblog? We'll use manage for now.
    redirectWithError("/autoblog/nuevo", "No tienes permiso para actualizar temas.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_autoblog_topic", {
    p_topic_id: parsed.data.topicId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_source_mode: parsed.data.sourceMode,
    p_source_urls: parseSourceUrls(parsed.data.sourceUrlsText),
  });
  if (error) {
    logAutoblogActionError("updateAutoblogTopicAction", error, {
      topicId: parsed.data.topicId,
    });
    redirectWithError(
      "/autoblog/nuevo",
      `No se pudo actualizar el tema: ${safeErrorMessage(error)}`,
    );
  }
  revalidateAutoblogPaths();
  redirectWithSuccess("/autoblog/nuevo", "Tema actualizado.");
}
