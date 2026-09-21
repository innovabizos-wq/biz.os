import "server-only";

import { createHash } from "node:crypto";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { getBrainAiProviderSettings } from "@/modules/ai/conversation-layer-service";
import type { BrainAudience } from "@/modules/brain/runtime/contracts";
import { getBusinessContext } from "@/modules/business-context/queries";
import { getProducts } from "@/modules/catalog/queries";
import type { JsonRecord, TenantContext } from "@/types/core";

const EMBEDDING_DIMENSIONS = 768;
const MAX_CHUNK_CHARS = 2_400;
const CHUNK_OVERLAP_CHARS = 320;

export type BrainKnowledgeHit = {
  chunkId: string;
  content: string;
  documentId: string;
  documentTitle: string;
  freshnessAt: string;
  score: number;
  sourceId: string;
  sourceName: string;
  sourceUrl: string | null;
};

export type BrainKnowledgeDocumentInput = {
  content: string;
  externalKey: string;
  metadata?: JsonRecord;
  title: string;
};

export type BrainKnowledgeIngestInput = {
  audiences: BrainAudience[];
  documents: BrainKnowledgeDocumentInput[];
  metadata?: JsonRecord;
  name: string;
  provenance: string;
  sourceType: "approved_answer" | "brand" | "catalog" | "document" | "faq" | "policy" | "structured";
  sourceUrl?: string | null;
};

function assertKnowledgePermission(tenant: TenantContext, manage = false) {
  const permission = manage ? "brain.settings.manage" : "brain.insights.view";
  if (!hasPermission(tenant.permissions, permission)) {
    throw new Error(
      manage
        ? "No tienes permiso para administrar el conocimiento de Brain."
        : "No tienes permiso para consultar el conocimiento de Brain.",
    );
  }
}

