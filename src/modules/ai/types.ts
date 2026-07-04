export type AiProviderSettings = {
  apiKeyLast4: string | null;
  baseUrl: string | null;
  dailyLimit: number;
  enabled: boolean;
  hasApiKey: boolean;
  lastTestAt: string | null;
  lastTestMessage: string | null;
  lastTestStatus: ConversationLayerTestStatus;
  maxTokens: number;
  model: string;
  outputMode: ConversationLayerOutputMode;
  provider: ConversationLayerProvider;
  temperature: number;
};

export type ConversationLayerProvider =
  | "gemini"
  | "openai-compatible"
  | "groq-compatible"
  | "openrouter-compatible"
  | "ollama-compatible";

export type ConversationLayerOutputMode = "strict_json" | "natural_text";

export type ConversationLayerTestStatus = "success" | "error" | null;

export type ConversationLayerSettings = {
  apiKeyLast4: string | null;
  baseUrl: string | null;
  dailyLimit: number;
  enabled: boolean;
  hasApiKey: boolean;
  lastTestAt: string | null;
  lastTestMessage: string | null;
  lastTestStatus: ConversationLayerTestStatus;
  maxTokens: number;
  model: string;
  outputMode: ConversationLayerOutputMode;
  provider: ConversationLayerProvider;
  temperature: number;
};

export type ConversationLayerSettingsForProvider = ConversationLayerSettings & {
  apiKey: string | null;
};

export type ConversationLayerIntent = {
  action: string;
  action_id?: string;
  ambiguities: string[];
  confidence: number;
  data: Record<string, unknown>;
  intent: string;
  missing_fields: string[];
  module: string;
  needs_confirmation: boolean;
  reply_to_user: string;
  safe_to_execute: boolean;
};

export type ConversationLayerNaturalizedResponse = {
  message: string;
  needs_user_input: boolean;
  tone: "friendly" | "neutral" | "professional";
};

export type ConversationLayerInterpretInput = {
  availableActions: string[];
  context?: Record<string, unknown>;
  module: string;
  requiredFields?: Record<string, unknown>;
  userMessage: string;
};

export type ConversationLayerNaturalizeInput = {
  module: string;
  technicalResponse: Record<string, unknown>;
  userOriginalMessage: string;
};

export type ConversationLayerErrorCode =
  | "CONVERSATION_LAYER_DISABLED"
  | "PROVIDER_NOT_CONFIGURED"
  | "API_KEY_MISSING"
  | "PROVIDER_CONNECTION_FAILED"
  | "INVALID_AI_RESPONSE"
  | "JSON_PARSE_FAILED"
  | "UNSAFE_ACTION_BLOCKED";

export type AiUsageEvent = {
  completionTokens: number;
  createdAt: string;
  feature: string;
  id: string;
  profileNombre: string | null;
  promptTokens: number;
  provider: string | null;
  status: "logged" | "blocked" | "error";
};
