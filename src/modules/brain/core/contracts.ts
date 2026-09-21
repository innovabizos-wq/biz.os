import type { z } from "zod";

import type { CoreResult, JsonRecord, ModuleCode, PermissionCode, TenantContext } from "@/types/core";

export type BrainProviderCode =
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "ollama"
  | "openai"
  | "openai-compatible"
  | "other";

export type BrainProviderStatus = "configured" | "disabled" | "error" | "healthy" | "missing_credentials";

export type BrainExecutionMode = "dry_run" | "execute" | "stream";

export type BrainMessageRole = "assistant" | "system" | "tool" | "user";

export type BrainMessage = {
  content: string;
  metadata?: JsonRecord;
  role: BrainMessageRole;
};

export type BrainProviderSettings = {
  apiKey?: string | null;
  baseUrl?: string | null;
  maxTokens: number;
  model: string;
  provider: BrainProviderCode;
  streaming: boolean;
  temperature: number;
  timeoutMs: number;
};

export type BrainProviderUsage = {
  completionTokens?: number;
  cost?: number;
  promptTokens?: number;
  totalTokens?: number;
};

export type BrainProviderRequest = {
  messages: BrainMessage[];
  metadata?: JsonRecord;
  settings: BrainProviderSettings;
  tools?: BrainToolDefinition[];
};

export type BrainProviderResponse = {
  content: string;
  metadata?: JsonRecord;
  toolCalls?: BrainToolCall[];
  usage?: BrainProviderUsage;
};

export type BrainProviderHealth = {
  error?: string;
  model: string;
  provider: BrainProviderCode;
  responseTimeMs: number;
  status: BrainProviderStatus;
};

export type BrainProvider = {
  code: BrainProviderCode;
  generate(input: BrainProviderRequest): Promise<CoreResult<BrainProviderResponse>>;
  healthCheck(settings: BrainProviderSettings): Promise<CoreResult<BrainProviderHealth>>;
  supportsStreaming: boolean;
  supportsTools: boolean;
};

export type BrainJsonSchema = JsonRecord;

export type BrainToolSchema<TOutput = JsonRecord> = z.ZodType<TOutput>;

export type BrainToolCategory = "business" | "integration" | "system" | "utility";

export type BrainToolExecutionStatus = "error" | "success";

export type BrainToolDefinition = {
  category: BrainToolCategory;
  description: string;
  execute(input: BrainToolExecutionInput): Promise<CoreResult<BrainToolExecutionOutput>>;
  enabled: boolean;
  id: string;
  inputSchema: BrainToolSchema<JsonRecord>;
  module: ModuleCode;
  name: string;
  outputSchema: BrainToolSchema<JsonRecord>;
  requiredPermissions: PermissionCode[];
  version: string;
};

export type BrainToolCall = {
  arguments: JsonRecord;
  id: string;
  toolId: string;
};

export type BrainToolExecutionInput = {
  arguments: JsonRecord;
  callId?: string;
  tenant: TenantContext;
};

export type BrainToolExecutionOutput = {
  data: JsonRecord;
  metadata?: JsonRecord;
};

export type BrainToolExecutionRecord = {
  arguments: JsonRecord;
  companyId: string;
  createdAt: string;
  durationMs: number;
  error: string | null;
  id: string;
  result: JsonRecord | null;
  status: BrainToolExecutionStatus;
  toolId: string;
  userId: string;
};

export type BrainToolExecutionRequest = {
  arguments?: JsonRecord;
  callId?: string;
  tenant: TenantContext;
  toolId: string;
};

export type BrainToolExecutionResponse = {
  data: JsonRecord;
  durationMs: number;
  executionId: string;
  metadata?: JsonRecord;
  status: BrainToolExecutionStatus;
  toolId: string;
};

export type BrainToolRegistry = {
  disable(toolId: string): CoreResult<BrainToolDefinition>;
  enable(toolId: string): CoreResult<BrainToolDefinition>;
  exists(toolId: string): boolean;
  get(toolId: string): BrainToolDefinition | null;
  getAvailable(tenant: TenantContext): BrainToolDefinition[];
  getByModule(module: ModuleCode): BrainToolDefinition[];
  list(): BrainToolDefinition[];
  register(tool: BrainToolDefinition): CoreResult<BrainToolDefinition>;
};

export type BrainToolExecutor = {
  execute(input: BrainToolExecutionRequest): Promise<CoreResult<BrainToolExecutionResponse>>;
};

