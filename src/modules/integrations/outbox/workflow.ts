import { processIntegrationOutboxBatch } from "./processor";

export async function processIntegrationOutboxBatchStep(limit: number) {
  "use step";
  return processIntegrationOutboxBatch(limit);
}

export async function integrationOutboxWorkflow(limit = 10) {
  "use workflow";
  return processIntegrationOutboxBatchStep(limit);
}
