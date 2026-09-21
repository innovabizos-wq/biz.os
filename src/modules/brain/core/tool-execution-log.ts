import type {
  BrainToolExecutionRecord,
  BrainToolExecutionRecorder,
} from "@/modules/brain/core/contracts";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

export function createBrainToolExecutionRecorder(
  initialRecords: BrainToolExecutionRecord[] = [],
): BrainToolExecutionRecorder {
  const records = [...initialRecords];

  return {
    list() {
      return [...records];
    },
    record(event): CoreResult<BrainToolExecutionRecord> {
      records.push(event);
      return ok(event);
    },
  };
}

export const brainToolExecutionRecorder = createBrainToolExecutionRecorder();
