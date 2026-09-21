import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export {};" };
    }

    if (specifier === "next/headers") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export async function cookies(){return {get(){return undefined},set(){},delete(){}};}",
      };
    }

    if (specifier === "@/modules/brain/runtime/trace-recorder") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export const brainSkillTraceRecorder={record:async()=>{}};",
      };
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

const { z } = await import("zod");
const { ok } = await import(new URL("../src/types/core.ts", import.meta.url));
const { defineBusinessSkill } = await import(
  new URL("../src/modules/brain/runtime/contracts.ts", import.meta.url)
);
const { createBusinessSkillRegistry } = await import(
  new URL("../src/modules/brain/runtime/business-skill-registry.ts", import.meta.url)
);
const { createBusinessSkillExecutor } = await import(
  new URL("../src/modules/brain/runtime/business-skill-executor.ts", import.meta.url)
);
const { initialBusinessIntents, initialCapabilities } = await import(
  new URL("../src/modules/brain/runtime/capability-catalog.ts", import.meta.url)
);
const { createCapabilityRegistry } = await import(
  new URL("../src/modules/brain/runtime/capability-registry.ts", import.meta.url)
);
const { createBusinessIntentRegistry } = await import(
  new URL("../src/modules/brain/runtime/intent-registry.ts", import.meta.url)
);
const { createBusinessIntentResolver } = await import(
  new URL("../src/modules/brain/runtime/intent-resolver.ts", import.meta.url)
);
const { createContextBuilder } = await import(
  new URL("../src/modules/brain/runtime/context-builder.ts", import.meta.url)
);
const { enrichIntentEntitiesFromMemory } = await import(
  new URL("../src/modules/brain/runtime/conversation-memory.ts", import.meta.url)
);
const { isClarificationResult, validateIntentSlots } = await import(
  new URL("../src/modules/brain/runtime/slot-validator.ts", import.meta.url)
);
const { parseLocalConversationAction } = await import(
  new URL("../src/modules/ai/conversation-local-parser.ts", import.meta.url)
);
const { parseProductCreationEntities } = await import(
  new URL("../src/modules/brain/runtime/product-creation-parser.ts", import.meta.url)
);
const { createInitialReadBusinessSkills } = await import(
  new URL("../src/modules/brain/runtime/skills/read-skills.ts", import.meta.url)
);
const { createLegacyConversationBusinessSkills } = await import(
  new URL("../src/modules/brain/runtime/skills/legacy-action-skills.ts", import.meta.url)
);

function tenant(overrides = {}) {
  return {
    activeModules: ["crm"],
    empresaId: "company-1",
    permissions: ["crm.customers.view"],
    profileId: "user-1",
    ...overrides,
  };
}

function searchSkill(id = "crm.customer.search", overrides = {}) {
  return defineBusinessSkill({
    description: "Search customers",
    enabled: true,
    id,
    idempotency: "none",
    inputSchema: z.object({ query: z.string().min(1) }),
    kind: "query",
    legacyActionId: "clientes.buscar_cliente",
    module: "crm",
    name: "Search customers",
    outputSchema: z.object({ customers: z.array(z.object({ id: z.string() })) }),
    requiredPermissions: ["crm.customers.view"],
    requiresConfirmation: false,
    risk: "low",
    version: "1.0.0",
    async execute(input) {
      return ok({
        data: { customers: [{ id: input.query }] },
        message: "Customer found",
      });
    },
    ...overrides,
  });
}

function readRuntimeSources(directory = path.join(root, "src/modules/brain/runtime")) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readRuntimeSources(fullPath);
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) return [];
    if (!statSync(fullPath).isFile()) return [];
    return [[fullPath, readFileSync(fullPath, "utf8")]];
  });
}

test("Business Skill Registry prevents duplicate ids and legacy mappings", () => {
  const registry = createBusinessSkillRegistry([searchSkill()]);

  assert.equal(registry.exists("crm.customer.search"), true);
  assert.equal(
    registry.getByLegacyActionId("clientes.buscar_cliente")?.id,
    "crm.customer.search",
  );
  assert.equal(registry.register(searchSkill()).ok, false);
  assert.equal(registry.register(searchSkill("crm.customer.search.v2")).ok, false);
});

test("Business Skill Registry exposes only authorized active-module skills", () => {
  const registry = createBusinessSkillRegistry([searchSkill()]);
  const optionalRegistry = createBusinessSkillRegistry([
    searchSkill("billing.customer.search", {
      legacyActionId: "billing.customer.search",
      module: "billing",
      requiredPermissions: ["billing.view"],
    }),
  ]);

  assert.equal(registry.getAvailable(tenant()).length, 1);
  assert.equal(registry.getAvailable(tenant({ permissions: [] })).length, 0);
  assert.equal(
    optionalRegistry.getAvailable(
      tenant({ activeModules: [], permissions: ["billing.view"] }),
    ).length,
    0,
  );
});

