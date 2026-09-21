import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  ingestBrainKnowledge,
  searchBrainKnowledge,
} from "@/modules/brain/knowledge-service";

const ingestSchema = z.object({
  audiences: z.array(z.enum(["customer", "internal", "agent", "system"])).min(1),
  documents: z.array(z.object({
    content: z.string().trim().min(1).max(500_000),
    externalKey: z.string().trim().min(1).max(200),
    metadata: z.record(z.string(), z.unknown()).optional(),
    title: z.string().trim().min(1).max(300),
  })).min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
  name: z.string().trim().min(1).max(200),
  provenance: z.string().trim().min(1).max(300),
  sourceType: z.enum(["approved_answer", "brand", "catalog", "document", "faq", "policy", "structured"]),
  sourceUrl: z.string().url().nullable().optional(),
});

export async function GET(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const audience = z.enum(["customer", "internal", "agent", "system"]).catch("internal").parse(url.searchParams.get("audience"));
  if (!query) return NextResponse.json({ error: "La consulta es requerida." }, { status: 400 });
  try {
    return NextResponse.json({ hits: await searchBrainKnowledge(tenant.data, { audience, query }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo buscar conocimiento." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const body = ingestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ details: body.error.flatten(), error: "Fuente invalida." }, { status: 400 });
  try {
    return NextResponse.json(await ingestBrainKnowledge(tenant.data, body.data), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ingerir la fuente." }, { status: 400 });
  }
}
