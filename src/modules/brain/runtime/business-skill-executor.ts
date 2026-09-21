import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type {
  BrainPolicyEngine,
  BrainSkillTraceRecorder,
  BrainSkillExecutionStore,
  BusinessSkillInvocation,
  BusinessSkillExecutor,
  BusinessSkillRegistry,
  BusinessSkillResult,
} from "@/modules/brain/runtime/contracts";
import {
  createBrainPolicyEngine,
  requiresBrainApproval,
} from "@/modules/brain/runtime/policy-engine";
import { brainSkillTraceRecorder } from "@/modules/brain/runtime/trace-recorder";
import {
  getBrainSkillBlockReason,
  recordBrainSkillHealth,
} from "@/modules/brain/runtime/skill-health-service";
import type { CoreResult, JsonRecord } from "@/types/core";
import { fail, ok } from "@/types/core";

function elapsed(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function inputHash(value: JsonRecord) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function createBusinessSkillExecutor(
  registry: BusinessSkillRegistry,
  policy: BrainPolicyEngine = createBrainPolicyEngine(),
  traces: BrainSkillTraceRecorder = brainSkillTraceRecorder,
  executions?: BrainSkillExecutionStore,
): BusinessSkillExecutor {
  return {
    async invoke<TOutput = JsonRecord>(invocation: BusinessSkillInvocation): Promise<
      CoreResult<BusinessSkillResult<TOutput>>
    > {
      const startedAt = performance.now();
      const invocationId = invocation.source.correlationId ?? randomUUID();
      const skill = registry.get(invocation.skillId);

      if (!skill) {
        return fail(
          "VALIDATION_ERROR",
          `La Business Skill no existe: ${invocation.skillId}.`,
        );
      }

      const healthBlock = await getBrainSkillBlockReason(invocation.tenant, skill.id);
      if (healthBlock) {
        return fail("MODULE_MISCONFIGURED", healthBlock);
      }

      const decision = policy.authorize(invocation.tenant, skill);
      if (!decision.ok) {
        await traces.record({
          durationMs: elapsed(startedAt),
          errorCode: decision.error.code,
          invocationId,
          occurredAt: new Date().toISOString(),
          skillId: skill.id,
          source: invocation.source,
          status: "blocked",
          tenant: invocation.tenant,
        });
        return decision;
      }

      const parsedInput = skill.inputSchema.safeParse(invocation.input ?? {});
      if (!parsedInput.success) {
        await traces.record({
          durationMs: elapsed(startedAt),
          errorCode: "VALIDATION_ERROR",
          invocationId,
          occurredAt: new Date().toISOString(),
          skillId: skill.id,
          source: invocation.source,
          status: "blocked",
          tenant: invocation.tenant,
        });
        return fail(
          "VALIDATION_ERROR",
          "La entrada de la Business Skill no cumple el contrato.",
          parsedInput.error.flatten(),
        );
      }

      if (requiresBrainApproval(skill) && !invocation.approval?.confirmed) {
        await traces.record({
          durationMs: elapsed(startedAt),
          errorCode: "CONFIRMATION_REQUIRED",
          invocationId,
          occurredAt: new Date().toISOString(),
          skillId: skill.id,
          source: invocation.source,
          status: "blocked",
          tenant: invocation.tenant,
        });
        return fail(
          "CONFIRMATION_REQUIRED",
          `La Business Skill ${skill.name} requiere confirmacion explicita.`,
        );
      }

      const idempotencyKey = invocation.idempotencyKey?.trim();
      if (skill.idempotency === "required" && !idempotencyKey) {
        return fail(
          "VALIDATION_ERROR",
          `La Business Skill ${skill.name} requiere una clave de idempotencia.`,
        );
      }

      if (skill.idempotency === "required" && !executions) {
        return fail(
          "MODULE_MISCONFIGURED",
          "Brain Runtime no tiene configurado el registro de idempotencia.",
        );
      }

      if (idempotencyKey && executions) {
        const claim = await executions.claim({
          empresaId: invocation.tenant.empresaId,
          idempotencyKey,
          inputHash: inputHash(parsedInput.data),
          invocationId,
          profileId: invocation.tenant.profileId,
          skillId: skill.id,
        });
        if (!claim.ok) return claim;
        if (claim.data.status === "completed" && claim.data.cachedResult) {
          const cached = {
            ...claim.data.cachedResult,
            cached: true,
          } as BusinessSkillResult<TOutput>;
          await traces.record({
            durationMs: elapsed(startedAt),
            invocationId,
            occurredAt: new Date().toISOString(),
            skillId: skill.id,
            source: invocation.source,
            status: "success",
            tenant: invocation.tenant,
          });
          return ok(cached);
        }
      }

      try {
        const execution = await skill.execute(parsedInput.data, {
          idempotencyKey,
          invocationId,
          source: invocation.source,
          tenant: invocation.tenant,
        });

        if (!execution.ok) {
          await recordBrainSkillHealth({
            error: { code: execution.error.code, message: execution.error.message },
            skillId: skill.id,
            success: false,
            tenant: invocation.tenant,
          });
          if (idempotencyKey && executions) {
            await executions.fail({
              empresaId: invocation.tenant.empresaId,
              error: {
                code: execution.error.code,
                message: execution.error.message,
              },
              idempotencyKey,
              profileId: invocation.tenant.profileId,
              skillId: skill.id,
            });
          }
          await traces.record({
            durationMs: elapsed(startedAt),
            errorCode: execution.error.code,
            invocationId,
            occurredAt: new Date().toISOString(),
            skillId: skill.id,
            source: invocation.source,
            status: "error",
            tenant: invocation.tenant,
          });
          return execution;
        }

        const parsedOutput = skill.outputSchema.safeParse(execution.data.data);
        if (!parsedOutput.success) {
          await recordBrainSkillHealth({
            error: { code: "VALIDATION_ERROR", message: "La salida no cumple el contrato." },
            skillId: skill.id,
            success: false,
            tenant: invocation.tenant,
          });
          if (idempotencyKey && executions) {
            await executions.fail({
              empresaId: invocation.tenant.empresaId,
              error: {
                code: "VALIDATION_ERROR",
                message: "La salida de la Business Skill no cumple el contrato.",
              },
              idempotencyKey,
              profileId: invocation.tenant.profileId,
              skillId: skill.id,
            });
          }
          await traces.record({
            durationMs: elapsed(startedAt),
            errorCode: "VALIDATION_ERROR",
            invocationId,
            occurredAt: new Date().toISOString(),
            skillId: skill.id,
            source: invocation.source,
            status: "error",
            tenant: invocation.tenant,
          });
          return fail(
            "VALIDATION_ERROR",
            "La salida de la Business Skill no cumple el contrato.",
            parsedOutput.error.flatten(),
          );
        }

        const durationMs = elapsed(startedAt);
        const executedAt = new Date().toISOString();
        await traces.record({
          durationMs,
          invocationId,
          occurredAt: executedAt,
          skillId: skill.id,
          source: invocation.source,
          status: "success",
          tenant: invocation.tenant,
        });
        await recordBrainSkillHealth({
          skillId: skill.id,
          success: true,
          tenant: invocation.tenant,
        });

        const result: BusinessSkillResult<TOutput> = {
          cached: false,
          data: parsedOutput.data as TOutput,
          durationMs,
          evidence: execution.data.evidence ?? [],
          executedAt,
          invocationId,
          links: execution.data.links ?? [],
          message: execution.data.message,
          skillId: skill.id,
        };

        if (idempotencyKey && executions) {
          const completed = await executions.complete({
            empresaId: invocation.tenant.empresaId,
            idempotencyKey,
            profileId: invocation.tenant.profileId,
            result: result as BusinessSkillResult<JsonRecord>,
            skillId: skill.id,
          });
          if (!completed.ok) return completed;
        }

        return ok(result);
      } catch (error) {
        await recordBrainSkillHealth({
          error: { message: error instanceof Error ? error.message : "Error desconocido" },
          skillId: skill.id,
          success: false,
          tenant: invocation.tenant,
        });
        if (idempotencyKey && executions) {
          await executions.fail({
            empresaId: invocation.tenant.empresaId,
            error: {
              message:
                error instanceof Error ? error.message : "Error desconocido",
            },
            idempotencyKey,
            profileId: invocation.tenant.profileId,
            skillId: skill.id,
          });
        }
        await traces.record({
          durationMs: elapsed(startedAt),
          errorCode: "MODULE_MISCONFIGURED",
          invocationId,
          occurredAt: new Date().toISOString(),
          skillId: skill.id,
          source: invocation.source,
          status: "error",
          tenant: invocation.tenant,
        });
        return fail(
          "MODULE_MISCONFIGURED",
          error instanceof Error
            ? error.message
            : "No se pudo ejecutar la Business Skill.",
          error,
        );
      }
    },
  };
}