test("Business Skill Executor validates policy, input and output", async () => {
  const registry = createBusinessSkillRegistry([searchSkill()]);
  const traces = [];
  const executor = createBusinessSkillExecutor(
    registry,
    undefined,
    { async record(event) { traces.push(event); } },
  );
  const source = { channel: "module", module: "crm", surface: "test" };

  const success = await executor.invoke({
    input: { query: "customer-1" },
    skillId: "crm.customer.search",
    source,
    tenant: tenant(),
  });
  assert.equal(success.ok, true);
  assert.deepEqual(success.data.data, { customers: [{ id: "customer-1" }] });

  const invalid = await executor.invoke({
    input: { query: "" },
    skillId: "crm.customer.search",
    source,
    tenant: tenant(),
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, "VALIDATION_ERROR");

  const denied = await executor.invoke({
    input: { query: "customer-1" },
    skillId: "crm.customer.search",
    source,
    tenant: tenant({ permissions: [] }),
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "PERMISSION_DENIED");

  const inactiveExecutor = createBusinessSkillExecutor(
    createBusinessSkillRegistry([
      searchSkill("billing.customer.search", {
        legacyActionId: "billing.customer.search",
        module: "billing",
        requiredPermissions: ["billing.view"],
      }),
    ]),
    undefined,
    { async record(event) { traces.push(event); } },
  );
  const inactive = await inactiveExecutor.invoke({
    input: { query: "customer-1" },
    skillId: "billing.customer.search",
    source: { channel: "module", module: "billing", surface: "test" },
    tenant: tenant({ activeModules: ["crm"], permissions: ["billing.view"] }),
  });
  assert.equal(inactive.ok, false);
  assert.equal(inactive.error.code, "MODULE_INACTIVE");

  assert.deepEqual(
    traces.map((event) => event.status),
    ["success", "blocked", "blocked", "blocked"],
  );
});

test("Business Skill Executor owns confirmation and durable idempotency", async () => {
  let executions = 0;
  let completedResult = null;
  const command = searchSkill("crm.customer.create", {
    idempotency: "required",
    kind: "command",
    legacyActionId: "clientes.crear_cliente",
    requiresConfirmation: true,
    async execute(input) {
      executions += 1;
      return ok({
        data: { customers: [{ id: input.query }] },
        message: "Customer created",
      });
    },
  });
  const store = {
    async claim() {
      return completedResult
        ? ok({ cachedResult: completedResult, status: "completed" })
        : ok({ status: "claimed" });
    },
    async complete(input) {
      completedResult = input.result;
      return ok(null);
    },
    async fail() {},
  };
  const executor = createBusinessSkillExecutor(
    createBusinessSkillRegistry([command]),
    undefined,
    { async record() {} },
    store,
  );
  const invocation = {
    idempotencyKey: "request-1",
    input: { query: "customer-1" },
    skillId: command.id,
    source: { channel: "module", module: "crm", surface: "test" },
    tenant: tenant({ permissions: ["crm.customers.view"] }),
  };

  const blocked = await executor.invoke(invocation);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, "CONFIRMATION_REQUIRED");
  assert.equal(executions, 0);

  const first = await executor.invoke({
    ...invocation,
    approval: { confirmed: true, reference: "confirmation-1" },
  });
  assert.equal(first.ok, true);
  assert.equal(first.data.cached, false);
  assert.equal(executions, 1);

  const repeated = await executor.invoke({
    ...invocation,
    approval: { confirmed: true, reference: "confirmation-1" },
  });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.data.cached, true);
  assert.equal(executions, 1);
});

test("Brain Runtime is provider-neutral and does not depend on a specific LLM", () => {
  for (const [filePath, source] of readRuntimeSources()) {
    assert.doesNotMatch(
      source,
      /@\/lib\/ai\/providers|gemini|openai|generateJson|generateText/i,
      `${path.relative(root, filePath)} must not depend on a concrete AI provider`,
    );
  }

  const bridgeSource = readFileSync(
    path.join(root, "src/modules/ai/conversation-execution-bridge.ts"),
    "utf8",
  );
  assert.match(bridgeSource, /interpretBrainMessage/);
  assert.match(bridgeSource, /businessIntentRegistry/);
  assert.match(bridgeSource, /Devuelve action_id con el Business Intent exacto/);
  assert.doesNotMatch(bridgeSource, /gemini|openai/i);
});

test("Risk policy invariants prevent high-risk Skills from bypassing confirmation", () => {
  const readSkills = createInitialReadBusinessSkills();
  const allSkills = [
    ...readSkills,
    ...createLegacyConversationBusinessSkills(
      readSkills.flatMap((skill) =>
        skill.legacyActionId ? [skill.legacyActionId] : [],
      ),
    ),
  ];

  for (const skill of allSkills) {
    if (skill.risk === "high" || skill.risk === "critical") {
      assert.equal(
        skill.requiresConfirmation,
        true,
        `${skill.id} is ${skill.risk} and must require confirmation`,
      );
    }

    if (skill.requiresConfirmation) {
      assert.equal(
        skill.idempotency,
        "required",
        `${skill.id} requires confirmation and must be idempotent`,
      );
    }
  }
});

