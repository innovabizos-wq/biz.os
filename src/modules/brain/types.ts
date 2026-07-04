import type { JsonRecord } from "@/types/core";

export type BrainInsightSeverity = "low" | "medium" | "high" | "critical";
export type BrainInsightStatus = "active" | "dismissed" | "resolved" | "expired";
export type BrainInsightType =
  | "opportunity"
  | "risk"
  | "anomaly"
  | "performance"
  | "process"
  | "data_quality"
  | "customer_signal";

export type BrainRecommendationRisk = "low" | "medium" | "high" | "critical";
export type BrainRecommendationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "scheduled"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";
export type BrainRecommendationType =
  | "commercial"
  | "operational"
  | "inventory"
  | "collections"
  | "service"
  | "management"
  | "data_quality";

export type BrainDailyMetrics = {
  businessContextReady: boolean;
  createdAt: string;
  crmCustomersCount: number;
  crmProspectsCount: number;
  followupsOverdueCount: number;
  followupsPendingCount: number;
  id: string;
  inventoryLowStockCount: number;
  metricDate: string;
  paymentsOverdueCount: number;
  quotesExpiredCount: number;
  quotesOpenCount: number;
  runId: string | null;
  sales30dCount: number;
  sales30dTotal: number;
  whappOpenConversationsCount: number;
};

export type BrainInsight = {
  createdAt: string;
  description: string;
  evidence: JsonRecord;
  id: string;
  insightType: BrainInsightType;
  resolvedAt: string | null;
  runId: string | null;
  severity: BrainInsightSeverity;
  source: string;
  status: BrainInsightStatus;
  title: string;
};

export type BrainRecommendation = {
  actionId: string | null;
  approvalRequired: boolean;
  createdAt: string;
  description: string;
  evidence: JsonRecord;
  expectedImpact: string | null;
  id: string;
  insightId: string | null;
  priorityScore: number;
  recommendationType: BrainRecommendationType;
  riskLevel: BrainRecommendationRisk;
  sourceModules: string[];
  status: BrainRecommendationStatus;
  title: string;
  updatedAt: string;
};

export type BrainAnalysisResult = {
  actionPlansCreated?: number;
  insightsCreated: number;
  recommendationsCreated: number;
  runId: string;
  signalsCreated?: number;
};

export type BrainSignal = {
  createdAt: string;
  description: string;
  detectedAt: string;
  entityId: string | null;
  entityType: string | null;
  evidence: JsonRecord;
  expiresAt: string | null;
  id: string;
  moduleCode: string;
  runId: string | null;
  severity: BrainInsightSeverity;
  signalType: string;
  status: "active" | "expired" | "resolved";
  title: string;
  updatedAt: string;
};

export type BrainMemory = {
  confidence: number;
  content: JsonRecord;
  createdAt: string;
  id: string;
  memoryType:
    | "business_context"
    | "customer_pattern"
    | "operational_pattern"
    | "preference"
    | "rule"
    | "system_note";
  sourceModules: string[];
  status: "active" | "archived";
  title: string;
  updatedAt: string;
};

export type BrainActionPlanStatus =
  | "approved"
  | "cancelled"
  | "completed"
  | "draft"
  | "executing"
  | "failed"
  | "pending_approval"
  | "rejected";

export type BrainPlanStepStatus =
  | "approved"
  | "completed"
  | "confirmation_required"
  | "executing"
  | "failed"
  | "pending"
  | "skipped";

export type BrainPlanStep = {
  actionId: string;
  createdAt: string;
  description: string | null;
  executedAt: string | null;
  id: string;
  payload: JsonRecord;
  planId: string;
  requiresConfirmation: boolean;
  result: JsonRecord;
  status: BrainPlanStepStatus;
  stepOrder: number;
  title: string;
  updatedAt: string;
};

export type BrainActionPlan = {
  approvalRequired: boolean;
  approvedAt: string | null;
  createdAt: string;
  description: string;
  expectedImpact: string | null;
  id: string;
  recommendationId: string | null;
  riskLevel: BrainRecommendationRisk;
  sourceModules: string[];
  status: BrainActionPlanStatus;
  steps: BrainPlanStep[];
  title: string;
  updatedAt: string;
};