function normalizedContent(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function stableChecksum(input: BrainKnowledgeIngestInput) {
  const canonical = JSON.stringify({
    audiences: [...new Set(input.audiences)].sort(),
    documents: input.documents
      .map((document) => ({
        content: normalizedContent(document.content),
        externalKey: document.externalKey,
        title: document.title.trim(),
      }))
      .sort((left, right) => left.externalKey.localeCompare(right.externalKey)),
    name: input.name.trim(),
    provenance: input.provenance.trim(),
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function chunkBrainKnowledge(content: string) {
  const text = normalizedContent(content);
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHUNK_CHARS) {
      if (current) chunks.push(current);
      current = "";
      for (let index = 0; index < paragraph.length; index += MAX_CHUNK_CHARS - CHUNK_OVERLAP_CHARS) {
        chunks.push(paragraph.slice(index, index + MAX_CHUNK_CHARS));
      }
      continue;
    }
    if (!current || current.length + paragraph.length + 2 <= MAX_CHUNK_CHARS) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    chunks.push(current);
    const overlap = current.slice(-CHUNK_OVERLAP_CHARS);
    current = `${overlap}\n\n${paragraph}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function googleEmbeddingModel() {
  const settingsResult = await getBrainAiProviderSettings();
  if (!settingsResult.ok || settingsResult.data.provider !== "gemini" || !settingsResult.data.apiKey) {
    return null;
  }
  const provider = createGoogleGenerativeAI({
    apiKey: settingsResult.data.apiKey,
    baseURL: settingsResult.data.baseUrl ?? undefined,
    name: "biz-brain-google-embeddings",
  });
  return provider.embeddingModel(
    process.env.BRAIN_GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
  );
}

async function embedDocuments(values: string[]) {
  const model = await googleEmbeddingModel();
  if (!model || values.length === 0) return values.map(() => null);
  const result = await embedMany({
    model,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_DOCUMENT",
      },
    },
    values,
  });
  return result.embeddings;
}

async function embedQuery(value: string) {
  const model = await googleEmbeddingModel();
  if (!model) return null;
  const result = await embed({
    model,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
      },
    },
    value,
  });
  return result.embedding;
}

export async function ingestBrainKnowledge(
  tenant: TenantContext,
  input: BrainKnowledgeIngestInput,
) {
  assertKnowledgePermission(tenant, true);
  if (input.documents.length === 0) throw new Error("La fuente no contiene documentos.");
  if (input.audiences.length === 0) throw new Error("La fuente necesita al menos una audiencia.");
  const checksum = stableChecksum(input);
  const supabase = await createClient();
  const existing = await supabase
    .from("brain_knowledge_sources")
    .select("id, checksum, status, version")
    .eq("empresa_id", tenant.empresaId)
    .eq("source_type", input.sourceType)
    .eq("name", input.name.trim())
    .maybeSingle<{ checksum: string | null; id: string; status: string; version: number }>();
  if (existing.error) throw new Error(`No se pudo consultar la fuente: ${existing.error.message}`);
  if (existing.data?.checksum === checksum && existing.data.status === "published") {
    return { changed: false, checksum, sourceId: existing.data.id, version: existing.data.version };
  }

  const now = new Date().toISOString();
  const nextVersion = (existing.data?.version ?? 0) + 1;
  const sourcePayload = {
    audiences: [...new Set(input.audiences)],
    checksum,
    created_by: tenant.profileId,
    empresa_id: tenant.empresaId,
    last_synced_at: now,
    metadata: input.metadata ?? {},
    name: input.name.trim(),
    provenance: input.provenance.trim(),
    source_type: input.sourceType,
    source_url: input.sourceUrl ?? null,
    status: "draft",
    version: nextVersion,
  };
  const source = existing.data
    ? await supabase
        .from("brain_knowledge_sources")
        .update(sourcePayload)
        .eq("id", existing.data.id)
        .eq("empresa_id", tenant.empresaId)
        .select("id")
        .single<{ id: string }>()
    : await supabase
        .from("brain_knowledge_sources")
        .insert(sourcePayload)
        .select("id")
        .single<{ id: string }>();
  if (source.error || !source.data) throw new Error(`No se pudo guardar la fuente: ${source.error?.message ?? "sin resultado"}`);

  try {
    await supabase
      .from("brain_knowledge_documents")
      .update({ effective_to: now })
      .eq("empresa_id", tenant.empresaId)
      .eq("source_id", source.data.id)
      .is("effective_to", null);

    let chunkCount = 0;
    for (const documentInput of input.documents) {
      const content = normalizedContent(documentInput.content);
      if (!content) continue;
      const document = await supabase
        .from("brain_knowledge_documents")
        .insert({
          audiences: [...new Set(input.audiences)],
          content,
          empresa_id: tenant.empresaId,
          external_key: documentInput.externalKey,
          metadata: documentInput.metadata ?? {},
          source_id: source.data.id,
          title: documentInput.title.trim(),
          version: nextVersion,
        })
        .select("id")
        .single<{ id: string }>();
      if (document.error || !document.data) throw new Error(document.error?.message ?? "No se creo el documento.");
      const chunks = chunkBrainKnowledge(content);
      const embeddings = await embedDocuments(chunks);
      const inserted = await supabase.from("brain_knowledge_chunks").insert(
        chunks.map((chunk, index) => ({
          audiences: [...new Set(input.audiences)],
          chunk_index: index,
          content: chunk,
          document_id: document.data.id,
          embedding: embeddings[index],
          empresa_id: tenant.empresaId,
          metadata: { externalKey: documentInput.externalKey },
          source_id: source.data.id,
          token_count: Math.ceil(chunk.length / 4),
        })),
      );
      if (inserted.error) throw new Error(inserted.error.message);
      chunkCount += chunks.length;
    }
    const published = await supabase
      .from("brain_knowledge_sources")
      .update({ published_at: now, status: "published" })
      .eq("id", source.data.id)
      .eq("empresa_id", tenant.empresaId);
    if (published.error) throw new Error(published.error.message);
    return { changed: true, checksum, chunkCount, sourceId: source.data.id, version: nextVersion };
  } catch (error) {
    await supabase
      .from("brain_knowledge_sources")
      .update({ metadata: { ...(input.metadata ?? {}), ingestionError: error instanceof Error ? error.message : "Error desconocido" }, status: "error" })
      .eq("id", source.data.id)
      .eq("empresa_id", tenant.empresaId);
    throw error;
  }
}

export async function searchBrainKnowledge(
  tenant: TenantContext,
  input: { audience?: BrainAudience; limit?: number; query: string },
): Promise<BrainKnowledgeHit[]> {
  assertKnowledgePermission(tenant);
  const query = input.query.trim();
  if (!query) return [];
  const embedding = await embedQuery(query);
  const supabase = await createClient();
  const result = await supabase.rpc("buscar_conocimiento_brain", {
    p_audience: input.audience ?? "internal",
    p_limit: Math.min(Math.max(input.limit ?? 8, 1), 20),
    p_query: query,
    p_query_embedding: embedding,
  });
  if (result.error) throw new Error(`No se pudo buscar conocimiento: ${result.error.message}`);
  return ((result.data ?? []) as Array<{
    chunk_id: string;
    content: string;
    document_id: string;
    document_title: string;
    freshness_at: string;
    score: number;
    source_id: string;
    source_name: string;
    source_url: string | null;
  }>).map((row) => ({
    chunkId: row.chunk_id,
    content: row.content,
    documentId: row.document_id,
    documentTitle: row.document_title,
    freshnessAt: row.freshness_at,
    score: Number(row.score),
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
  }));
}

export async function syncCoreBusinessKnowledge(tenant: TenantContext) {
  assertKnowledgePermission(tenant, true);
  const [contextResult, productsResult] = await Promise.all([
    getBusinessContext(tenant),
    hasPermission(tenant.permissions, "catalog.products.view")
      ? getProducts(tenant, "todos", "activo")
      : Promise.resolve(null),
  ]);
  if (!contextResult.ok) throw new Error(contextResult.error.message);
  const context = contextResult.data;
  const results = [];
  if (context) {
    const customerSafe = {
      brandPersonality: context.brandPersonality,
      businessHours: context.businessHours,
      businessSummary: context.businessSummary,
      customerServiceRules: context.customerServiceRules,
      differentiators: context.differentiators,
      geographicScope: context.geographicScope,
      mainOffers: context.mainOffers,
      mission: context.mission,
      preferredCta: context.preferredCta,
      pricingNotes: context.pricingNotes,
      productsServices: context.productsServices,
      requiredDisclaimers: context.requiredDisclaimers,
      serviceAreas: context.serviceAreas,
      serviceProcess: context.serviceProcess,
      targetAudience: context.targetAudience,
      toneOfVoice: context.toneOfVoice,
    };
    results.push(await ingestBrainKnowledge(tenant, {
      audiences: ["customer", "internal", "agent"],
      documents: [{ content: JSON.stringify(customerSafe, null, 2), externalKey: "business-public-context", title: "Contexto publico y marca" }],
      name: "Contexto publico del negocio",
      provenance: "business_context",
      sourceType: "brand",
    }));
    results.push(await ingestBrainKnowledge(tenant, {
      audiences: ["internal", "agent", "system"],
      documents: [{ content: JSON.stringify(context, null, 2), externalKey: "business-internal-context", title: "Contexto operativo interno" }],
      name: "Contexto interno del negocio",
      provenance: "business_context",
      sourceType: "policy",
    }));
  }
  if (productsResult?.ok) {
    results.push(await ingestBrainKnowledge(tenant, {
      audiences: ["customer", "internal", "agent"],
      documents: productsResult.data.map((product) => ({
        content: JSON.stringify(product, null, 2),
        externalKey: product.id,
        title: product.nombre,
      })),
      name: "Catalogo activo",
      provenance: "catalogo_productos",
      sourceType: "catalog",
    }));
  }
  return { results, sources: results.length };
}
