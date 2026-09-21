import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export {};" };
    }

    if (specifier.startsWith("@/")) {
      const base = path.join(root, "src", specifier.slice(2));
      const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
      const resolved = candidates.find((candidate) => existsSync(candidate));
      if (!resolved) throw new Error(`Cannot resolve test alias: ${specifier}`);

      return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }

    return nextResolve(specifier, context);
  },
});

const {
  initialBrainAgents,
  initialBrainAutomationJobs,
  initialBrainTaskSuccessMetrics,
  initialBrainWorkflows,
} = await import(new URL("../src/modules/brain/runtime/orchestration-catalog.ts", import.meta.url));
const {
  initialCapabilities,
  initialBusinessIntents,
} = await import(new URL("../src/modules/brain/runtime/capability-catalog.ts", import.meta.url));
const { createCapabilityRegistry } = await import(
  new URL("../src/modules/brain/runtime/capability-registry.ts", import.meta.url)
);
const { createBusinessIntentRegistry } = await import(
  new URL("../src/modules/brain/runtime/intent-registry.ts", import.meta.url)
);
const { createBrainWorkflowEngine } = await import(
  new URL("../src/modules/brain/runtime/workflow-engine.ts", import.meta.url)
);
const { resolveBrainWorkflowIntent } = await import(
  new URL("../src/modules/brain/workflow-intent.ts", import.meta.url)
);
const { createBusinessSkillRegistry } = await import(
  new URL("../src/modules/brain/runtime/business-skill-registry.ts", import.meta.url)
);
const { defineBusinessSkill } = await import(
  new URL("../src/modules/brain/runtime/contracts.ts", import.meta.url)
);
const { z } = await import("zod");
const { ok } = await import(new URL("../src/types/core.ts", import.meta.url));

function tenant(overrides = {}) {
  return {
    activeModules: [
      "brain",
      "crm",
      "quotes",
      "sales",
      "payments",
      "dispatch",
      "inventory",
      "catalog",
      "purchases",
      "whapp",
      "autoblog",
      "hr",
    ],
    empresaId: "empresa-1",
    permissions: [
      "crm.customers.view",
      "crm.followups.create",
      "quotes.view",
      "quotes.create",
      "quotes.status.change",
      "sales.orders.view",
      "sales.orders.create",
      "payments.accounts.view",
      "dispatch.orders.create",
      "inventory.stock.view",
      "catalog.products.view",
      "purchases.orders.view",
      "inbox.conversations.view",
      "inbox.conversations.reply",
      "autoblog.view",
      "brain.insights.view",
      "hr.timesheets.view",
    ],
    planCode: "enterprise",
    profileId: "profile-1",
    sucursalId: "sucursal-1",
    ...overrides,
  };
}

function skill(id, options = {}) {
  return defineBusinessSkill({
    description: `Skill ${id}`,
    enabled: true,
    id,
    idempotency: options.idempotency ?? "none",
    inputSchema: options.inputSchema ?? z.record(z.string(), z.unknown()),
    kind: options.kind ?? "command",
    module: options.module ?? "brain",
    name: `Skill ${id}`,
    outputSchema: z.record(z.string(), z.unknown()),
    requiredPermissions: options.requiredPermissions ?? ["brain.insights.view"],
    requiresConfirmation: options.requiresConfirmation ?? false,
    risk: options.risk ?? "low",
    version: "1.0.0",
    async execute(input) {
      return ok({
        data: { input, ok: true },
        message: `Executed ${id}`,
      });
    },
  });
}

