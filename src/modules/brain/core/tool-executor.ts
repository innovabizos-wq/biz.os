import { hasEveryPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type {
  BrainToolExecutionRecorder,
  BrainToolExecutionRequest,
  BrainToolExecutionResponse,
  BrainToolExecutor,
  BrainToolRegistry,
} from "@/modules/brain/core/contracts";
import { brainToolExecutionRecorder } from "@/modules/brain/core/tool-execution-log";
import { brainToolRegistry } from "@/modules/brain/core/tool-registry";
import type { CoreResult, JsonRecord } from "@/types/core";
import { fail, ok } from "@/types/core";

function createExecutionId() {
  return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getDurationMs(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido.";
}

function recordExecution(
  recorder: BrainToolExecutionRecorder,
  input: BrainToolExecutionRequest,
  executionId: string,
  durationMs: number,
  status: "error" | "success",
  result: JsonRecord | null,
  error: string | null,
) {
  recorder.record({
    arguments: input.arguments ?? {},
    companyId: input.tenant.empresaId,
    createdAt: new Date().toISOString(),
    durationMs,
    error,
    id: executionId,
    result,
    status,
    toolId: input.toolId,
    userId: input.tenant.profileId,
  });
}

export function createBrainToolExecutor(
  registry: BrainToolRegistry = brainToolRegistry,
  recorder: BrainToolExecutionRecorder = brainToolExecutionRecorder,
): BrainToolExecutor {
  return {
    async execute(input): Promise<CoreResult<BrainToolExecutionResponse>> {
      const startedAt = performance.now();
      const executionId = input.callId ?? createExecutionId();
      const args = input.arguments ?? {};

      if (!input.tenant.profileId) {
        const message = "Usuario autenticado requerido para ejecutar herramientas.";
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("AUTH_NOT_CONNECTED", message);
      }

      if (!input.tenant.empresaId) {
        const message = "Empresa activa requerida para ejecutar herramientas.";
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("INVALID_TENANT_CONTEXT", message);
      }

      const tool = registry.get(input.toolId);

      if (!tool) {
        const message = `La herramienta Brain no existe: ${input.toolId}.`;
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("VALIDATION_ERROR", message);
      }

      if (!tool.enabled) {
        const message = `La herramienta Brain esta deshabilitada: ${tool.id}.`;
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("PERMISSION_DENIED", message);
      }

      if (!isModuleActive(input.tenant.activeModules, tool.module)) {
        const message = `El modulo requerido no esta activo: ${tool.module}.`;
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("MODULE_INACTIVE", message);
      }

      if (!hasEveryPermission(input.tenant.permissions, tool.requiredPermissions)) {
        const message = "No tienes permisos para ejecutar esta herramienta.";
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("PERMISSION_DENIED", message);
      }

      const parsedInput = tool.inputSchema.safeParse(args);

      if (!parsedInput.success) {
        const message = "La entrada de la herramienta no cumple el contrato.";
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("VALIDATION_ERROR", message, parsedInput.error);
      }

      try {
        const result = await tool.execute({
          arguments: parsedInput.data,
          callId: executionId,
          tenant: input.tenant,
        });

        if (!result.ok) {
          recordExecution(
            recorder,
            input,
            executionId,
            getDurationMs(startedAt),
            "error",
            null,
            result.error.message,
          );
          return result;
        }

        const parsedOutput = tool.outputSchema.safeParse(result.data.data);

        if (!parsedOutput.success) {
          const message = "La salida de la herramienta no cumple el contrato.";
          recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
          return fail("VALIDATION_ERROR", message, parsedOutput.error);
        }

        const durationMs = getDurationMs(startedAt);
        recordExecution(recorder, input, executionId, durationMs, "success", parsedOutput.data, null);

        return ok({
          data: parsedOutput.data,
          durationMs,
          executionId,
          metadata: result.data.metadata,
          status: "success",
          toolId: tool.id,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        recordExecution(recorder, input, executionId, getDurationMs(startedAt), "error", null, message);
        return fail("MODULE_MISCONFIGURED", message, error);
      }
    },
  };
}

export const brainToolExecutor = createBrainToolExecutor();
