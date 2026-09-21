import "server-only";

import type { z } from "zod";

import { getConversationAction } from "@/lib/ai/action-registry";
import type {
  BrainEvidence,
  BrainResultLink,
  BusinessSkillDefinition,
  BusinessSkillKind,
  BusinessSkillRisk,
} from "@/modules/brain/runtime/contracts";
import { defineBusinessSkill } from "@/modules/brain/runtime/contracts";
import type { CoreResult, JsonRecord, ModuleCode, PermissionCode } from "@/types/core";
import { fail, ok } from "@/types/core";

type LegacyActionSkillAdapterInput<
  TInput extends JsonRecord,
  TOutput extends JsonRecord,
> = {
  actionId: string;
  description: string;
  evidence?: (output: TOutput) => BrainEvidence[];
  id: string;
  idempotency?: "none" | "required";
  inputSchema: z.ZodType<TInput>;
  kind: BusinessSkillKind;
  links?: (output: TOutput) => BrainResultLink[];
  module: ModuleCode;
  name: string;
  outputSchema: z.ZodType<TOutput>;
  requiredPermissions: PermissionCode[];
  requiresConfirmation?: boolean;
  risk: BusinessSkillRisk;
  version?: string;
};

export function adaptConversationActionToBusinessSkill<
  TInput extends JsonRecord,
  TOutput extends JsonRecord,
>(
  input: LegacyActionSkillAdapterInput<TInput, TOutput>,
): BusinessSkillDefinition {
  return defineBusinessSkill<TInput, TOutput>({
    description: input.description,
    enabled: true,
    id: input.id,
    idempotency: input.idempotency ?? "none",
    inputSchema: input.inputSchema,
    kind: input.kind,
    legacyActionId: input.actionId,
    module: input.module,
    name: input.name,
    outputSchema: input.outputSchema,
    requiredPermissions: input.requiredPermissions,
    requiresConfirmation: input.requiresConfirmation ?? false,
    risk: input.risk,
    version: input.version ?? "1.0.0",
    async execute(params, context): Promise<CoreResult<{
      data: TOutput;
      evidence?: BrainEvidence[];
      links?: BrainResultLink[];
      message: string;
    }>> {
      const action = getConversationAction(input.actionId);
      if (!action) {
        return fail(
          "MODULE_MISCONFIGURED",
          `No existe la accion heredada ${input.actionId}.`,
        );
      }

      try {
        const result = await action.handler(params, { tenant: context.tenant });
        const parsed = input.outputSchema.safeParse(result.result);
        if (!parsed.success) {
          return fail(
            "VALIDATION_ERROR",
            `La accion heredada ${input.actionId} devolvio una salida invalida.`,
            parsed.error.flatten(),
          );
        }

        return ok({
          data: parsed.data,
          evidence: input.evidence?.(parsed.data),
          links: input.links?.(parsed.data),
          message: result.message,
        });
      } catch (error) {
        return fail(
          "MODULE_MISCONFIGURED",
          error instanceof Error ? error.message : "Fallo la accion heredada.",
          error,
        );
      }
    },
  });
}

export function asJsonRecord<T extends JsonRecord>(value: T): JsonRecord {
  return value;
}
