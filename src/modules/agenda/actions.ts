"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import {
  agendaStatusActionSchema,
  reassignFollowupSchema,
} from "@/modules/agenda/schemas";
import type { CrmSeguimientoEstado } from "@/modules/crm/types";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function getReturnTo(formData: FormData) {
  const value = String(formData.get("returnTo") ?? "");

  return value.startsWith("/agenda") ? value : "/agenda/seguimientos";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function revalidateAgendaPaths(clienteId?: string) {
  revalidatePath("/agenda");
  revalidatePath("/agenda/seguimientos");
  revalidatePath("/crm");

  if (clienteId) {
    revalidatePath(`/crm/clientes/${clienteId}`);
  }
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
}

function logAgendaActionError(
  actionName: string,
  error: RpcError,
  context: Record<string, string>,
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

async function assertCanEditAgenda(returnTo: string) {
  const access = await requireAdminAccess();
  const canEdit =
    isModuleActive(access.tenant.activeModules, "crm") &&
    hasPermission(access.tenant.permissions, "crm.followups.edit");

  if (!canEdit) {
    redirectWithError(returnTo, "No tienes permiso para operar esta agenda.");
  }

  return access;
}

async function changeAgendaFollowupStatus(
  formData: FormData,
  estado: CrmSeguimientoEstado,
) {
  const returnTo = getReturnTo(formData);
  const parsed = agendaStatusActionSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(returnTo, "Datos de seguimiento invalidos.");
  }

  await assertCanEditAgenda(returnTo);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_crm_seguimiento", {
    p_estado: estado,
    p_seguimiento_id: parsed.data.seguimientoId,
  });

  if (error) {
    logAgendaActionError("changeAgendaFollowupStatus", error, {
      estado,
      seguimientoId: parsed.data.seguimientoId,
    });
    redirectWithError(
      returnTo,
      `No se pudo cambiar el seguimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateAgendaPaths(parsed.data.clienteId);
  redirect(returnTo);
}

export async function completeAgendaFollowupAction(formData: FormData) {
  await changeAgendaFollowupStatus(formData, "completado");
}

export async function cancelAgendaFollowupAction(formData: FormData) {
  await changeAgendaFollowupStatus(formData, "cancelado");
}

export async function reopenAgendaFollowupAction(formData: FormData) {
  await changeAgendaFollowupStatus(formData, "pendiente");
}

export async function reassignAgendaFollowupAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const parsed = reassignFollowupSchema.safeParse(getFormData(formData));
  const clienteId = String(formData.get("clienteId") ?? "") || undefined;

  if (!parsed.success) {
    redirectWithError(returnTo, "Datos de reasignacion invalidos.");
  }

  await assertCanEditAgenda(returnTo);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reasignar_crm_seguimiento", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_seguimiento_id: parsed.data.seguimientoId,
  });

  if (error) {
    logAgendaActionError("reassignAgendaFollowupAction", error, {
      seguimientoId: parsed.data.seguimientoId,
    });
    redirectWithError(
      returnTo,
      `No se pudo reasignar el seguimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateAgendaPaths(clienteId);
  redirect(returnTo);
}
