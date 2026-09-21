import "server-only";

import { start } from "workflow/api";

import { currentAccessToken } from "@/modules/brain/runtime/durable-skill-workflow";
import type { BrainTeamWorkflowInput } from "@/modules/brain/runtime/team-steps";
import { brainTeamWorkflow } from "@/modules/brain/runtime/team-workflows";

export async function startBrainTeamWorkflowDurably(
  input: Omit<BrainTeamWorkflowInput, "accessToken">,
) {
  const run = await start(brainTeamWorkflow, [{
    ...input,
    accessToken: await currentAccessToken(),
  }]);
  return run.runId;
}
