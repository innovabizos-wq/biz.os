import "server-only";

import { start } from "workflow/api";

import { createClient } from "@/lib/supabase/server";
import type {
  BusinessSkillInvocation,
} from "./contracts";
import type {
  DurableCatalogWorkflowInput,
  DurableSkillWorkflowInput,
} from "./durable-skill-workflows";
import {
  brainCatalogWorkflow,
  brainSkillWorkflow,
} from "./durable-skill-workflows";

export async function currentAccessToken() {
  const supabase = await createClient();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (session.error || !accessToken) {
    throw new Error("La sesión expiró antes de iniciar la ejecución durable.");
  }
  return accessToken;
}

export async function executeBusinessSkillDurably(invocation: BusinessSkillInvocation) {
  const workflowInput: DurableSkillWorkflowInput = {
    accessToken: await currentAccessToken(),
    invocation,
  };
  const run = await start(brainSkillWorkflow, [workflowInput]);
  return {
    result: await run.returnValue,
    workflowRunId: run.runId,
  };
}

export async function executeBrainCatalogWorkflowDurably(
  input: DurableCatalogWorkflowInput,
) {
  const run = await start(brainCatalogWorkflow, [{
    accessToken: await currentAccessToken(),
    workflow: input,
  }]);
  return { result: await run.returnValue, workflowRunId: run.runId };
}
