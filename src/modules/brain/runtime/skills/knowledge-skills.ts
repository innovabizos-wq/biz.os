import "server-only";

import { z } from "zod";

import {
  searchBrainKnowledge,
  syncCoreBusinessKnowledge,
} from "@/modules/brain/knowledge-service";
import { defineBusinessSkill } from "@/modules/brain/runtime/contracts";
import { ok } from "@/types/core";

const searchInput = z.object({
  audience: z.enum(["customer", "internal", "agent", "system"]).default("internal"),
  limit: z.number().int().min(1).max(20).default(8),
  query: z.string().trim().min(2).max(2_000),
});
const searchOutput = z.object({
  hits: z.array(z.object({
    chunkId: z.string().uuid(),
    content: z.string(),
    documentId: z.string().uuid(),
    documentTitle: z.string(),
    freshnessAt: z.string(),
    score: z.number(),
    sourceId: z.string().uuid(),
    sourceName: z.string(),
    sourceUrl: z.string().nullable(),
  })),
});
const syncOutput = z.object({ results: z.array(z.record(z.string(), z.unknown())), sources: z.number() });

export function createBrainKnowledgeSkills() {
  return [
    defineBusinessSkill<z.infer<typeof searchInput>, z.infer<typeof searchOutput>>({
      description: "Busca datos autorizados de marca, FAQ, politicas, documentos y catalogo con evidencia y vigencia.",
      enabled: true,
      id: "brain.knowledge.search",
      idempotency: "none",
      inputSchema: searchInput,
      kind: "query",
      module: "brain",
      name: "Buscar conocimiento del negocio",
      outputSchema: searchOutput,
      requiredPermissions: ["brain.insights.view"],
      requiresConfirmation: false,
      risk: "low",
      version: "1.0.0",
      async execute(input, context) {
        const hits = await searchBrainKnowledge(context.tenant, input);
        return ok({
          data: { hits },
          evidence: hits.map((hit) => ({
            entityId: hit.documentId,
            entityType: "brain_knowledge_document",
            freshnessAt: hit.freshnessAt,
            href: hit.sourceUrl ?? undefined,
            source: hit.sourceName,
          })),
          links: hits.flatMap((hit) => hit.sourceUrl ? [{ href: hit.sourceUrl, label: hit.sourceName }] : []),
          message: hits.length ? `Encontre ${hits.length} fuente(s) autorizada(s).` : "No encontre conocimiento publicado para esa pregunta.",
        });
      },
    }),
    defineBusinessSkill<Record<string, never>, z.infer<typeof syncOutput>>({
      description: "Sincroniza el contexto de negocio y el catalogo activo con la base de conocimiento versionada.",
      enabled: true,
      id: "brain.knowledge.sync",
      idempotency: "none",
      inputSchema: z.object({}),
      kind: "command",
      module: "brain",
      name: "Sincronizar conocimiento del negocio",
      outputSchema: syncOutput,
      requiredPermissions: ["brain.settings.manage"],
      requiresConfirmation: true,
      risk: "medium",
      version: "1.0.0",
      async execute(_input, context) {
        const result = await syncCoreBusinessKnowledge(context.tenant);
        return ok({
          data: result,
          evidence: [{ count: result.sources, freshnessAt: new Date().toISOString(), source: "brain_knowledge_sources" }],
          links: [{ href: "/brain/configuracion", label: "Configurar Brain" }],
          message: `Conocimiento actualizado: ${result.sources} fuente(s).`,
        });
      },
    }),
  ];
}
