"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import {
  approveBrainRecommendation,
  runAdvancedBrainAnalysis,
} from "@/modules/brain/analyst-service";
import { executeBrainActionPlan } from "@/modules/brain/plan-executor";
import {
  brainActionPlanIdSchema,
  brainRecommendationIdSchema,
  runBrainAnalysisSchema,
} from "@/modules/brain/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(message: string): never {
  redirect(`/brain?error=${encodeURIComponent(message)}`);
}

async function assertBrainManageAccess() {
  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "brain")) {
    redirectWithError("El modulo Business Brain no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "brain.recommendations.manage",
      "brain.settings.manage",
    ])
  ) {
    redirectWithError("No tienes permiso para analizar el negocio.");
  }

  return access;
}

export async function runBrainAnalysisAction(formData: FormData) {
  const parsed = runBrainAnalysisSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("Solicitud de analisis invalida.");
  }

  const access = await assertBrainManageAccess();

  const result = await runAdvancedBrainAnalysis(access.tenant);

  if (!result.ok) {
    redirectWithError(`No se pudo analizar el negocio: ${result.error.message}`);
  }

  revalidatePath("/brain");
  revalidatePath("/dashboard/direccion");
  redirect(
    `/brain?success=${encodeURIComponent(
      `Analisis completado. Senales: ${result.data.signalsCreated ?? 0}. Insights nuevos: ${result.data.insightsCreated}. Recomendaciones nuevas: ${result.data.recommendationsCreated}.`,
    )}`,
  );
}

export async function approveBrainRecommendationAction(formData: FormData) {
  const parsed = brainRecommendationIdSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("Recomendacion invalida.");
  }

  const access = await assertBrainManageAccess();
  const result = await approveBrainRecommendation(access.tenant, parsed.data.id);

  if (!result.ok) {
    redirectWithError(result.error.message);
  }

  revalidatePath("/brain");
  redirect(`/brain?success=${encodeURIComponent("Recomendacion aprobada y plan creado.")}`);
}

export async function executeBrainActionPlanAction(formData: FormData) {
  const parsed = brainActionPlanIdSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("Plan invalido.");
  }

  const access = await assertBrainManageAccess();
  const result = await executeBrainActionPlan(access.tenant, parsed.data.id);

  if (!result.ok) {
    redirectWithError(result.error.message);
  }

  revalidatePath("/brain");
  redirect(
    `/brain?success=${encodeURIComponent(
      `Plan ejecutado. Completados: ${result.data.completed}. Pendientes de confirmacion: ${result.data.pendingConfirmation}. Fallidos: ${result.data.failed}.`,
    )}`,
  );
}
