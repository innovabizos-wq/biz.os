import { z } from "zod";

import {
  jsonRecordSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
} from "@/lib/validation/shared-schemas";

export const aiProviderSettingsSchema = z.object({
  apiKey: optionalTextSchema,
  baseUrl: optionalTextSchema,
  dailyLimit: z.coerce.number().int().min(1).max(10000).default(100),
  enabled: z.coerce.boolean().default(false),
  maxTokens: z.coerce.number().int().min(100).max(8000).default(1200),
  model: optionalTextSchema.default("gemini-2.5-flash-lite"),
  outputMode: z.enum(["strict_json", "natural_text"]).default("strict_json"),
  provider: z
    .enum([
      "gemini",
      "openai-compatible",
      "groq-compatible",
      "openrouter-compatible",
      "ollama-compatible",
    ])
    .default("gemini"),
  temperature: z.coerce.number().min(0).max(2).default(0.2),
});

export const logAiUsageSchema = z.object({
  feature: optionalTextSchema.default("operational-test"),
});

export const conversationLayerProviderSchema = aiProviderSettingsSchema.shape.provider;

export const conversationLayerOutputModeSchema = aiProviderSettingsSchema.shape.outputMode;

export const conversationLayerSettingsSchema = aiProviderSettingsSchema;

export const conversationLayerInterpretInputSchema = z.object({
  availableActions: z.array(nonEmptyTextSchema).default([]),
  context: jsonRecordSchema.default({}),
  module: nonEmptyTextSchema.max(80),
  requiredFields: jsonRecordSchema.default({}),
  userMessage: nonEmptyTextSchema.max(2000),
});

export const conversationLayerIntentSchema = z.object({
  action: z.string().trim().default(""),
  action_id: z.string().trim().optional(),
  ambiguities: z.array(z.string().trim()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0),
  data: jsonRecordSchema.default({}),
  intent: z.string().trim().min(1).default("unknown"),
  missing_fields: z.array(z.string().trim()).default([]),
  module: z.string().trim().min(1),
  needs_confirmation: z.coerce.boolean().default(true),
  reply_to_user: z.string().trim().default(""),
  safe_to_execute: z.coerce.boolean().default(false),
});

export const conversationLayerNaturalizeInputSchema = z.object({
  module: nonEmptyTextSchema.max(80),
  technicalResponse: jsonRecordSchema,
  userOriginalMessage: nonEmptyTextSchema.max(2000),
});

export const conversationLayerNaturalizedResponseSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  needs_user_input: z.coerce.boolean().default(false),
  tone: z.enum(["friendly", "neutral", "professional"]).default("professional"),
});

export type AiProviderSettingsInput = z.infer<typeof aiProviderSettingsSchema>;
export type ConversationLayerSettingsInput = z.infer<
  typeof conversationLayerSettingsSchema
>;
