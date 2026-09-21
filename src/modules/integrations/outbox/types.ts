import type { JsonRecord } from "@/types/core";

export type IntegrationOutboxStatus = "queued" | "processing" | "retry" | "succeeded" | "dead";

export type IntegrationOutboxJob = {
  aggregateId: string | null;
  aggregateType: string | null;
  attempts: number;
  availableAt: string;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  empresaId: string;
  id: string;
  lastError: string | null;
  leaseToken: string;
  maxAttempts: number;
  payload: JsonRecord;
  result: JsonRecord | null;
  status: IntegrationOutboxStatus;
  topic: string;
  updatedAt: string;
};

export type IntegrationOutboxJobSummary = Omit<
  IntegrationOutboxJob,
  "createdBy" | "empresaId" | "leaseToken" | "payload"
>;

export type IntegrationOutboxBatchResult = {
  claimed: number;
  dead: number;
  retried: number;
  succeeded: number;
};