test("Every conversation action has a Business Skill mapping", () => {
  const actionSource = readFileSync(
    path.join(root, "src/lib/ai/action-registry/registry.ts"),
    "utf8",
  );
  const skillSource = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/legacy-action-skills.ts"),
    "utf8",
  );
  const registryBody = actionSource.split(
    "export const conversationActionRegistry",
  )[1].split("export function listConversationActions")[0];
  const actionIds = [...registryBody.matchAll(/id: "([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.equal(actionIds.length, 21);
  for (const actionId of actionIds) {
    assert.match(skillSource, new RegExp(`"${actionId.replaceAll(".", "\\.")}"`));
  }
});

test("Every current Business Skill has an Intent and Capability path", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);

  const implementedSkillIds = [
    "agenda.task.create",
    "autoblog.article.generate",
    "autoblog.article.validate",
    "autoblog.output.normalize",
    "brain.analysis.run",
    "brain.context.open",
    "brain.question.answer",
    "brain.plan.prepare",
    "brain.recommendations.query",
    "brain.signals.query",
    "billing.draft.prepare",
    "catalog.product.create",
    "catalog.product.search",
    "catalog.product.stock.initialize",
    "catalog.product.update",
    "catalog.product.validate",
    "crm.customer.create",
    "crm.customer.history",
    "crm.customer.search",
    "crm.customer.update",
    "crm.followup.create",
    "crm.followup.query",
    "dispatch.pending.query",
    "inbox.conversation.assign",
    "inbox.conversation.close",
    "inbox.customer.link",
    "inbox.note.create",
    "inbox.reply.draft",
    "inbox.sla.overdue.query",
    "inventory.reorder.suggest",
    "inventory.stock.adjust",
    "inventory.stock.query",
    "inventory.stock.transfer",
    "payments.collection-reminder.create",
    "payments.overdue.query",
    "payments.payable.query",
    "payments.account.statement",
    "payments.payment.register",
    "purchases.order.query",
    "purchases.reorder.suggest",
    "quotes.draft.create",
    "quotes.expired.query",
    "quotes.item.add",
    "quotes.sale.confirm",
    "quotes.total.calculate",
    "sales.dispatch.prepare",
    "sales.order.detail",
    "sales.receivable.generate",
    "sales.summary.query",
  ];

  for (const skillId of implementedSkillIds) {
    const capability = capabilityRegistry
      .list()
      .find((item) =>
        item.skillBindings.some((binding) => binding.skillId === skillId),
      );
    assert.ok(capability, `Missing capability for ${skillId}`);
    assert.ok(
      intentRegistry
        .list()
        .some((intent) => intent.capabilityId === capability.id),
      `Missing intent for ${capability.id}`,
    );
  }
});

test("Operational Brain questions use a dedicated Business Skill with real evidence", () => {
  const skillSource = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/read-skills.ts"),
    "utf8",
  );
  const bridgeSource = readFileSync(
    path.join(root, "src/modules/ai/conversation-execution-bridge.ts"),
    "utf8",
  );

  assert.match(skillSource, /id:\s*"brain\.question\.answer"/);
  assert.match(skillSource, /legacyActionId:\s*"brain\.responder_pregunta"/);
  assert.match(skillSource, /getTodayFollowups/);
  assert.match(skillSource, /getOverdueFollowups/);
  assert.match(skillSource, /getPaymentAccounts/);
  assert.match(skillSource, /getQuotes/);
  assert.match(skillSource, /getInboxConversations/);
  assert.match(skillSource, /agenda_followups/);
  assert.match(skillSource, /payment_accounts/);
  assert.match(skillSource, /inbox_conversations/);
  assert.match(skillSource, /Encontré \${priorities\.length} asunto\(s\) para revisar hoy/);
  assert.match(bridgeSource, /brainRuntime\.invoke/);
});

test("Inbox reply drafts use real conversation messages and never send", () => {
  const skillSource = readFileSync(
    path.join(root, "src/modules/brain/runtime/skills/read-skills.ts"),
    "utf8",
  );
  const capabilitySource = readFileSync(
    path.join(root, "src/modules/brain/runtime/capability-catalog.ts"),
    "utf8",
  );

  assert.match(skillSource, /id:\s*"inbox\.reply\.draft"/);
  assert.match(skillSource, /legacyActionId:\s*"inbox\.preparar_respuesta"/);
  assert.match(skillSource, /getInboxMessagesForTenant/);
  assert.match(skillSource, /inbox_mensajes/);
  assert.match(skillSource, /No se envio ningun mensaje/);
  assert.doesNotMatch(skillSource, /sendWhatsAppMessageAction/);
  assert.match(capabilitySource, /id:\s*"inbox\.reply\.draft"[\s\S]*requiredSlots:\s*\[conversationReferenceSlot\]/);
});

