"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

async function requireClassificationAccess() {
  const access = await requireAdminAccess();
  if (!hasPermission(access.tenant.permissions, "inbox.channels.manage")) {
    redirect("/whapp?error=No%20tienes%20permiso%20para%20administrar%20clasificacion.");
  }
  return access;
}

export async function upsertInboxLabelAction(formData: FormData) {
  await requireClassificationAccess();
  const parsed = z.object({
    activa: z.string().optional(),
    color,
    etiquetaId: optionalUuid,
    nombre: z.string().trim().min(1).max(60),
  }).safeParse({
    activa: formData.get("activa"),
    color: formData.get("color"),
    etiquetaId: formData.get("etiquetaId"),
    nombre: formData.get("nombre"),
  });
  if (!parsed.success) redirect("/whapp/clasificacion?error=Etiqueta%20invalida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_inbox_etiqueta", {
    p_activa: parsed.data.activa !== "false",
    p_color: parsed.data.color,
    p_etiqueta_id: parsed.data.etiquetaId || null,
    p_nombre: parsed.data.nombre,
  });
  if (error) redirect(`/whapp/clasificacion?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/whapp/clasificacion");
  redirect("/whapp/clasificacion?success=Etiqueta%20guardada.");
}

export async function upsertInboxFunnelStageAction(formData: FormData) {
  await requireClassificationAccess();
  const parsed = z.object({
    color,
    etapaId: optionalUuid,
    etapaNombre: z.string().trim().min(1).max(80),
    funnelId: optionalUuid,
    funnelNombre: z.string().trim().max(80).optional(),
    posicion: z.coerce.number().int().min(0).max(999),
  }).safeParse({
    color: formData.get("color"),
    etapaId: formData.get("etapaId"),
    etapaNombre: formData.get("etapaNombre"),
    funnelId: formData.get("funnelId"),
    funnelNombre: formData.get("funnelNombre"),
    posicion: formData.get("posicion"),
  });
  if (!parsed.success || (!parsed.data.funnelId && !parsed.data.funnelNombre)) {
    redirect("/whapp/clasificacion?error=Funnel%20o%20etapa%20invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_inbox_funnel_etapa", {
    p_color: parsed.data.color,
    p_etapa_id: parsed.data.etapaId || null,
    p_etapa_nombre: parsed.data.etapaNombre,
    p_funnel_id: parsed.data.funnelId || null,
    p_funnel_nombre: parsed.data.funnelNombre || null,
    p_posicion: parsed.data.posicion,
  });
  if (error) redirect(`/whapp/clasificacion?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/whapp/clasificacion");
  redirect("/whapp/clasificacion?success=Etapa%20guardada.");
}

export async function toggleInboxFunnelStageAction(formData: FormData) {
  const access = await requireClassificationAccess();
  const parsed = z.object({
    activa: z.enum(["true", "false"]),
    etapaId: z.string().uuid(),
  }).safeParse({ activa: formData.get("activa"), etapaId: formData.get("etapaId") });
  if (!parsed.success) redirect("/whapp/clasificacion?error=Etapa%20invalida.");

  const admin = createServiceRoleClient();
  const { error } = await admin.from("inbox_funnel_etapas")
    .update({ activa: parsed.data.activa === "true" })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.etapaId);
  if (error) redirect("/whapp/clasificacion?error=No%20se%20pudo%20actualizar%20la%20etapa.");
  revalidatePath("/whapp/clasificacion");
  redirect("/whapp/clasificacion?success=Etapa%20actualizada.");
}
