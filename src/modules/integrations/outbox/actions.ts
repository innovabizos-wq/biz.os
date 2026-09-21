"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

const jobIdSchema = z.string().uuid();

export async function retryIntegrationOutboxJobAction(formData: FormData) {
  const parsed = jobIdSchema.safeParse(formData.get("jobId"));
  if (!parsed.success) throw new Error("La tarea de integracion no es valida.");

  const access = await requireAdminAccess();
  if (!hasAnyPermission(access.tenant.permissions, [
    "admin.settings.manage",
    "billing.config.manage",
    "billing.fiscal.manage",
  ])) {
    throw new Error("No tienes permiso para reintentar integraciones.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retry_integration_outbox_job", {
    p_job_id: parsed.data,
  });
  if (error || data !== true) {
    throw new Error(error?.message ?? "La tarea ya no esta disponible para reintentar.");
  }
  revalidatePath("/admin/conexiones");
}