function workflowTestEngine(runtime) {
  const skills = createBusinessSkillRegistry([
    skill("quotes.draft.create", {
      module: "quotes",
      requiredPermissions: ["quotes.create"],
    }),
    skill("quotes.sale.confirm", {
      idempotency: "required",
      module: "quotes",
      requiredPermissions: ["quotes.status.change"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("sales.receivable.generate", {
      idempotency: "required",
      module: "sales",
      requiredPermissions: ["sales.orders.create", "payments.accounts.view"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("sales.dispatch.prepare", {
      idempotency: "required",
      module: "sales",
      requiredPermissions: ["dispatch.orders.create", "sales.orders.view"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("crm.followup.create", {
      idempotency: "required",
      module: "crm",
      requiredPermissions: ["crm.followups.create"],
      requiresConfirmation: true,
      risk: "medium",
    }),
  ]);

  return createBrainWorkflowEngine({
    capabilities: createCapabilityRegistry(initialCapabilities),
    metrics: initialBrainTaskSuccessMetrics,
    runtime,
    skills,
    workflows: initialBrainWorkflows,
  });
}

test("Etapa 4 declares the requested specialized agents", () => {
  const expected = [
    "rrhh",
    "marketing",
    "logistica",
    "inventario",
    "finanzas",
    "operaciones",
    "contenido",
    "soporte",
    "compras",
    "ventas",
  ];
  const ids = initialBrainAgents.map((agent) => agent.id).sort();

  assert.deepEqual(ids, expected.sort());

  for (const agent of initialBrainAgents) {
    assert.ok(agent.name.length > 3, agent.id);
    assert.ok(agent.description.length > 20, agent.id);
    assert.ok(agent.capabilityIds.length >= 50, agent.id);
    assert.ok(agent.requiredPermissions.length > 0, agent.id);
  }
});

test("Etapa 4 expands every agent with at least 50 domain capabilities", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);

  for (const agent of initialBrainAgents) {
    const expandedCapabilities = agent.capabilityIds.filter((capabilityId) =>
      capabilityId.startsWith(`agent.${agent.id}.`),
    );

    assert.ok(
      expandedCapabilities.length >= 50,
      `${agent.id} must have at least 50 expanded capabilities`,
    );

    for (const capabilityId of expandedCapabilities) {
      const capability = capabilityRegistry.get(capabilityId);
      assert.ok(capability, `${agent.id}:${capabilityId}`);
      assert.equal(capability.status, "implemented", capabilityId);
      assert.ok(
        capabilityRegistry.getImplementedBinding(capabilityId),
        `${capabilityId} must have an executable Skill binding`,
      );
    }
  }
});

test("Ventas y CRM package implements 50 executable agent Skills", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const salesAgent = initialBrainAgents.find((agent) => agent.id === "ventas");
  const skillSource = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/sales-crm-agent-skills.ts"),
    "utf8",
  );
  const defaultRuntime = readFileSync(
    path.join(root, "src/modules/brain/runtime/default-runtime.ts"),
    "utf8",
  );

  assert.ok(salesAgent);
  const expandedCapabilities = salesAgent.capabilityIds.filter((capabilityId) =>
    capabilityId.startsWith("agent.ventas."),
  );
  assert.equal(expandedCapabilities.length, 50);

  for (const capabilityId of expandedCapabilities) {
    const binding = capabilityRegistry.getImplementedBinding(capabilityId);

    assert.ok(binding, capabilityId);
    assert.equal(binding.skillId, `${capabilityId}.skill.v1`);
  }

  assert.match(skillSource, /createSalesCrmAgentBusinessSkills/);
  assert.match(skillSource, /defineBusinessSkill/);
  assert.match(skillSource, /getCrmCustomers/);
  assert.match(skillSource, /getQuotes/);
  assert.match(skillSource, /getSales/);
  assert.match(skillSource, /getTodayFollowups/);
  assert.match(defaultRuntime, /createSalesCrmAgentBusinessSkills/);
  assert.match(defaultRuntime, /\.\.\.salesCrmAgentSkills/);
});

test("Inventario y Compras package implements 100 executable agent Skills", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const skillSource = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/inventory-purchases-agent-skills.ts"),
    "utf8",
  );
  const defaultRuntime = readFileSync(
    path.join(root, "src/modules/brain/runtime/default-runtime.ts"),
    "utf8",
  );

  for (const agentId of ["inventario", "compras"]) {
    const agent = initialBrainAgents.find((item) => item.id === agentId);

    assert.ok(agent);
    const expandedCapabilities = agent.capabilityIds.filter((capabilityId) =>
      capabilityId.startsWith(`agent.${agentId}.`),
    );
    assert.equal(expandedCapabilities.length, 50);

    for (const capabilityId of expandedCapabilities) {
      const binding = capabilityRegistry.getImplementedBinding(capabilityId);

      assert.ok(binding, capabilityId);
      assert.equal(binding.skillId, `${capabilityId}.skill.v1`);
    }
  }

  assert.match(skillSource, /createInventoryPurchasesAgentBusinessSkills/);
  assert.match(skillSource, /defineBusinessSkill/);
  assert.match(skillSource, /getInventoryStock/);
  assert.match(skillSource, /getInventoryMovements/);
  assert.match(skillSource, /getPurchaseOrders/);
  assert.match(skillSource, /getPurchaseOrderItems/);
  assert.match(defaultRuntime, /createInventoryPurchasesAgentBusinessSkills/);
  assert.match(defaultRuntime, /\.\.\.inventoryPurchasesAgentSkills/);
});

test("Remaining value packages implement 350 executable agent Skills", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const skillSource = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/remaining-agent-skills.ts"),
    "utf8",
  );
  const defaultRuntime = readFileSync(
    path.join(root, "src/modules/brain/runtime/default-runtime.ts"),
    "utf8",
  );
  const expectedAgents = [
    "finanzas",
    "logistica",
    "soporte",
    "operaciones",
    "marketing",
    "contenido",
    "rrhh",
  ];

  for (const agentId of expectedAgents) {
    const agent = initialBrainAgents.find((item) => item.id === agentId);
    const expectedCapabilityCount = agentId === "marketing" ? 100 : 50;

    assert.ok(agent);
    const expandedCapabilities = agent.capabilityIds.filter((capabilityId) =>
      capabilityId.startsWith(`agent.${agentId}.`),
    );
    assert.equal(expandedCapabilities.length, expectedCapabilityCount);

    for (const capabilityId of expandedCapabilities) {
      const binding = capabilityRegistry.getImplementedBinding(capabilityId);

      assert.ok(binding, capabilityId);
      assert.equal(binding.skillId, `${capabilityId}.skill.v1`);
    }
  }

  assert.match(skillSource, /createRemainingAgentBusinessSkills/);
  assert.match(skillSource, /getPaymentAccounts/);
  assert.match(skillSource, /getDispatchOrders/);
  assert.match(skillSource, /getInboxConversations/);
  assert.match(skillSource, /getBrainSignals/);
  assert.match(skillSource, /getAutoblogArticles/);
  assert.match(skillSource, /getAccessibleUsersForCurrentTenant/);
  assert.match(defaultRuntime, /createRemainingAgentBusinessSkills/);
  assert.match(defaultRuntime, /\.\.\.remainingAgentSkills/);
});

test("Marketing is the responsible agent for Autoblog article intelligence", () => {
  const marketingAgent = initialBrainAgents.find((item) => item.id === "marketing");
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);

  assert.ok(marketingAgent);
  assert.equal(marketingAgent.module, "autoblog");
  assert.match(marketingAgent.description, /Responsable de Autoblog/);
  assert.ok(marketingAgent.capabilityIds.includes("autoblog.article.generate"));
  assert.ok(marketingAgent.capabilityIds.includes("autoblog.article.validate"));
  assert.ok(marketingAgent.capabilityIds.includes("autoblog.output.normalize"));

  const autoblogMarketingCapabilities = marketingAgent.capabilityIds.filter((capabilityId) =>
    capabilityId.startsWith("agent.marketing.article-") ||
    capabilityId.startsWith("agent.marketing.headlines.") ||
    capabilityId.startsWith("agent.marketing.seo-optimization.") ||
    capabilityId.startsWith("agent.marketing.editorial-") ||
    capabilityId.startsWith("agent.marketing.content-") ||
    capabilityId.startsWith("agent.marketing.publishing-"),
  );

  assert.equal(autoblogMarketingCapabilities.length, 50);

  for (const capabilityId of autoblogMarketingCapabilities) {
    const capability = capabilityRegistry.get(capabilityId);

    assert.ok(capability, capabilityId);
    assert.equal(capability.module, "autoblog");
    assert.equal(capability.status, "implemented");
    assert.ok(capabilityRegistry.getImplementedBinding(capabilityId), capabilityId);
  }
});

