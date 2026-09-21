import "server-only";

import { createBrainRuntime } from "@/modules/brain/runtime/brain-runtime";
import { createBusinessSkillExecutor } from "@/modules/brain/runtime/business-skill-executor";
import { createBusinessSkillRegistry } from "@/modules/brain/runtime/business-skill-registry";
import {
  initialBusinessIntents,
  initialCapabilities,
} from "@/modules/brain/runtime/capability-catalog";
import { createCapabilityRegistry } from "@/modules/brain/runtime/capability-registry";
import { createContextBuilder } from "@/modules/brain/runtime/context-builder";
import { createBusinessIntentRegistry } from "@/modules/brain/runtime/intent-registry";
import { createBusinessIntentResolver } from "@/modules/brain/runtime/intent-resolver";
import {
  initialBrainTaskSuccessMetrics,
  initialBrainWorkflows,
} from "@/modules/brain/runtime/orchestration-catalog";
import { createInitialReadBusinessSkills } from "@/modules/brain/runtime/skills/read-skills";
import { createInventoryPurchasesAgentBusinessSkills } from "@/modules/brain/runtime/skills/inventory-purchases-agent-skills";
import { createRemainingAgentBusinessSkills } from "@/modules/brain/runtime/skills/remaining-agent-skills";
import { createSalesCrmAgentBusinessSkills } from "@/modules/brain/runtime/skills/sales-crm-agent-skills";
import { createLegacyConversationBusinessSkills } from "@/modules/brain/runtime/skills/legacy-action-skills";
import { createBrainKnowledgeSkills } from "@/modules/brain/runtime/skills/knowledge-skills";
import { brainSkillExecutionStore } from "@/modules/brain/runtime/skill-execution-store";
import { createBrainWorkflowEngine } from "@/modules/brain/runtime/workflow-engine";

const initialReadSkills = createInitialReadBusinessSkills();
const inventoryPurchasesAgentSkills = createInventoryPurchasesAgentBusinessSkills();
const remainingAgentSkills = createRemainingAgentBusinessSkills();
const salesCrmAgentSkills = createSalesCrmAgentBusinessSkills();

export const businessIntentRegistry = createBusinessIntentRegistry(
  initialBusinessIntents,
);

export const capabilityRegistry = createCapabilityRegistry(initialCapabilities);

export const contextBuilder = createContextBuilder();

export const businessIntentResolver = createBusinessIntentResolver(
  businessIntentRegistry,
);

export const businessSkillRegistry = createBusinessSkillRegistry(
  [
    ...initialReadSkills,
    ...inventoryPurchasesAgentSkills,
    ...remainingAgentSkills,
    ...salesCrmAgentSkills,
    ...createBrainKnowledgeSkills(),
    ...createLegacyConversationBusinessSkills(
      initialReadSkills.flatMap((skill) =>
        skill.legacyActionId ? [skill.legacyActionId] : [],
      ),
    ),
  ],
);

export const businessSkillExecutor = createBusinessSkillExecutor(
  businessSkillRegistry,
  undefined,
  undefined,
  brainSkillExecutionStore,
);

export const brainRuntime = createBrainRuntime(businessSkillExecutor);

export const brainWorkflowEngine = createBrainWorkflowEngine({
  capabilities: capabilityRegistry,
  metrics: initialBrainTaskSuccessMetrics,
  runtime: brainRuntime,
  skills: businessSkillRegistry,
  workflows: initialBrainWorkflows,
});
