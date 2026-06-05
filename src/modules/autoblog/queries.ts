import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type {
  AutoblogArticle,
  AutoblogSourceMode,
  AutoblogStatus,
  AutoblogTopic,
  AutoblogTopicStatus,
} from "@/modules/autoblog/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type AutoblogArticleRow = {
  approved_at: string | null;
  approved_by: string | null;
  content: string;
  created_at: string;
  created_by: string | null;
  cta: string | null;
  id: string;
  keywords: string | null;
  ready_to_publish_at: string | null;
  scheduled_for: string | null;
  seo_description: string | null;
  seo_title: string | null;
  slug: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  social_whatsapp: string | null;
  source_mode: AutoblogSourceMode;
  source_notes: string | null;
  source_urls: unknown;
  status: AutoblogStatus;
  summary: string | null;
  title: string;
  topic: string | null;
  updated_at: string;
  updated_by: string | null;
};

type AutoblogTopicRow = {
  created_at: string;
  created_by: string | null;
  description: string | null;
  id: string;
  relevance_score: number | null;
  source_mode: AutoblogSourceMode;
  source_urls: unknown;
  status: AutoblogTopicStatus;
  title: string;
};

function sourceUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function mapArticle(row: AutoblogArticleRow): AutoblogArticle {
  return {
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    content: row.content,
    createdAt: row.created_at,
    createdBy: row.created_by,
    cta: row.cta,
    id: row.id,
    keywords: row.keywords,
    readyToPublishAt: row.ready_to_publish_at,
    scheduledFor: row.scheduled_for,
    seoDescription: row.seo_description,
    seoTitle: row.seo_title,
    slug: row.slug,
    socialFacebook: row.social_facebook,
    socialInstagram: row.social_instagram,
    socialLinkedin: row.social_linkedin,
    socialWhatsapp: row.social_whatsapp,
    sourceMode: row.source_mode,
    sourceNotes: row.source_notes,
    sourceUrls: sourceUrls(row.source_urls),
    status: row.status,
    summary: row.summary,
    title: row.title,
    topic: row.topic,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapTopic(row: AutoblogTopicRow): AutoblogTopic {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    id: row.id,
    relevanceScore: row.relevance_score,
    sourceMode: row.source_mode,
    sourceUrls: sourceUrls(row.source_urls),
    status: row.status,
    title: row.title,
  };
}

export function isAutoblogEnabled(tenant: TenantContext) {
  return isModuleActive(tenant.activeModules, "autoblog");
}

export function canViewAutoblog(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "autoblog.view",
    "autoblog.manage",
  ]);
}

export function canCreateAutoblog(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "autoblog.create",
    "autoblog.manage",
  ]);
}

export function canEditAutoblog(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "autoblog.edit",
    "autoblog.manage",
  ]);
}

export function canPublishAutoblog(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "autoblog.publish",
    "autoblog.manage",
  ]);
}

export function canManageAutoblog(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, ["autoblog.manage"]);
}

export async function getAutoblogArticles(
  tenant: TenantContext,
  status?: AutoblogStatus | null,
  limit = 50,
): Promise<CoreResult<AutoblogArticle[]>> {
  if (!isAutoblogEnabled(tenant)) {
    return fail("MODULE_INACTIVE", "El modulo Autoblog no esta activo.");
  }

  if (!canViewAutoblog(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver Autoblog.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_autoblog_articles", {
    p_limit: limit,
    p_status: status ?? null,
  });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar articulos.", error);
  }

  return ok(((data ?? []) as AutoblogArticleRow[]).map(mapArticle));
}

export async function getAutoblogArticle(
  tenant: TenantContext,
  articleId: string,
): Promise<CoreResult<AutoblogArticle | null>> {
  if (!isAutoblogEnabled(tenant)) {
    return fail("MODULE_INACTIVE", "El modulo Autoblog no esta activo.");
  }

  if (!canViewAutoblog(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver Autoblog.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_autoblog_article", {
    p_article_id: articleId,
  });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo cargar el articulo.", error);
  }

  const row = ((data ?? []) as AutoblogArticleRow[])[0];

  return ok(row ? mapArticle(row) : null);
}

export async function getAutoblogTopics(
  tenant: TenantContext,
  status?: AutoblogTopicStatus | null,
  limit = 50,
): Promise<CoreResult<AutoblogTopic[]>> {
  if (!isAutoblogEnabled(tenant)) {
    return fail("MODULE_INACTIVE", "El modulo Autoblog no esta activo.");
  }

  if (!canViewAutoblog(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver Autoblog.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_autoblog_topics", {
    p_limit: limit,
    p_status: status ?? null,
  });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar temas.", error);
  }

  return ok(((data ?? []) as AutoblogTopicRow[]).map(mapTopic));
}