const stage2PriorityCapabilityIds = [
  "crm.customer.search",
  "crm.customer.create",
  "crm.customer.update",
  "crm.customer.history",
  "crm.followup.create",
  "crm.followup.query",
  "catalog.product.search",
  "catalog.product.create",
  "catalog.product.update",
  "catalog.product.validate",
  "catalog.product.stock.initialize",
  "inventory.stock.query",
  "inventory.reorder.suggest",
  "inventory.stock.adjust",
  "inventory.stock.transfer",
  "quotes.draft.create",
  "quotes.expired.query",
  "quotes.item.add",
  "quotes.total.calculate",
  "quotes.sale.confirm",
  "sales.summary.query",
  "sales.order.detail",
  "sales.receivable.generate",
  "sales.dispatch.prepare",
  "payments.overdue.query",
  "payments.payable.query",
  "payments.payment.register",
  "payments.collection-reminder.create",
  "payments.account.statement",
  "inbox.note.create",
  "inbox.reply.draft",
  "inbox.customer.link",
  "inbox.conversation.assign",
  "inbox.conversation.close",
  "inbox.sla.overdue.query",
  "autoblog.article.generate",
  "autoblog.article.validate",
  "autoblog.output.normalize",
  "brain.analysis.run",
  "brain.signals.query",
  "brain.recommendations.query",
  "brain.plan.prepare",
];

const stage2PlannedCapabilityIds = [];

test("Etapa 2 priority capabilities are formally declared", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);

  for (const capabilityId of stage2PriorityCapabilityIds) {
    const capability = capabilityRegistry.get(capabilityId);
    assert.ok(capability, `Missing capability ${capabilityId}`);
    assert.equal(capability.enabled, true, `Capability disabled ${capabilityId}`);
    assert.equal(capability.status, "implemented", `Capability is not implemented ${capabilityId}`);
    assert.ok(capability.description.length > 10, `Missing description ${capabilityId}`);
    assert.ok(capability.name.length > 2, `Missing name ${capabilityId}`);
    assert.ok(capability.requiredPermissions.length > 0, `Missing permissions ${capabilityId}`);
    assert.ok(capability.skillBindings.length > 0, `Missing binding ${capabilityId}`);
    assert.ok(capability.version, `Missing version ${capabilityId}`);

    const intents = intentRegistry
      .list()
      .filter((intent) => intent.capabilityId === capabilityId);
    assert.ok(intents.length > 0, `Missing intent ${capabilityId}`);

    for (const intent of intents) {
      assert.equal(intent.enabled, true, `Intent disabled ${intent.id}`);
      assert.ok(intent.examples.length > 0, `Intent has no examples ${intent.id}`);
      assert.ok(Array.isArray(intent.requiredSlots), `Intent has no slot contract ${intent.id}`);
    }
  }
});

test("Etapa 2 planned capabilities are not executable until a real Skill exists", () => {
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);

  for (const capabilityId of stage2PlannedCapabilityIds) {
    const capability = capabilityRegistry.get(capabilityId);
    assert.equal(capability.status, "planned", `${capabilityId} should be planned`);
    assert.equal(
      capabilityRegistry.getImplementedBinding(capabilityId),
      null,
      `${capabilityId} exposed an executable binding without a Skill`,
    );
    assert.ok(
      capability.skillBindings.every((binding) => binding.status === "planned"),
      `${capabilityId} has a non-planned binding`,
    );
  }
});

test("Intent Resolver routes acceptance phrases through Capability before Skill", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const resolver = createBusinessIntentResolver(intentRegistry);

  const stock = resolver.resolve({
    message: "Cuanto stock hay de Lentes seguridad transparentes",
  });
  assert.equal(stock.ok, true);
  assert.equal(stock.data.intentId, "inventory.stock.query");
  assert.equal(stock.data.capabilityId, "inventory.stock.query");
  assert.equal(stock.data.entities.query, "lentes seguridad transparentes");
  assert.equal(
    capabilityRegistry.getImplementedBinding(stock.data.capabilityId).skillId,
    "inventory.stock.query",
  );

  const customer = resolver.resolve({
    message:
      "Crea un cliente llamado Prueba Brain con teléfono 88888888 y correo pruebabrain@ejemplo.com",
  });
  assert.equal(customer.ok, true);
  assert.equal(customer.data.intentId, "crm.customer.create");
  assert.equal(customer.data.capabilityId, "crm.customer.create");
  assert.equal(customer.data.entities.nombre, "Prueba Brain");
  assert.equal(customer.data.entities.telefono, "88888888");
  assert.equal(customer.data.entities.correo, "pruebabrain@ejemplo.com");

  const product = resolver.resolve({
    message:
      "Crea el producto Casco Seguridad Prueba, precio 2500, en la bodega Sucursal Principal con cantidad inicial 20.",
  });
  assert.equal(product.ok, true);
  assert.equal(product.data.intentId, "catalog.product.create");
  assert.equal(product.data.entities.nombre, "Casco Seguridad Prueba");
  assert.equal(product.data.entities.precioBase, 2500);
  assert.equal(product.data.entities.bodegaNombre, "Sucursal Principal");
  assert.equal(product.data.entities.cantidadInicial, 20);
});