test("Etapa 4 workflows compose capabilities instead of monolithic Skills", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const quoteToDispatch = initialBrainWorkflows.find(
    (workflow) => workflow.id === "commercial.quote_to_dispatch",
  );

  assert.ok(quoteToDispatch);
  assert.deepEqual(
    quoteToDispatch.steps.map((step) => step.capabilityId),
    [
      "quotes.draft.create",
      "quotes.sale.confirm",
      "sales.receivable.generate",
      "sales.dispatch.prepare",
      "crm.followup.create",
    ],
  );
  assert.ok(
    quoteToDispatch.steps.some((step) => step.requiresApproval),
    "Workflow must expose approval gates",
  );

  for (const workflow of initialBrainWorkflows) {
    assert.ok(workflow.successMetricId, workflow.id);
    assert.ok(workflow.agentIds.length > 0, workflow.id);
    assert.ok(workflow.steps.length > 0, workflow.id);

    for (const step of workflow.steps) {
      const capability = capabilityRegistry.get(step.capabilityId);
      assert.ok(capability, `${workflow.id}:${step.capabilityId}`);
      if (step.status === "ready" || step.status === "approval_required") {
        assert.equal(
          capability.status,
          "implemented",
          `${step.capabilityId} cannot be ready unless implemented`,
        );
      }
    }
  }
});

