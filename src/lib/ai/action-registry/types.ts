import type { z } from "zod";

import type { ModuleCode, PermissionCode, TenantContext } from "@/types/core";

export type ConversationActionRisk = "low" | "medium" | "high" | "critical";

export type ConversationActionExecutionMode = "read" | "write" | "draft";

export type ConversationActionHandlerContext = {
  tenant: TenantContext;
};

export type ConversationActionHandlerResult = {
  entityId?: string | null;
  message: string;
  result: Record<string, unknown>;
};

export type ConversationActionDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  aliases: string[];
  description: string;
  enabled?: boolean;
  executionMode: ConversationActionExecutionMode;
  handler: (
    params: z.infer<TSchema>,
    context: ConversationActionHandlerContext,
  ) => Promise<ConversationActionHandlerResult>;
  id: string;
  module: ModuleCode | "dashboard";
  name: string;
  requiredPermissions: PermissionCode[];
  requiresConfirmation: boolean;
  risk: ConversationActionRisk;
  schema: TSchema;
};

export type PublicConversationAction = {
  aliases: string[];
  description: string;
  executionMode: ConversationActionExecutionMode;
  enabled: boolean;
  id: string;
  module: ConversationActionDefinition["module"];
  name: string;
  requiredFields: string[];
  requiredPermissions: PermissionCode[];
  requiresConfirmation: boolean;
  risk: ConversationActionRisk;
};