test("Intent Resolver recognizes Etapa 2 business actions without generic Brain fallback", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const cases = [
    ["Cuanto me compro Prueba Brain", "crm.customer.history"],
    ["Actualiza el telefono del cliente Prueba Brain", "crm.customer.update"],
    ["Valida el producto Lentes seguridad transparentes", "catalog.product.validate"],
    ["Ajusta el stock de Lentes seguridad transparentes", "inventory.stock.adjust"],
    ["Transfiere stock de Lentes seguridad transparentes", "inventory.stock.transfer"],
    ["Crea una cotizacion para Prueba Brain con dos guantes", "quotes.draft.create"],
    ["Cotizaciones vencidas", "quotes.expired.query"],
    ["Agrega dos guantes a la cotizacion", "quotes.item.add"],
    ["Calcula el total de la proforma", "quotes.total.calculate"],
    ["Confirma esta cotizacion como venta", "quotes.sale.confirm"],
    ["Detalle de la venta VEN-2026-000027", "sales.order.detail"],
    ["Genera cuenta por cobrar de esta venta", "sales.receivable.generate"],
    ["Prepara despacho de esta venta", "sales.dispatch.prepare"],
    ["Registra cobro de la factura", "payments.payment.register"],
    ["Estado de cuenta de Prueba Brain", "payments.account.statement"],
    ["Responde este WhatsApp", "inbox.reply.draft"],
    ["Conversaciones SLA vencido", "inbox.sla.overdue.query"],
    ["Agrega una nota interna al chat", "inbox.note.create"],
    ["Vincula este chat con Prueba Brain", "inbox.customer.link"],
    ["Asigna esta conversacion a Userprueba3", "inbox.conversation.assign"],
    ["Cierra esta conversacion", "inbox.conversation.close"],
    ["Valida el blog antes de publicar", "autoblog.article.validate"],
    ["Normaliza la salida del articulo", "autoblog.output.normalize"],
    ["Que senales ves del negocio", "brain.signals.query"],
    ["Que debo atender hoy", "brain.question.answer"],
    ["Dame recomendaciones del negocio", "brain.recommendations.query"],
    ["Prepara un plan para mejorar inventario", "brain.plan.prepare"],
  ];

  for (const [message, capabilityId] of cases) {
    const resolved = resolver.resolve({ message });
    assert.equal(resolved.ok, true, message);
    assert.equal(resolved.data.capabilityId, capabilityId, message);
    const capability = capabilityRegistry.get(capabilityId);
    if (stage2PlannedCapabilityIds.includes(capabilityId)) {
      assert.equal(capability.status, "planned", message);
      assert.equal(capabilityRegistry.getImplementedBinding(capabilityId), null, message);
    } else {
      assert.equal(capability.status, "implemented", message);
      assert.ok(capabilityRegistry.getImplementedBinding(capabilityId), message);
    }
  }
});

test("Natural language acceptance matrix covers mapped modules", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const cases = [
    ["CRM", "Busca al cliente Prueba Brain", "crm.customer.search"],
    [
      "CRM",
      "Crea un cliente llamado Prueba Brain con telefono 88888888 y correo pruebabrain@test.com",
      "crm.customer.create",
    ],
    ["Catalogo", "Busca el producto Lentes seguridad transparentes", "catalog.product.search"],
    [
      "Catalogo",
      "Crea un producto Guante Prueba Brain precio 1500",
      "catalog.product.create",
    ],
    ["Inventario", "Cuanto stock hay de Lentes seguridad transparentes", "inventory.stock.query"],
    ["Inventario", "Que productos tienen stock bajo", "inventory.reorder.suggest"],
    ["Cotizaciones", "Crea una proforma para Juan con 2 Guante nitrilo talla M precio 1500", "quotes.draft.create"],
    ["Cotizaciones", "Que cotizaciones estan vencidas", "quotes.expired.query"],
    ["CRM", "Crear una tarea para llamar a Prueba Brain manana", "crm.followup.create"],
    ["CRM", "Crear seguimiento para Prueba Brain manana", "crm.followup.create"],
    ["Agenda", "Crear recordatorio revisar pendientes manana", "agenda.task.create"],
    ["Ventas", "Muestrame las ventas recientes", "sales.summary.query"],
    ["Pagos", "Que cuentas por cobrar estan pendientes", "payments.overdue.query"],
    ["Pagos", "Cuanto me debe Alondra", "payments.account.statement"],
    ["Compras", "Muestrame las ordenes de compra pendientes", "purchases.order.query"],
    ["Despacho", "Que entregas estan pendientes", "dispatch.pending.query"],
    ["Facturacion", "Preparar una factura para Prueba Brain", "billing.draft.prepare"],
    ["WhatsApp", "Responde este WhatsApp", "inbox.reply.draft"],
    ["WhatsApp", "Que conversaciones tienen SLA vencido", "inbox.sla.overdue.query"],
    ["Autoblog", "Crear un blog sobre seguridad industrial", "autoblog.article.generate"],
    ["Brain", "Que debo atender hoy", "brain.question.answer"],
  ];

  for (const [moduleName, message, capabilityId] of cases) {
    const resolved = resolver.resolve({ message });
    assert.equal(resolved.ok, true, `${moduleName}: ${message}`);
    assert.equal(resolved.data.capabilityId, capabilityId, `${moduleName}: ${message}`);
    const capability = capabilityRegistry.get(capabilityId);
    assert.ok(capability, `${moduleName}: missing capability ${capabilityId}`);
    assert.equal(capability.status, "implemented", `${moduleName}: ${capabilityId}`);
    assert.ok(
      capabilityRegistry.getImplementedBinding(capabilityId),
      `${moduleName}: missing implemented binding ${capabilityId}`,
    );
  }
});

