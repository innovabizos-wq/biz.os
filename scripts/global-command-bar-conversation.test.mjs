import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("global command bar cuts over to the central Brain chat", () => {
  const bar = read("src/app/(app)/dashboard/dashboard-ai-search.tsx");
  const chat = read("src/modules/brain/components/brain-chat.tsx");

  assert.match(bar, /<BrainChat variant="bar"/);
  assert.match(chat, /api:\s*"\/api\/brain\/chat"/);
  assert.match(chat, /DefaultChatTransport/);
  assert.match(chat, /prepareSendMessagesRequest/);
  assert.doesNotMatch(bar, /\/api\/ai\/conversation\/(?:execute|confirm|actions)/);
});

test("bar and Brain page share one persistent conversation", () => {
  const chat = read("src/modules/brain/components/brain-chat.tsx");
  const page = read("src/app/(app)/brain/page.tsx");

  assert.match(chat, /biz\.brain\.conversation-id/);
  assert.match(chat, /window\.localStorage\.getItem/);
  assert.match(chat, /\/api\/brain\/conversations\/\$\{conversationId\}/);
  assert.match(chat, /setMessages/);
  assert.match(chat, /message:\s*messages\[messages\.length - 1\]/);
  assert.match(page, /<BrainChat variant="page"/);
});

test("Brain chat renders streaming text and tools with AI Elements", () => {
  const chat = read("src/modules/brain/components/brain-chat.tsx");

  assert.match(chat, /components\/ai-elements\/conversation/);
  assert.match(chat, /components\/ai-elements\/message/);
  assert.match(chat, /components\/ai-elements\/tool/);
  assert.match(chat, /<MessageResponse/);
  assert.match(chat, /<BrainTool/);
  assert.match(chat, /status === "submitted"|status === "streaming"/);
});

test("tool approvals resume automatically and cannot use the old text-token flow", () => {
  const chat = read("src/modules/brain/components/brain-chat.tsx");
  const route = read("src/app/api/brain/chat/route.ts");

  assert.match(chat, /addToolApprovalResponse/);
  assert.match(chat, /lastAssistantMessageIsCompleteWithApprovalResponses/);
  assert.match(chat, /Aprobar/);
  assert.match(chat, /Denegar/);
  assert.match(route, /validateIncomingBrainApprovals/);
  assert.match(route, /syncBrainApprovals/);
  assert.doesNotMatch(chat, /confirmationToken|Responde "si"/);
});

test("Brain navigation is a first-class authorized tool", () => {
  const agent = read("src/modules/brain/runtime/brain-agent.ts");
  const chat = read("src/modules/brain/components/brain-chat.tsx");

  assert.match(agent, /biz_navigation_open/);
  assert.match(agent, /tenant\.activeModules\.includes/);
  assert.match(agent, /navigateTo/);
  assert.match(chat, /router\.push\(navigateTo\)/);
});

test("central route persists messages, runs, steps, usage and approvals", () => {
  const route = read("src/app/api/brain/chat/route.ts");
  const repository = read("src/modules/brain/runtime/conversation-repository.ts");

  for (const symbol of [
    "getOrCreateBrainConversation",
    "loadBrainMessages",
    "saveBrainMessages",
    "createBrainConversationRun",
    "recordBrainUsage",
    "syncBrainApprovals",
    "updateBrainRun",
  ]) {
    assert.match(route, new RegExp(symbol));
  }
  for (const table of [
    "brain_conversations",
    "brain_messages",
    "brain_runs",
    "brain_run_steps",
    "brain_run_events",
    "brain_approvals",
    "brain_usage_events",
  ]) {
    assert.match(repository, new RegExp(table));
  }
});

test("central Brain enforces usage limits, immutable approvals and response feedback", () => {
  const chatRoute = read("src/app/api/brain/chat/route.ts");
  const feedbackRoute = read("src/app/api/brain/feedback/route.ts");
  const repository = read("src/modules/brain/runtime/conversation-repository.ts");
  const chat = read("src/modules/brain/components/brain-chat.tsx");

  assert.match(chatRoute, /assertBrainDailyLimit/);
  assert.match(repository, /brain_usage_events/);
  assert.match(repository, /pending\.data\.tool_name !== toolName/);
  assert.match(repository, /!sameJson\(pending\.data\.request, part\.input\)/);
  assert.match(feedbackRoute, /recordBrainFeedback/);
  assert.match(repository, /brain_feedback/);
  assert.match(chat, /\/api\/brain\/feedback/);
  assert.match(chat, /ThumbsUp/);
  assert.match(chat, /ThumbsDown/);
});

test("agent selects authorized Skills dynamically instead of exact command IDs", () => {
  const agent = read("src/modules/brain/runtime/brain-agent.ts");
  const search = read("src/modules/brain/runtime/skill-search.ts");

  assert.match(agent, /businessSkillRegistry\.getAvailable/);
  assert.match(agent, /rankBusinessSkills/);
  assert.match(agent, /ToolLoopAgent/);
  assert.match(agent, /toolApproval/);
  assert.match(agent, /brainRuntime\.invoke/);
  assert.match(search, /SEMANTIC_GROUPS/);
  assert.doesNotMatch(agent, /parseLocalConversationAction|action_id/);
});

test("mutating agent tools execute through durable Workflow boundaries", () => {
  const agent = read("src/modules/brain/runtime/brain-agent.ts");
  const durableCaller = read("src/modules/brain/runtime/durable-skill-workflow.ts");
  const durableSteps = read("src/modules/brain/runtime/durable-skill-steps.ts");
  const delegatedAuth = read("src/lib/supabase/delegated-auth.ts");
  const supabaseServer = read("src/lib/supabase/server.ts");
  const workflow = [
    durableCaller,
    read("src/modules/brain/runtime/durable-skill-workflows.ts"),
    durableSteps,
  ].join("\n");
  const config = read("next.config.ts");

  assert.match(agent, /executeBusinessSkillDurably/);
  assert.match(workflow, /"use workflow"/);
  assert.match(workflow, /"use step"/);
  assert.match(workflow, /start\(brainSkillWorkflow/);
  assert.match(durableCaller, /supabase\.auth\.getSession/);
  assert.match(durableSteps, /runWithDelegatedSupabaseAccessToken/);
  assert.match(durableSteps, /getCurrentTenantContext/);
  assert.match(durableSteps, /tenant\.empresaId !== input\.invocation\.tenant\.empresaId/);
  assert.match(delegatedAuth, /AsyncLocalStorage<string>/);
  assert.match(supabaseServer, /Authorization: `Bearer \$\{delegatedToken\}`/);
  assert.match(config, /withWorkflow/);
});

test("customer conversational action remains available as a compatibility Skill", () => {
  const source = read("src/lib/ai/action-registry/registry.ts");
  const customerActionStart = source.indexOf('id: "clientes.crear_cliente"');
  const customerAction = source.slice(customerActionStart, customerActionStart + 1200);

  assert.match(customerAction, /requiresConfirmation:\s*false/);
  assert.match(customerAction, /crm\.customers\.create/);
  assert.match(customerAction, /assertNoDuplicateCustomer/);
  assert.match(customerAction, /crear_crm_cliente/);
});
