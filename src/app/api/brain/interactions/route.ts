import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { brain } from "@/modules/brain/interaction-api";

const agentIds = z.enum(["compras", "contenido", "finanzas", "inventario", "logistica", "marketing", "operaciones", "rrhh", "soporte", "ventas"]);
const schema = z.discriminatedUnion("operation", [
  z.object({ conversationId: z.string().uuid().optional(), currentModule: z.string().max(80).nullish(), currentPath: z.string().max(500).nullish(), message: z.string().trim().min(1).max(8_000), operation: z.literal("ask") }),
  z.object({ currentModule: z.string().max(80).nullish(), limit: z.number().int().min(1).max(30).optional(), message: z.string().trim().min(1).max(8_000), operation: z.literal("suggest") }),
  z.object({ approval: z.object({ confirmed: z.boolean(), reference: z.string().max(200).optional() }).optional(), capabilityId: z.string().trim().min(3).max(200), idempotencyKey: z.string().max(300).optional(), operation: z.literal("invoke"), skillInput: z.record(z.string(), z.unknown()).optional() }),
  z.object({ capabilityId: z.string().trim().min(3).max(200).optional(), maxConcurrency: z.number().int().min(1).max(5).optional(), objective: z.string().trim().min(3).max(8_000), operation: z.literal("startRun"), requestedAgents: z.array(agentIds).max(5).optional(), requestedTeam: z.boolean().optional(), skillInput: z.record(z.string(), z.unknown()).optional() }),
]);

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ details: body.error.flatten(), error: "Interaccion invalida." }, { status: 400 });
  try {
    if (body.data.operation === "ask") return NextResponse.json(await brain.ask({ ...body.data, tenant: tenant.data }));
    if (body.data.operation === "suggest") return NextResponse.json({ capabilities: brain.suggest({ ...body.data, tenant: tenant.data }) });
    if (body.data.operation === "invoke") return NextResponse.json(await brain.invoke({ ...body.data, tenant: tenant.data }));
    return NextResponse.json(await brain.startRun({ ...body.data, tenant: tenant.data }), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Brain no pudo completar la interaccion." }, { status: 400 });
  }
}