test("Natural language matrix blocks incomplete and ambiguous commands", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const cases = [
    ["Crea un cliente", "crm.customer.create", "Cual es el nombre del cliente?"],
    [
      "Crea una cotizacion para Juan con dos guantes",
      "quotes.draft.create",
      "Que productos, cantidades y precios debe incluir la cotizacion?",
    ],
    [
      "Responde este WhatsApp",
      "inbox.reply.draft",
      "A que conversacion o cliente de Inbox te refieres?",
    ],
    ["Crear un blog", "autoblog.article.generate", "Sobre que tema quieres generar el articulo?"],
    ["Cuanto me debe", "payments.account.statement", "A que cliente te refieres?"],
  ];

  for (const [message, intentId, expectedClarification] of cases) {
    const resolved = resolver.resolve({ message });
    assert.equal(resolved.ok, true, message);
    assert.equal(resolved.data.intentId, intentId, message);

    const intent = intentRegistry.get(resolved.data.intentId);
    const validation = validateIntentSlots(intent, resolved.data.entities);

    assert.equal(validation.ok, true, message);
    assert.equal(isClarificationResult(validation.data), true, message);
    assert.equal(validation.data.message, expectedClarification, message);
  }
});

test("Intent Resolver blocks negative execution commands", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const cases = [
    "No crees un cliente llamado Prueba Brain",
    "No envies este WhatsApp",
    "Cancela la accion de crear producto",
  ];

  for (const message of cases) {
    const resolved = resolver.resolve({ message });
    assert.equal(resolved.ok, false, message);
    assert.equal(resolved.error.code, "VALIDATION_ERROR", message);
    assert.match(resolved.error.message, /No voy a ejecutar ninguna accion/);
    assert.equal(resolved.error.cause.terminal, true, message);
  }
});

test("Conversation bridge does not send negative execution commands to the LLM", () => {
  const bridge = readFileSync(
    path.join(root, "src/modules/ai/conversation-execution-bridge.ts"),
    "utf8",
  );
  const terminalCheck = bridge.indexOf("isTerminalIntentError(resolvedIntent.error)");
  const llmFallback = bridge.indexOf("const interpreted = await interpretBrainMessage");

  assert.notEqual(terminalCheck, -1);
  assert.notEqual(llmFallback, -1);
  assert.ok(terminalCheck < llmFallback);
});

test("Intent Resolver asks for slots instead of executing incomplete input", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const resolved = resolver.resolve({ message: "Crea un cliente" });
  assert.equal(resolved.ok, true);

  const intent = intentRegistry.get(resolved.data.intentId);
  const validation = validateIntentSlots(intent, resolved.data.entities);

  assert.equal(validation.ok, true);
  assert.equal(isClarificationResult(validation.data), true);
  assert.equal(validation.data.message, "Cual es el nombre del cliente?");
});

test("Quote draft intent asks for clarification when product details are ambiguous", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const resolved = resolver.resolve({
    message: "Crea una cotizacion para Juan con dos guantes",
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.data.intentId, "quotes.draft.create");
  assert.equal(resolved.data.entities.customerQuery, "juan");
  assert.equal(resolved.data.entities.items, undefined);

  const intent = intentRegistry.get(resolved.data.intentId);
  const validation = validateIntentSlots(intent, resolved.data.entities);

  assert.equal(validation.ok, true);
  assert.equal(isClarificationResult(validation.data), true);
  assert.equal(
    validation.data.message,
    "Que productos, cantidades y precios debe incluir la cotizacion?",
  );
});

test("Quote draft intent extracts complete item details when present", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const resolved = resolver.resolve({
    message:
      "Crea una proforma para Juan con 2 Guante nitrilo talla M precio 1500",
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.data.intentId, "quotes.draft.create");
  assert.equal(resolved.data.entities.customerQuery, "juan");
  assert.deepEqual(resolved.data.entities.items, [
    {
      cantidad: 2,
      descripcion: "Guante nitrilo talla M",
      descuento: 0,
      impuestoPorcentaje: 0,
      precioUnitario: 1500,
    },
  ]);

  const intent = intentRegistry.get(resolved.data.intentId);
  const validation = validateIntentSlots(intent, resolved.data.entities);

  assert.equal(validation.ok, true);
  assert.equal(isClarificationResult(validation.data), false);
  assert.equal(validation.data.params.items[0].descripcion, "Guante nitrilo talla M");
});

