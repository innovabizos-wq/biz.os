import { z } from "zod";

export const brainInsightSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const brainRecommendationTypeSchema = z.enum([
  "commercial",
  "operational",
  "inventory",
  "collections",
  "service",
  "management",
  "data_quality",
]);

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const runBrainAnalysisSchema = z.object({
  intent: z.literal("analyze-business"),
});

export const brainRecommendationIdSchema = z.object({
  id: z.string().uuid(),
});

export const brainActionPlanIdSchema = z.object({
  id: z.string().uuid(),
});

export const brainQuestionRequestSchema = z.object({
  question: z.string().trim().min(1).optional(),
});

export const brainAnalystOutputSchema = z.object({
  actionId: z.string().trim().min(1).nullable(),
  approvalRequired: z.boolean(),
  evidence: jsonRecordSchema,
  expectedImpact: z.string().trim().nullable(),
  modules: z.array(z.string().trim().min(1)),
  priorityScore: z.number().min(0).max(100),
  recommendation: z.string().trim().min(1),
  recommendationType: brainRecommendationTypeSchema,
  risk: brainInsightSeveritySchema,
  severity: brainInsightSeveritySchema,
  title: z.string().trim().min(1),
  type: z.enum([
    "opportunity",
    "risk",
    "anomaly",
    "performance",
    "process",
    "data_quality",
    "customer_signal",
  ]),
});
