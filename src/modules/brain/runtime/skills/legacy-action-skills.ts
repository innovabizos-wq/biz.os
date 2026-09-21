import "server-only";

import { z } from "zod";

import { conversationActionRegistry } from "@/lib/ai/action-registry/registry";
import { adaptConversationActionToBusinessSkill } from "@/modules/brain/runtime/adapters/conversation-action-skill-adapter";
import type {
  BusinessSkillDefinition,
  BusinessSkillKind,
} from "@/modules/brain/runtime/contracts";
import type { JsonRecord, ModuleCode } from "@/types/core";

const skillIds: Record<string, string> = {
  "agenda.crear_tarea": "agenda.task.create",
  "autoblog.generar_articulo": "autoblog.article.generate",
  "brain.actualizar_contexto": "brain.context.open",
  "brain.generar_analisis": "brain.analysis.run",
  "brain.responder_pregunta": "brain.question.answer",
  "clientes.buscar_cliente": "crm.customer.search",
  "clientes.crear_cliente": "crm.customer.create",
  "compras.consultar_ordenes": "purchases.order.query",
  "compras.preparar_sugerencia_compra": "purchases.reorder.suggest",
  "despacho.consultar_pendientes": "dispatch.pending.query",
  "facturacion.preparar_borrador": "billing.draft.prepare",
  "inbox.preparar_respuesta": "inbox.reply.draft",
  "inventario.consultar_stock": "inventory.stock.query",
  "inventario.sugerir_reorden": "inventory.reorder.suggest",
  "pagos.consultar_vencidos": "payments.overdue.query",
  "pagos.consultar_cuentas_pagar": "payments.payable.query",
  "pagos.crear_recordatorio_cobro": "payments.collection-reminder.create",
  "productos.buscar_producto": "catalog.product.search",
  "productos.crear_producto": "catalog.product.create",
  "proformas.crear_borrador": "quotes.draft.create",
  "ventas.buscar_ventas": "sales.summary.query",
};

const genericOutputSchema = z.record(z.string(), z.unknown());

function skillKind(mode: "draft" | "read" | "write"): BusinessSkillKind {
  if (mode === "read") return "query";
  if (mode === "draft") return "draft";
  return "command";
}

export function createLegacyConversationBusinessSkills(
  excludedLegacyActionIds: readonly string[] = [],
): BusinessSkillDefinition[] {
  const excluded = new Set(excludedLegacyActionIds);

  return conversationActionRegistry
    .filter((action) => !excluded.has(action.id))
    .map((action) => {
      const id = skillIds[action.id];
      if (!id || action.module === "dashboard") {
        throw new Error(`Falta mapear la accion ${action.id} como Business Skill.`);
      }

      return adaptConversationActionToBusinessSkill({
        actionId: action.id,
        description: action.description,
        id,
        idempotency: action.executionMode === "read" ? "none" : "required",
        inputSchema: action.schema as z.ZodType<JsonRecord>,
        kind: skillKind(action.executionMode),
        module: action.module as ModuleCode,
        name: action.name,
        outputSchema: genericOutputSchema,
        requiredPermissions: action.requiredPermissions,
        requiresConfirmation: action.requiresConfirmation,
        risk: action.risk,
      });
    });
}

export function getBusinessSkillIdForLegacyAction(actionId: string) {
  return skillIds[actionId] ?? null;
}