export type BrainToolExecutionRecorder = {
  list(): BrainToolExecutionRecord[];
  record(event: BrainToolExecutionRecord): CoreResult<BrainToolExecutionRecord>;
};

export type BrainAgentDefinition = {
  allowedTools: string[];
  description: string;
  id: string;
  module: ModuleCode | "brain";
  name: string;
  requiredPermissions: PermissionCode[];
};

export type BrainAgent = {
  definition: BrainAgentDefinition;
  run(input: BrainAgentRunInput): Promise<CoreResult<BrainAgentRunOutput>>;
};

export type BrainAgentRunInput = {
  conversation?: BrainConversation;
  mode: BrainExecutionMode;
  tenant: TenantContext;
};

export type BrainAgentRunOutput = {
  messages: BrainMessage[];
  metadata?: JsonRecord;
  usage?: BrainProviderUsage;
};

export type BrainConversationStatus = "active" | "archived" | "closed";

export type BrainConversation = {
  createdAt: string;
  id: string;
  messages: BrainMessage[];
  metadata: JsonRecord;
  status: BrainConversationStatus;
  tenantId: string;
  title: string | null;
  updatedAt: string;
};

export type BrainConversationRepository = {
  appendMessage(conversationId: string, message: BrainMessage): Promise<CoreResult<BrainConversation>>;
  create(input: BrainConversationCreateInput): Promise<CoreResult<BrainConversation>>;
  getById(conversationId: string, tenant: TenantContext): Promise<CoreResult<BrainConversation | null>>;
};

export type BrainConversationCreateInput = {
  initialMessages?: BrainMessage[];
  metadata?: JsonRecord;
  tenant: TenantContext;
  title?: string | null;
};

export type BrainMemoryEntry = {
  confidence: number;
  content: JsonRecord;
  id: string;
  sourceModules: string[];
  type: string;
};

export type BrainMemoryStore = {
  remember(input: BrainMemoryWriteInput): Promise<CoreResult<BrainMemoryEntry>>;
  search(input: BrainMemorySearchInput): Promise<CoreResult<BrainMemoryEntry[]>>;
};

export type BrainMemorySearchInput = {
  query: string;
  tenant: TenantContext;
  types?: string[];
};

export type BrainMemoryWriteInput = {
  content: JsonRecord;
  sourceModules: string[];
  tenant: TenantContext;
  title: string;
  type: string;
};

export type BrainKnowledgeDocument = {
  content: string;
  id: string;
  metadata: JsonRecord;
  source: string;
};

export type BrainKnowledgeStore = {
  ingest(input: BrainKnowledgeIngestInput): Promise<CoreResult<BrainKnowledgeDocument>>;
  search(input: BrainKnowledgeSearchInput): Promise<CoreResult<BrainKnowledgeDocument[]>>;
};

export type BrainKnowledgeIngestInput = {
  content: string;
  metadata?: JsonRecord;
  source: string;
  tenant: TenantContext;
};

export type BrainKnowledgeSearchInput = {
  query: string;
  tenant: TenantContext;
};

export type BrainExecutionRequest = {
  agentId?: string;
  mode: BrainExecutionMode;
  tenant: TenantContext;
  toolCall?: BrainToolCall;
};

export type BrainExecutionResult = {
  id: string;
  metadata?: JsonRecord;
  status: "blocked" | "completed" | "failed" | "pending_confirmation";
  usage?: BrainProviderUsage;
};

export type BrainExecutionService = {
  execute(input: BrainExecutionRequest): Promise<CoreResult<BrainExecutionResult>>;
};

export type BrainPermissionResolver = {
  canExecuteTool(tenant: TenantContext, tool: BrainToolDefinition): CoreResult<boolean>;
  canRunAgent(tenant: TenantContext, agent: BrainAgentDefinition): CoreResult<boolean>;
};

export type BrainAnalyticsEvent = {
  companyId: string;
  createdAt: string;
  durationMs?: number;
  error?: string;
  model: string;
  provider: BrainProviderCode;
  toolIds: string[];
  usage?: BrainProviderUsage;
  userId: string;
};

export type BrainAnalyticsRecorder = {
  record(event: BrainAnalyticsEvent): Promise<CoreResult<void>>;
};

export type BrainConfiguration = {
  activeProvider: BrainProviderCode;
  apiKeyLast4: string | null;
  hasApiKey: boolean;
  maxTokens: number;
  model: string;
  streaming: boolean;
  temperature: number;
  timeoutMs: number;
};

export type BrainConfigurationService = {
  getConfiguration(tenant: TenantContext): Promise<CoreResult<BrainConfiguration>>;
};
