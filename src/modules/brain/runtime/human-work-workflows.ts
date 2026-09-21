import { createHook, getWorkflowMetadata } from "workflow";

import type { HumanWorkItemWorkflowInput } from "./human-work-steps";
import {
  attachHumanWorkItemWorkflowStep,
  createHumanWorkItemStep,
} from "./human-work-steps";
import type { JsonRecord } from "../../../types/core";

export async function brainHumanWorkItemWorkflow(input: HumanWorkItemWorkflowInput) {
  "use workflow";
  const hookToken = `brain-work-item:${input.workItem.id}`;
  await createHumanWorkItemStep(input, hookToken);
  const metadata = getWorkflowMetadata();
  await attachHumanWorkItemWorkflowStep(input, metadata.workflowRunId);
  const response = await createHook<{
    comment?: string;
    result?: JsonRecord;
    status: "completed" | "needs_changes";
  }>({ token: hookToken });
  return response;
}