test("Slot Validator canonicalizes aliases before execution", () => {
  const intent = {
    capabilityId: "inventory.stock.adjust",
    description: "Ajustar stock",
    enabled: true,
    examples: [],
    id: "inventory.stock.adjust",
    module: "inventory",
    requiredSlots: [
      {
        aliases: ["product"],
        clarification: "A que producto te refieres?",
        name: "productQuery",
        required: true,
        type: "string",
      },
      {
        aliases: ["bodega"],
        clarification: "En que bodega debe hacerse la operacion?",
        name: "warehouse",
        required: true,
        type: "string",
      },
    ],
  };

  const validation = validateIntentSlots(intent, {
    bodega: "Sucursal Principal",
    product: "Lentes seguridad transparentes",
  });

  assert.equal(validation.ok, true);
  assert.equal(isClarificationResult(validation.data), false);
  assert.equal(validation.data.params.productQuery, "Lentes seguridad transparentes");
  assert.equal(validation.data.params.warehouse, "Sucursal Principal");
});

test("Slot Validator gives concrete multi-slot clarifications", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const intent = intentRegistry.get("inventory.stock.transfer");
  const validation = validateIntentSlots(intent, {});

  assert.equal(validation.ok, true);
  assert.equal(isClarificationResult(validation.data), true);
  assert.match(validation.data.message, /A que producto te refieres/);
  assert.match(validation.data.message, /Que cantidad debo usar/);
  assert.match(validation.data.message, /Desde que bodega debo transferir el stock/);
  assert.match(validation.data.message, /Hacia que bodega debo transferir el stock/);
  assert.doesNotMatch(validation.data.message, /originWarehouse|destinationWarehouse|productQuery/);
});

test("Conversation memory resolves vague customer, product and sale references", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const memory = {
    conversationMemory: {
      lastCustomerName: "Alondra Test",
      lastProductName: "Lentes seguridad transparentes",
      lastSaleReference: "VEN-2026-000027",
    },
  };

  const statementIntent = intentRegistry.get("payments.account.statement");
  const statement = enrichIntentEntitiesFromMemory(
    statementIntent,
    { customerQuery: "ese cliente" },
    memory,
  );
  assert.equal(statement.customerQuery, "Alondra Test");

  const stockIntent = intentRegistry.get("inventory.stock.query");
  const stock = enrichIntentEntitiesFromMemory(
    stockIntent,
    { query: "ese producto" },
    memory,
  );
  assert.equal(stock.query, "Lentes seguridad transparentes");

  const saleIntent = intentRegistry.get("sales.order.detail");
  const sale = enrichIntentEntitiesFromMemory(
    saleIntent,
    { saleReference: "esta venta" },
    memory,
  );
  assert.equal(sale.saleReference, "VEN-2026-000027");
});

test("Inbox reply draft requires a conversation unless memory resolves it", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const resolved = resolver.resolve({ message: "Responde este WhatsApp" });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.data.intentId, "inbox.reply.draft");

  const intent = intentRegistry.get(resolved.data.intentId);
  const missing = validateIntentSlots(intent, resolved.data.entities);
  assert.equal(missing.ok, true);
  assert.equal(isClarificationResult(missing.data), true);
  assert.equal(
    missing.data.message,
    "A que conversacion o cliente de Inbox te refieres?",
  );

  const enriched = enrichIntentEntitiesFromMemory(
    intent,
    resolved.data.entities,
    {
      conversationMemory: {
        lastConversationReference: "conversation-123",
      },
    },
  );
  const validation = validateIntentSlots(intent, enriched);

  assert.equal(validation.ok, true);
  assert.equal(isClarificationResult(validation.data), false);
  assert.equal(validation.data.params.conversationReference, "conversation-123");

  const fromPath = enrichIntentEntitiesFromMemory(
    intent,
    resolved.data.entities,
    {
      currentPath: "/whapp/conversaciones/67f38da6-39e4-4151-82a3-8302d578085a",
    },
  );
  const pathValidation = validateIntentSlots(intent, fromPath);

  assert.equal(pathValidation.ok, true);
  assert.equal(isClarificationResult(pathValidation.data), false);
  assert.equal(
    pathValidation.data.params.conversationReference,
    "67f38da6-39e4-4151-82a3-8302d578085a",
  );
});

