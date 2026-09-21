import "server-only";

import type {
  BrainEvidence,
  ContextBuilder,
  ContextBuilderResult,
  ContextRequest,
} from "@/modules/brain/runtime/contracts";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

type ContextPlan = {
  evidenceSources: string[];
  facts: {
    dataDomains: string[];
    entityHints: string[];
    operationalQuestion: boolean;
    requiresFreshData: boolean;
  };
};

function entityHints(request: ContextRequest) {
  return Object.entries(request.entities)
    .filter(([, value]) => {
      if (typeof value === "string") return value.trim().length > 0;
      if (typeof value === "number") return Number.isFinite(value);
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined;
    })
    .map(([key]) => key);
}

function planContext(request: ContextRequest): ContextPlan {
  const capabilityId = request.capabilityId;
  const hints = entityHints(request);
  const question =
    typeof request.entities.question === "string"
      ? request.entities.question
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      : "";
  const base = {
    entityHints: hints,
    operationalQuestion: capabilityId.startsWith("brain."),
    requiresFreshData: true,
  };

  if (capabilityId.startsWith("crm.")) {
    return {
      evidenceSources: [
        "crm.customers",
        "crm.followups",
        "sales.orders",
        "quotes.quotes",
      ],
      facts: {
        ...base,
        dataDomains: ["crm", "sales", "quotes"],
      },
    };
  }

  if (capabilityId.startsWith("catalog.")) {
    return {
      evidenceSources: ["catalog.products", "inventory.stock"],
      facts: {
        ...base,
        dataDomains: ["catalog", "inventory"],
      },
    };
  }

  if (capabilityId.startsWith("inventory.")) {
    return {
      evidenceSources: [
        "inventory.stock",
        "inventory.warehouses",
        "catalog.products",
        "purchases.orders",
        "sales.orders",
      ],
      facts: {
        ...base,
        dataDomains: ["inventory", "catalog", "purchases", "sales"],
      },
    };
  }

  if (capabilityId.startsWith("quotes.")) {
    return {
      evidenceSources: [
        "quotes.quotes",
        "crm.customers",
        "catalog.products",
        "inventory.stock",
      ],
      facts: {
        ...base,
        dataDomains: ["quotes", "crm", "catalog", "inventory"],
      },
    };
  }

  if (capabilityId.startsWith("sales.")) {
    return {
      evidenceSources: [
        "sales.orders",
        "crm.customers",
        "payments.accounts",
        "dispatch.orders",
      ],
      facts: {
        ...base,
        dataDomains: ["sales", "crm", "payments", "dispatch"],
      },
    };
  }

  if (capabilityId.startsWith("payments.")) {
    return {
      evidenceSources: [
        "payments.accounts",
        "payments.movements",
        "crm.customers",
        "sales.orders",
        "purchases.orders",
      ],
      facts: {
        ...base,
        dataDomains: ["payments", "crm", "sales", "purchases"],
      },
    };
  }

  if (capabilityId.startsWith("purchases.")) {
    return {
      evidenceSources: [
        "purchases.orders",
        "inventory.stock",
        "catalog.products",
      ],
      facts: {
        ...base,
        dataDomains: ["purchases", "inventory", "catalog"],
      },
    };
  }

  if (capabilityId.startsWith("dispatch.")) {
    return {
      evidenceSources: ["dispatch.orders", "sales.orders", "crm.customers"],
      facts: {
        ...base,
        dataDomains: ["dispatch", "sales", "crm"],
      },
    };
  }

  if (capabilityId.startsWith("inbox.")) {
    return {
      evidenceSources: [
        "inbox.conversations",
        "crm.customers",
        "sales.orders",
      ],
      facts: {
        ...base,
        dataDomains: ["inbox", "crm", "sales"],
      },
    };
  }

  if (capabilityId.startsWith("autoblog.")) {
    return {
      evidenceSources: ["autoblog.articles", "catalog.products"],
      facts: {
        ...base,
        dataDomains: ["autoblog", "catalog"],
      },
    };
  }

  if (
    capabilityId === "brain.question.answer" &&
    /\b(atender|hoy|prioridad|prioridades|pendiente|pendientes)\b/.test(question)
  ) {
    return {
      evidenceSources: [
        "agenda.tasks",
        "payments.accounts",
        "quotes.quotes",
        "inbox.conversations",
        "sales.orders",
      ],
      facts: {
        ...base,
        dataDomains: ["agenda", "payments", "quotes", "inbox", "sales"],
      },
    };
  }

  return {
    evidenceSources: ["brain.runtime"],
    facts: {
      ...base,
      dataDomains: ["brain"],
    },
  };
}

export function createContextBuilder(): ContextBuilder {
  return {
    async build(request: ContextRequest): Promise<CoreResult<ContextBuilderResult>> {
      const freshnessAt = new Date().toISOString();
      const plan = planContext(request);
      const evidence: BrainEvidence[] = [
        {
          freshnessAt,
          source: "brain.context_builder.plan",
        },
        ...plan.evidenceSources.map((source) => ({
          freshnessAt,
          source,
        })),
      ];

      return ok({
        evidence,
        facts: {
          capabilityId: request.capabilityId,
          dataDomains: plan.facts.dataDomains,
          entityHints: plan.facts.entityHints,
          intentId: request.intentId,
          operationalQuestion: plan.facts.operationalQuestion,
          requiresFreshData: plan.facts.requiresFreshData,
          source: request.source.surface,
        },
        freshnessAt,
      });
    },
  };
}