test("Etapa 4 followup capability has an executable Intent and Skill contract", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const capability = capabilityRegistry.get("crm.followup.create");
  const intent = intentRegistry.get("crm.followup.create");

  assert.ok(capability);
  assert.equal(capability.status, "implemented");
  assert.equal(
    capabilityRegistry.getImplementedBinding("crm.followup.create")?.skillId,
    "crm.followup.create",
  );
  assert.ok(intent);
  assert.deepEqual(
    intent.requiredSlots.map((slot) => slot.name),
    ["title"],
  );
  assert.ok(
    intent.optionalSlots.some((slot) => slot.name === "quoteReference"),
  );
});

test("Etapa 4 automation jobs cover the requested operational scans", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const expected = [
    "collections.overdue.scan",
    "inventory.low_stock.scan",
    "quotes.expired.scan",
    "conversations.sla.overdue.scan",
  ];

  assert.deepEqual(
    initialBrainAutomationJobs.map((job) => job.id).sort(),
    expected.sort(),
  );

  for (const job of initialBrainAutomationJobs) {
    assert.ok(capabilityRegistry.get(job.capabilityId), job.id);
    assert.ok(
      ["draft", "query"].includes(capabilityRegistry.get(job.capabilityId).kind),
      job.id,
    );
    assert.notEqual(job.schedule, "manual", `${job.id} must be schedulable`);
  }
});

test("Etapa 4 measures success by completed business tasks", () => {
  const metricIds = new Set(
    initialBrainTaskSuccessMetrics.map((metric) => metric.id),
  );

  for (const workflow of initialBrainWorkflows) {
    assert.ok(metricIds.has(workflow.successMetricId), workflow.id);
  }

  for (const metric of initialBrainTaskSuccessMetrics) {
    assert.equal(metric.measures, "task_completed", metric.id);
    assert.doesNotMatch(metric.id, /response|message|chat/i);
  }
});