test("Context Builder declares real data domains before Brain answers", async () => {
  const builder = createContextBuilder();
  const result = await builder.build({
    capabilityId: "payments.account.statement",
    entities: { customerQuery: "Alondra" },
    intentId: "payments.account.statement",
    source: { channel: "bar", module: "payments", surface: "test" },
    tenant: tenant({
      activeModules: ["payments", "crm", "sales"],
      permissions: ["payments.accounts.view"],
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.facts.dataDomains, [
    "payments",
    "crm",
    "sales",
    "purchases",
  ]);
  assert.deepEqual(result.data.facts.entityHints, ["customerQuery"]);
  assert.equal(result.data.facts.requiresFreshData, true);
  assert.ok(
    result.data.evidence.some((item) => item.source === "payments.accounts"),
  );
  assert.ok(result.data.evidence.some((item) => item.source === "crm.customers"));
});

test("Context Builder expands operational Brain questions across modules", async () => {
  const builder = createContextBuilder();
  const result = await builder.build({
    capabilityId: "brain.question.answer",
    entities: { question: "Que debo atender hoy" },
    intentId: "brain.question.answer",
    source: { channel: "bar", module: "brain", surface: "test" },
    tenant: tenant({
      activeModules: ["agenda", "payments", "quotes", "whapp", "sales"],
      permissions: ["brain.insights.view"],
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.facts.dataDomains, [
    "agenda",
    "payments",
    "quotes",
    "inbox",
    "sales",
  ]);
  for (const source of [
    "agenda.tasks",
    "payments.accounts",
    "quotes.quotes",
    "inbox.conversations",
  ]) {
    assert.ok(result.data.evidence.some((item) => item.source === source), source);
  }
});

test("Planned capabilities do not fall back to generic Brain answers", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const capabilityRegistry = createCapabilityRegistry(initialCapabilities);
  const resolver = createBusinessIntentResolver(intentRegistry);
  const resolved = resolver.resolve({ message: "Que cliente debo atender primero?" });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.data.intentId, "crm.customer.next_best");
  assert.equal(resolved.data.capabilityId, "crm.customer.next_best");
  assert.equal(capabilityRegistry.get(resolved.data.capabilityId).status, "planned");
  assert.equal(
    capabilityRegistry.getImplementedBinding(resolved.data.capabilityId),
    null,
  );
});

test("Natural language routes concrete inventory questions before generic Brain", () => {
  const parsed = parseLocalConversationAction(
    '¿Cuánto inventario tenemos del producto "Lentes seguridad transparentes"?',
  );

  assert.equal(parsed.actionId, "inventario.consultar_stock");
  assert.equal(parsed.params.query, "lentes seguridad transparentes");
});

test("Natural language extracts complete customer creation data", () => {
  const parsed = parseLocalConversationAction(
    "Crea un cliente llamado Prueba Brain, teléfono 88888888 y correo pruebabrain@ejemplo.com",
  );

  assert.equal(parsed.actionId, "clientes.crear_cliente");
  assert.equal(parsed.params.nombre, "Prueba Brain");
  assert.equal(parsed.params.telefono, "88888888");
  assert.equal(parsed.params.correo, "pruebabrain@ejemplo.com");
});

test("Product creation retains the requested warehouse and initial stock", () => {
  const message =
    "Crea el producto Guante Prueba Brain, precio 1500, en la bodega Sucursal Principal con cantidad inicial 12";
  const entities = parseProductCreationEntities(message);
  const parsed = parseLocalConversationAction(message);

  assert.deepEqual(entities, {
    bodegaNombre: "Sucursal Principal",
    cantidadInicial: 12,
    nombre: "Guante Prueba Brain",
    precioBase: 1500,
  });
  assert.equal(parsed.actionId, "productos.crear_producto");
  assert.equal(parsed.params.bodegaNombre, "Sucursal Principal");
  assert.equal(parsed.params.cantidadInicial, 12);
  assert.equal(parsed.params.nombre, "Guante Prueba Brain");
});

test("Customer search wording never creates a customer", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);

  const resolved = resolver.resolve({ message: "Busca al cliente nuevo" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.data.intentId, "crm.customer.search");
  assert.equal(resolved.data.capabilityId, "crm.customer.search");
  assert.equal(resolved.data.entities.query, "nuevo");

  const parsed = parseLocalConversationAction("Busca al cliente nuevo");
  assert.equal(parsed.actionId, "clientes.buscar_cliente");
  assert.equal(parsed.params.query, "nuevo");
});

test("Payables wording routes to payables instead of receivables", () => {
  const intentRegistry = createBusinessIntentRegistry(initialBusinessIntents);
  const resolver = createBusinessIntentResolver(intentRegistry);

  const resolved = resolver.resolve({ message: "Que cuentas por pagar estan pendientes" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.data.intentId, "payments.payable.query");
  assert.equal(resolved.data.capabilityId, "payments.payable.query");

  const parsed = parseLocalConversationAction("Que cuentas por pagar estan pendientes");
  assert.equal(parsed.actionId, "pagos.consultar_cuentas_pagar");
});

test("Action input schemas avoid empty string literals rejected by Gemini", () => {
  const actionSource = readFileSync(
    path.join(root, "src/lib/ai/action-registry/registry.ts"),
    "utf8",
  );
  const quoteSchemaSource = readFileSync(
    path.join(root, "src/modules/quotes/schemas.ts"),
    "utf8",
  );
  const optionalPhoneBlock = actionSource.split("const optionalPhone =")[1].split(
    "const optionalIdentification",
  )[0];

  assert.match(actionSource, /const emptyStringToUndefined/);
  assert.match(actionSource, /z\.preprocess\(\s*emptyStringToUndefined/);
  assert.match(optionalPhoneBlock, /\.optional\(\)/);
  assert.doesNotMatch(actionSource, /z\.literal\(""\)\.transform/);
  assert.match(quoteSchemaSource, /const emptyStringToUndefined/);
  assert.doesNotMatch(quoteSchemaSource, /z\.literal\(""\)\.transform/);
});

test("Natural language routes recent sales to the sales Skill", () => {
  const parsed = parseLocalConversationAction("Muéstrame las ventas recientes");

  assert.equal(parsed.actionId, "ventas.buscar_ventas");
  assert.deepEqual(parsed.params, { limit: 10 });
});
