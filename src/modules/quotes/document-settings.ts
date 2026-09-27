"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import {
  DEFAULT_QUOTE_DOCUMENT_SETTINGS,
  QUOTE_DOCUMENT_ACCENT_COLORS,
  QUOTE_DOCUMENT_LABELS,
  QUOTE_DOCUMENT_TEMPLATES,
  type QuoteDocumentSettings,
} from "@/modules/quotes/quote-document-style";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

const settingsSchema = z.object({
  accentColor: z.enum(QUOTE_DOCUMENT_ACCENT_COLORS.map((color) => color.value) as [string, ...string[]]),
  documentLabel: z.enum(QUOTE_DOCUMENT_LABELS),
  footerText: z.string().trim().max(300).optional(),
  removeLogo: z.enum(["true"]).optional(),
  templateCode: z.enum(QUOTE_DOCUMENT_TEMPLATES.map((template) => template.code) as [string, ...string[]]),
});

type QuoteDocumentSettingsRow = {
  accent_color: QuoteDocumentSettings["accentColor"];
  document_label: QuoteDocumentSettings["documentLabel"];
  footer_text: string | null;
  logo_data_url: string | null;
  template_code: QuoteDocumentSettings["templateCode"];
};

export type QuoteDocumentSettingsActionState = {
  error: string | null;
  success: string | null;
};

function asSettings(row: QuoteDocumentSettingsRow | null): QuoteDocumentSettings {
  if (!row) return DEFAULT_QUOTE_DOCUMENT_SETTINGS;
  return {
    accentColor: row.accent_color,
    documentLabel: row.document_label,
    footerText: row.footer_text,
    logoDataUrl: row.logo_data_url,
    templateCode: row.template_code,
  };
}

export async function getQuoteDocumentSettings(tenant: Awaited<ReturnType<typeof requireAdminAccess>>["tenant"]) {
  if (!hasPermission(tenant.permissions, "quotes.view")) return DEFAULT_QUOTE_DOCUMENT_SETTINGS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_quote_document_settings")
    .select("template_code, document_label, accent_color, logo_data_url, footer_text")
    .eq("empresa_id", tenant.empresaId)
    .maybeSingle<QuoteDocumentSettingsRow>();
  return asSettings(data ?? null);
}

async function fileToDataUrl(file: File) {
  if (!file.size) return null;
  if (file.size > 500_000) throw new Error("El logo debe pesar menos de 500 KB.");
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error("Usa un logo PNG, JPG o WebP.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

export async function saveQuoteDocumentSettingsAction(
  _previous: QuoteDocumentSettingsActionState,
  formData: FormData,
): Promise<QuoteDocumentSettingsActionState> {
  const access = await requireAdminAccess();
  if (!hasPermission(access.tenant.permissions, "admin.settings.manage")) {
    return { error: "No tienes permiso para cambiar el diseño de cotizaciones.", success: null };
  }
  const parsed = settingsSchema.safeParse({
    accentColor: formData.get("accentColor"),
    documentLabel: formData.get("documentLabel"),
    footerText: formData.get("footerText"),
    removeLogo: formData.get("removeLogo") ?? undefined,
    templateCode: formData.get("templateCode"),
  });
  if (!parsed.success || !parsed.data) return { error: "Revisa los datos del diseño.", success: null };
  const settings = parsed.data;

  const logo = formData.get("logo");
  let logoDataUrl: string | null | undefined;
  try {
    logoDataUrl = logo instanceof File ? await fileToDataUrl(logo) : null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer el logo.", success: null };
  }

  const payload = {
    accent_color: settings.accentColor,
    document_label: settings.documentLabel,
    empresa_id: access.tenant.empresaId,
    footer_text: settings.footerText || null,
    ...(settings.removeLogo ? { logo_data_url: null } : logoDataUrl ? { logo_data_url: logoDataUrl } : {}),
    template_code: settings.templateCode,
    updated_by: access.profile.id,
  };
  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("company_quote_document_settings")
    .upsert(payload, { onConflict: "empresa_id" })
    .select("empresa_id, template_code")
    .maybeSingle<{
      empresa_id: string;
      template_code: QuoteDocumentSettings["templateCode"];
    }>();
  if (error || !saved || saved.empresa_id !== access.tenant.empresaId) {
    return { error: "No se pudo guardar la plantilla. Intenta nuevamente o revisa los permisos de administración.", success: null };
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/ajustes");
  return { error: null, success: "Diseño de cotizaciones guardado." };
}
