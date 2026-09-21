import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  BrainSkillExecutionStore,
  BusinessSkillResult,
} from "@/modules/brain/runtime/contracts";
import type { JsonRecord } from "@/types/core";
import { fail, ok } from "@/types/core";

type ExecutionRow = {
  input_hash: string;
  result: JsonRecord | null;
  status: "failed" | "running" | "succeeded";
};

export const brainSkillExecutionStore: BrainSkillExecutionStore = {
  async claim(input) {
    const supabase = await createClient();
    const { error } = await supabase.from("brain_skill_executions").insert({
      empresa_id: input.empresaId,
      idempotency_key: input.idempotencyKey,
      input_hash: input.inputHash,
      invocation_id: input.invocationId,
      skill_id: input.skillId,
      status: "running",
      usuario_id: input.profileId,
    });

    if (!error) return ok({ status: "claimed" });
    if (error.code !== "23505") {
      return fail(
        "MODULE_MISCONFIGURED",
        "No se pudo registrar la ejecucion idempotente de Brain.",
        error,
      );
    }

    const { data, error: lookupError } = await supabase
      .from("brain_skill_executions")
      .select("input_hash, result, status")
      .eq("empresa_id", input.empresaId)
      .eq("usuario_id", input.profileId)
      .eq("skill_id", input.skillId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (lookupError || !data) {
      return fail(
        "MODULE_MISCONFIGURED",
        "No se pudo recuperar la ejecucion idempotente de Brain.",
        lookupError,
      );
    }

    const row = data as ExecutionRow;
    if (row.input_hash !== input.inputHash) {
      return fail(
        "IDEMPOTENCY_CONFLICT",
        "La clave de idempotencia ya fue usada con una entrada diferente.",
      );
    }

    if (row.status === "succeeded" && row.result) {
      return ok({
        cachedResult: row.result as unknown as BusinessSkillResult,
        status: "completed",
      });
    }

    return fail(
      "IDEMPOTENCY_CONFLICT",
      row.status === "running"
        ? "Esta Business Skill ya se esta ejecutando."
        : "La ejecucion anterior fallo; utiliza una nueva clave para reintentar.",
    );
  },

  async complete(input) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("brain_skill_executions")
      .update({
        completed_at: new Date().toISOString(),
        error: null,
        result: input.result as unknown as JsonRecord,
        status: "succeeded",
      })
      .eq("empresa_id", input.empresaId)
      .eq("usuario_id", input.profileId)
      .eq("skill_id", input.skillId)
      .eq("idempotency_key", input.idempotencyKey)
      .eq("status", "running");

    if (error) {
      return fail(
        "MODULE_MISCONFIGURED",
        "La Skill termino, pero no se pudo cerrar su registro idempotente.",
        error,
      );
    }

    return ok(null);
  },

  async fail(input) {
    const supabase = await createClient();
    await supabase
      .from("brain_skill_executions")
      .update({
        completed_at: new Date().toISOString(),
        error: input.error,
        status: "failed",
      })
      .eq("empresa_id", input.empresaId)
      .eq("usuario_id", input.profileId)
      .eq("skill_id", input.skillId)
      .eq("idempotency_key", input.idempotencyKey)
      .eq("status", "running");
  },
};