test("Brain Workflow Engine prepares approval gates without executing Skills", () => {
  const engine = workflowTestEngine();
  const plan = engine.prepare({
    tenant: tenant(),
    workflowId: "commercial.quote_to_dispatch",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.data.inputsReady, true);
  assert.equal(plan.data.status, "pending_approval");
  assert.equal(plan.data.steps.find((step) => step.id === "create_quote").status, "ready");
  assert.equal(
    plan.data.steps.find((step) => step.id === "confirm_sale").status,
    "pending_approval",
  );
  assert.equal(
    plan.data.steps.find((step) => step.id === "create_followup").status,
    "pending_approval",
  );
  assert.ok(plan.data.auditEvents.length >= plan.data.steps.length);
  assert.equal(plan.data.metrics[0].measure, "task_pending_approval");
});

test("Brain Workflow Engine marks workflow input gaps before execution", () => {
  const skills = createBusinessSkillRegistry([
    skill("quotes.draft.create", {
      inputSchema: z.object({
        customerQuery: z.string().min(1),
        items: z.array(z.unknown()).min(1),
      }),
      module: "quotes",
      requiredPermissions: ["quotes.create"],
    }),
    skill("quotes.sale.confirm", {
      idempotency: "required",
      module: "quotes",
      requiredPermissions: ["quotes.status.change"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("sales.receivable.generate", {
      idempotency: "required",
      module: "sales",
      requiredPermissions: ["sales.orders.create", "payments.accounts.view"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("sales.dispatch.prepare", {
      idempotency: "required",
      module: "sales",
      requiredPermissions: ["dispatch.orders.create", "sales.orders.view"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("crm.followup.create", {
      idempotency: "required",
      module: "crm",
      requiredPermissions: ["crm.followups.create"],
      requiresConfirmation: true,
      risk: "medium",
    }),
  ]);
  const engine = createBrainWorkflowEngine({
    capabilities: createCapabilityRegistry(initialCapabilities),
    metrics: initialBrainTaskSuccessMetrics,
    skills,
    workflows: initialBrainWorkflows,
  });

  const missingInputPlan = engine.prepare({
    tenant: tenant(),
    workflowId: "commercial.quote_to_dispatch",
  });
  const readyInputPlan = engine.prepare({
    inputsByStep: {
      create_quote: {
        customerQuery: "Prueba Brain",
        items: [{ quantity: 1, search: "Lentes" }],
      },
    },
    tenant: tenant(),
    workflowId: "commercial.quote_to_dispatch",
  });

  assert.equal(missingInputPlan.ok, true);
  assert.equal(missingInputPlan.data.inputsReady, false);
  assert.equal(
    missingInputPlan.data.steps.find((step) => step.id === "create_quote").status,
    "planned",
  );
  assert.match(
    missingInputPlan.data.steps.find((step) => step.id === "create_quote").reason,
    /customerQuery|items/,
  );
  assert.equal(readyInputPlan.ok, true);
  assert.equal(
    readyInputPlan.data.steps.find((step) => step.id === "create_quote").status,
    "ready",
  );
});

test("Brain Workflow Engine executes only approved executable steps through Brain Runtime", async () => {
  const invocations = [];
  const runtime = {
    async invoke(invocation) {
      invocations.push(invocation);
      return ok({
        cached: false,
        data: { ok: true },
        durationMs: 1,
        evidence: [],
        executedAt: new Date().toISOString(),
        invocationId: `invocation-${invocations.length}`,
        links: [],
        message: `Executed ${invocation.skillId}`,
        skillId: invocation.skillId,
      });
    },
  };
  const engine = workflowTestEngine(runtime);
  const result = await engine.execute({
    approvals: {
      confirm_sale: true,
      create_followup: true,
      generate_receivable: true,
      prepare_dispatch: true,
    },
    id: "workflow-run-1",
    idempotencyPrefix: "stage4-test",
    inputsByStep: {
      confirm_sale: { quoteReference: "COT-1" },
      create_quote: { customerQuery: "Juan", items: [] },
      generate_receivable: { saleReference: "VEN-1" },
      prepare_dispatch: { saleReference: "VEN-1" },
      create_followup: { customerQuery: "Juan", title: "Llamar despues de venta" },
    },
    tenant: tenant(),
    workflowId: "commercial.quote_to_dispatch",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.completedSteps, 5);
  assert.equal(result.data.pendingApprovalSteps, 0);
  assert.equal(invocations.length, 5);
  assert.deepEqual(
    invocations.map((item) => item.skillId),
    [
      "quotes.draft.create",
      "quotes.sale.confirm",
      "sales.receivable.generate",
      "sales.dispatch.prepare",
      "crm.followup.create",
    ],
  );
  assert.ok(
    invocations
      .filter((item) => item.skillId !== "quotes.draft.create")
      .every((item) => item.approval?.confirmed === true),
  );
  assert.ok(
    result.data.auditEvents.some((event) => event.status === "completed"),
  );
});

test("Brain Workflow Engine propagates step outputs into downstream inputs", async () => {
  const invocations = [];
  const skills = createBusinessSkillRegistry([
    skill("quotes.draft.create", {
      inputSchema: z.object({
        items: z.array(z.unknown()).min(1),
      }),
      module: "quotes",
      requiredPermissions: ["quotes.create"],
    }),
    skill("quotes.sale.confirm", {
      idempotency: "required",
      inputSchema: z.object({ quoteReference: z.string().min(1) }),
      module: "quotes",
      requiredPermissions: ["quotes.status.change"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("sales.receivable.generate", {
      idempotency: "required",
      inputSchema: z.object({ saleReference: z.string().min(1) }),
      module: "sales",
      requiredPermissions: ["sales.orders.create", "payments.accounts.view"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("sales.dispatch.prepare", {
      idempotency: "required",
      inputSchema: z.object({ saleReference: z.string().min(1) }),
      module: "sales",
      requiredPermissions: ["dispatch.orders.create", "sales.orders.view"],
      requiresConfirmation: true,
      risk: "high",
    }),
    skill("crm.followup.create", {
      idempotency: "required",
      inputSchema: z.object({
        saleReference: z.string().min(1),
        title: z.string().min(1),
      }),
      module: "crm",
      requiredPermissions: ["crm.followups.create"],
      requiresConfirmation: true,
      risk: "medium",
    }),
  ]);
  const runtime = {
    async invoke(invocation) {
      invocations.push(invocation);
      const dataBySkill = {
        "quotes.draft.create": { quoteId: "quote-1", quoteNumber: "COT-1" },
        "quotes.sale.confirm": { saleId: "sale-1", saleNumber: "VEN-1" },
        "sales.receivable.generate": { accountId: "account-1" },
        "sales.dispatch.prepare": { dispatchId: "dispatch-1" },
        "crm.followup.create": { followupId: "followup-1" },
      };

      return ok({
        cached: false,
        data: dataBySkill[invocation.skillId] ?? {},
        durationMs: 1,
        evidence: [],
        executedAt: new Date().toISOString(),
        invocationId: `invocation-${invocations.length}`,
        links: [],
        message: `Executed ${invocation.skillId}`,
        skillId: invocation.skillId,
      });
    },
  };
  const engine = createBrainWorkflowEngine({
    capabilities: createCapabilityRegistry(initialCapabilities),
    metrics: initialBrainTaskSuccessMetrics,
    runtime,
    skills,
    workflows: initialBrainWorkflows,
  });

  const result = await engine.execute({
    approvals: {
      confirm_sale: true,
      create_followup: true,
      generate_receivable: true,
      prepare_dispatch: true,
    },
    inputsByStep: {
      create_quote: { items: [{ description: "Lentes" }] },
    },
    tenant: tenant(),
    workflowId: "commercial.quote_to_dispatch",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.completedSteps, 5);
  assert.equal(result.data.inputsByStep.confirm_sale.quoteReference, "COT-1");
  assert.equal(result.data.inputsByStep.generate_receivable.saleReference, "VEN-1");
  assert.equal(result.data.inputsByStep.prepare_dispatch.saleReference, "VEN-1");
  assert.equal(result.data.inputsByStep.create_followup.saleReference, "VEN-1");
  assert.equal(result.data.inputsByStep.create_followup.title, "Seguimiento despues del workflow comercial");
});

test("Brain Workflow Engine does not execute approval steps without approval", async () => {
  const invocations = [];
  const runtime = {
    async invoke(invocation) {
      invocations.push(invocation);
      return ok({
        cached: false,
        data: { ok: true },
        durationMs: 1,
        evidence: [],
        executedAt: new Date().toISOString(),
        invocationId: `invocation-${invocations.length}`,
        links: [],
        message: `Executed ${invocation.skillId}`,
        skillId: invocation.skillId,
      });
    },
  };
  const engine = workflowTestEngine(runtime);
  const result = await engine.execute({
    id: "workflow-run-2",
    inputsByStep: {
      create_quote: { customerQuery: "Juan", items: [] },
    },
    tenant: tenant(),
    workflowId: "commercial.quote_to_dispatch",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.completedSteps, 1);
  assert.equal(result.data.pendingApprovalSteps, 4);
  assert.deepEqual(
    invocations.map((item) => item.skillId),
    ["quotes.draft.create"],
  );
  assert.equal(result.data.metrics[0].measure, "task_pending_approval");
});

test("Brain Workflow Engine blocks workflow steps unavailable by tenant policy", () => {
  const engine = workflowTestEngine();
  const plan = engine.prepare({
    tenant: tenant({
      activeModules: ["brain", "crm", "quotes"],
      permissions: ["quotes.create"],
    }),
    workflowId: "commercial.quote_to_dispatch",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.data.status, "blocked");
  assert.equal(
    plan.data.steps.find((step) => step.id === "confirm_sale").status,
    "blocked",
  );
  assert.match(
    plan.data.steps.find((step) => step.id === "confirm_sale").reason,
    /modulo activo o permisos/,
  );
});

test("Etapa 4 exposes workflow APIs and audits every workflow event", () => {
  const workflowsRoute = readFileSync(
    path.join(root, "src/app/api/brain/workflows/route.ts"),
    "utf8",
  );
  const executeRoute = readFileSync(
    path.join(root, "src/app/api/brain/workflows/execute/route.ts"),
    "utf8",
  );
  const service = readFileSync(
    path.join(root, "src/modules/brain/workflow-service.ts"),
    "utf8",
  );
  const actionCatalog = readFileSync(
    path.join(root, "src/app/api/ai/conversation/actions/route.ts"),
    "utf8",
  );

  assert.match(workflowsRoute, /listBrainWorkflowCatalog/);
  assert.match(workflowsRoute, /prepareBrainWorkflow/);
  assert.match(executeRoute, /executeBrainWorkflow/);
  assert.match(service, /inputsByStep: input\.inputsByStep/);
  assert.match(service, /auditoria_eventos/);
  assert.match(service, /persistWorkflowActionPlan/);
  assert.match(service, /brain_action_plans/);
  assert.match(service, /brain_plan_steps/);
  assert.match(service, /onConflict: "id,empresa_id"/);
  assert.match(service, /onConflict: "empresa_id,plan_id,step_order"/);
  assert.match(service, /stepId: step\.id/);
  assert.match(service, /plan\.inputsReady\) return "approved"/);
  assert.match(service, /brain\.workflow\.\$\{mode\}\.\$\{event\.status\}/);
  assert.match(actionCatalog, /workflows: initialBrainWorkflows/);
  assert.match(actionCatalog, /agents: initialBrainAgents/);
  assert.match(actionCatalog, /automationJobs: initialBrainAutomationJobs/);
  assert.match(actionCatalog, /taskSuccessMetrics: initialBrainTaskSuccessMetrics/);
});

test("Etapa 4 exposes specialized agents as tenant-aware runtime summaries", () => {
  const service = readFileSync(
    path.join(root, "src/modules/brain/agent-service.ts"),
    "utf8",
  );
  const route = readFileSync(
    path.join(root, "src/app/api/brain/agents/route.ts"),
    "utf8",
  );

  assert.match(service, /listBrainAgentsForTenant/);
  assert.match(service, /businessSkillRegistry\.getAvailable\(tenant\)/);
  assert.match(service, /executableCapabilityCount/);
  assert.match(service, /plannedCapabilityCount/);
  assert.match(service, /No disponible por permisos, plan o modulo activo/);
  assert.match(route, /getCurrentTenantContext/);
  assert.match(route, /agents: listBrainAgentsForTenant/);
});

test("Etapa 4 exposes task success metrics from Brain audit events", () => {
  const service = readFileSync(
    path.join(root, "src/modules/brain/metrics-service.ts"),
    "utf8",
  );
  const route = readFileSync(
    path.join(root, "src/app/api/brain/metrics/route.ts"),
    "utf8",
  );
  const migration = readFileSync(
    path.join(root, "database/migrations/0066_brain_audit_metrics_rls.sql"),
    "utf8",
  );

  assert.match(service, /auditoria_eventos/);
  assert.match(service, /brain_action_plan/);
  assert.match(service, /brain_workflow/);
  assert.match(service, /brain_automation_job/);
  assert.match(service, /conversation_action/);
  assert.match(service, /task_completed/);
  assert.match(service, /task_failed/);
  assert.match(service, /task_pending_approval/);
  assert.doesNotMatch(service, /response_generated|message_generated/);
  assert.match(route, /getCurrentTenantContext/);
  assert.match(route, /getBrainTaskMetrics/);
  assert.match(migration, /brain\.insights\.view/);
  assert.doesNotMatch(migration, /delete from|truncate|drop table/i);
});

test("Etapa 4 exposes executable automation job service with audit and metrics", () => {
  const service = readFileSync(
    path.join(root, "src/modules/brain/automation-service.ts"),
    "utf8",
  );
  const jobsRoute = readFileSync(
    path.join(root, "src/app/api/brain/jobs/route.ts"),
    "utf8",
  );
  const cronRoute = readFileSync(
    path.join(root, "src/app/api/brain/jobs/run/route.ts"),
    "utf8",
  );
  const skills = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/read-skills.ts"),
    "utf8",
  );

  assert.match(service, /executeBrainAutomationJob/);
  assert.match(service, /executeBrainAutomationJobsForSystem/);
  assert.match(service, /getSystemAutomationTenants/);
  assert.match(service, /createServiceRoleClient/);
  assert.match(service, /brainRuntime\.invoke/);
  assert.match(service, /auditoria_eventos/);
  assert.match(service, /task_completed/);
  assert.match(service, /payments_accounts/);
  assert.match(service, /inventario_stock/);
  assert.match(service, /cotizaciones/);
  assert.match(service, /inbox_conversaciones/);
  assert.match(jobsRoute, /listBrainAutomationJobs/);
  assert.match(jobsRoute, /executeBrainAutomationJob/);
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /executeBrainAutomationJobsForSystem/);
  assert.doesNotMatch(cronRoute, /getCurrentTenantContext/);
  assert.match(skills, /id:\s*"quotes\.expired\.query"/);
  assert.match(skills, /id:\s*"inbox\.sla\.overdue\.query"/);
});

test("Etapa 4 routes natural workflow requests to approvable Brain plans", () => {
  const quoteToDispatch = resolveBrainWorkflowIntent(
    "Prepara un plan para crear cotizacion, confirmar venta, generar CxC y preparar despacho de la cotizacion COT-100",
  );
  const saleConfirmation = resolveBrainWorkflowIntent(
    "Convierte la cotizacion COT-200 en venta y cuenta por cobrar",
  );
  const bridge = readFileSync(
    path.join(root, "src/modules/ai/conversation-execution-bridge.ts"),
    "utf8",
  );

  assert.equal(quoteToDispatch?.workflowId, "commercial.quote_to_dispatch");
  assert.equal(saleConfirmation?.workflowId, "commercial.sale_confirmation");
  assert.equal(
    quoteToDispatch?.inputsByStep.confirm_sale.quoteReference,
    "COT-100",
  );
  assert.equal(
    saleConfirmation?.inputsByStep.confirm_sale.quoteReference,
    "COT-200",
  );
  assert.match(bridge, /resolveBrainWorkflowIntent/);
  assert.match(bridge, /prepareBrainWorkflow/);
  assert.match(bridge, /inputsByStep: workflowIntent\.inputsByStep/);
  assert.match(bridge, /brain\.workflow\.prepare/);
  assert.match(bridge, /requieren aprobacion antes de ejecutarse/);
});
