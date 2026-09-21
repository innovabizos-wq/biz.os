import "server-only";

import type { BrainAgentId } from "@/modules/brain/runtime/contracts";
import { planBrainTeam } from "@/modules/brain/runtime/supervisor";
import {
  attachBrainTeamWorkflow,
  createBrainTeamRecords,
  getBrainTeamRun,
} from "@/modules/brain/runtime/team-repository";
import { startBrainTeamWorkflowDurably } from "@/modules/brain/runtime/team-workflow";
import type { TenantContext } from "@/types/core";

export async function startBrainTeam(input: {
  idempotencyKey?: string;
  maxConcurrency?: number;
  objective: string;
  parentRunId?: string | null;
  requestedAgents?: BrainAgentId[];
  tenant: TenantContext;
}) {
  const plan = planBrainTeam(input);
  const records = await createBrainTeamRecords({
    idempotencyKey: input.idempotencyKey,
    parentRunId: input.parentRunId,
    plan,
    tenant: input.tenant,
  });
  if (records.cached) return { ...records, plan };
  const workflowRunId = await startBrainTeamWorkflowDurably({
    plan,
    runId: records.runId,
    teamRunId: records.teamRunId,
    tenant: input.tenant,
  });
  await attachBrainTeamWorkflow({
    runId: records.runId,
    tenant: input.tenant,
    workflowRunId,
  });
  return {
    ...records,
    plan,
    status: "running",
    workflowRunId,
  };
}

export { getBrainTeamRun };
