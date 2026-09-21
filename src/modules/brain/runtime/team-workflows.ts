import type { BrainTeamWorkflowInput } from "./team-steps";
import {
  executeBrainTeamTaskStep,
  setBrainTeamStatusStep,
} from "./team-steps";

export async function brainTeamWorkflow(input: BrainTeamWorkflowInput) {
  "use workflow";
  await setBrainTeamStatusStep(input, "running");
  const pending = [...input.plan.tasks];
  const outputs: Record<string, unknown> = {};
  const failed = new Set<string>();

  while (pending.length > 0) {
    const blocked = pending.filter((task) =>
      task.dependsOn.some((dependency) => failed.has(dependency)),
    );
    for (const task of blocked) {
      failed.add(task.id);
      pending.splice(pending.indexOf(task), 1);
    }

    const ready = pending
      .filter((task) => task.dependsOn.every((dependency) => dependency in outputs))
      .slice(0, input.plan.maxConcurrency);
    if (ready.length === 0) {
      await setBrainTeamStatusStep(input, "failed", {
        error: "El plan del equipo contiene dependencias imposibles o tareas bloqueadas.",
        failed: [...failed],
        outputs,
      });
      return { failed: [...failed], outputs, status: "failed" as const };
    }

    const results = await Promise.all(
      ready.map((task) =>
        executeBrainTeamTaskStep(
          input,
          task,
          Object.fromEntries(task.dependsOn.map((dependency) => [dependency, outputs[dependency]])),
        ),
      ),
    );
    for (const result of results) {
      const task = ready.find((candidate) => candidate.id === result.taskId);
      if (task) pending.splice(pending.indexOf(task), 1);
      if (result.ok) outputs[result.taskId] = result.output;
      else failed.add(result.taskId);
    }
  }

  const status = failed.size > 0 ? "failed" as const : "completed" as const;
  await setBrainTeamStatusStep(input, status, { failed: [...failed], outputs });
  return { failed: [...failed], outputs, status };
}
