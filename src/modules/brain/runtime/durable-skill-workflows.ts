import type {
  BrainSourceContext,
  BrainWorkflowId,
  BusinessSkillInvocation,
} from "./contracts";
import {
  executeBrainCatalogWorkflowStep,
  executeBrainSkillStep,
} from "./durable-skill-steps";
import type { JsonRecord, TenantContext } from "../../../types/core";

export type DurableCatalogWorkflowInput = {
  approvals?: Record<string, boolean>;
  id?: string;
  idempotencyPrefix?: string;
  inputsByStep?: Record<string, JsonRecord>;
  source: BrainSourceContext;
  tenant: TenantContext;
  workflowId: BrainWorkflowId;
};

export type DurableSkillWorkflowInput = {
  accessToken: string;
  invocation: BusinessSkillInvocation;
};

type DurableCatalogWorkflowEnvelope = {
  accessToken: string;
  workflow: DurableCatalogWorkflowInput;
};

export async function brainSkillWorkflow(input: DurableSkillWorkflowInput) {
  "use workflow";
  return executeBrainSkillStep(input);
}

export async function brainCatalogWorkflow(input: DurableCatalogWorkflowEnvelope) {
  "use workflow";
  return executeBrainCatalogWorkflowStep(input);
}
