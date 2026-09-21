import { getCurrentTenantContext } from "../../../lib/auth/session";
import { runWithDelegatedSupabaseAccessToken } from "../../../lib/supabase/delegated-auth";

import { brainRuntime, brainWorkflowEngine } from "./default-runtime";
import type {
  DurableCatalogWorkflowInput,
  DurableSkillWorkflowInput,
} from "./durable-skill-workflows";

async function authenticatedTenant(accessToken: string) {
  return runWithDelegatedSupabaseAccessToken(accessToken, async () => {
    const tenant = await getCurrentTenantContext();
    if (!tenant.ok || !tenant.data) {
      throw new Error(
        tenant.ok ? "La sesión delegada no tiene empresa activa." : tenant.error.message,
      );
    }
    return tenant.data;
  });
}

export async function executeBrainSkillStep(input: DurableSkillWorkflowInput) {
  "use step";
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await authenticatedTenant(input.accessToken);
    if (
      tenant.empresaId !== input.invocation.tenant.empresaId ||
      tenant.profileId !== input.invocation.tenant.profileId
    ) {
      throw new Error("La identidad de la ejecución durable no coincide con el run de Brain.");
    }
    return brainRuntime.invoke({ ...input.invocation, tenant });
  });
}

export async function executeBrainCatalogWorkflowStep(
  input: { accessToken: string; workflow: DurableCatalogWorkflowInput },
) {
  "use step";
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await authenticatedTenant(input.accessToken);
    if (
      tenant.empresaId !== input.workflow.tenant.empresaId ||
      tenant.profileId !== input.workflow.tenant.profileId
    ) {
      throw new Error("La identidad del workflow no coincide con el plan de Brain.");
    }
    return brainWorkflowEngine.execute({ ...input.workflow, tenant });
  });
}
