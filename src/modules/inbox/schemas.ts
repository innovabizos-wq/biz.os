import { z } from "zod";

import {
  INBOX_AUTOMATION_ACTIONS,
  INBOX_AUTOMATION_MODES,
  INBOX_AUTOMATION_STATUSES,
  INBOX_AUTOMATION_TRIGGERS,
  INBOX_CAMPAIGN_RECIPIENT_STATUSES,
  INBOX_CAMPAIGN_STATUSES,
  INBOX_CHANNEL_STATUSES,
  INBOX_CHANNELS,
  INBOX_CONNECTION_STATUSES,
  INBOX_CONVERSATION_STATUSES,
  INBOX_MESSAGE_DIRECTIONS,
  INBOX_META_TEMPLATE_CATEGORIES,
  INBOX_META_TEMPLATE_STATUSES,
  INBOX_META_CHANNELS,
} from "@/modules/inbox/constants";
import { nonEmptyTextSchema, optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

export const inboxChannelSchema = z.enum(INBOX_CHANNELS);
export const inboxMetaChannelSchema = z.enum(INBOX_META_CHANNELS);
export const inboxChannelStatusSchema = z.enum(INBOX_CHANNEL_STATUSES);
export const inboxConnectionStatusSchema = z.enum(INBOX_CONNECTION_STATUSES);
export const inboxConversationStatusSchema = z.enum(
  INBOX_CONVERSATION_STATUSES,
);
export const inboxMessageDirectionSchema = z.enum(INBOX_MESSAGE_DIRECTIONS);
export const inboxMetaTemplateCategorySchema = z.enum(
  INBOX_META_TEMPLATE_CATEGORIES,
);
export const inboxMetaTemplateStatusSchema = z.enum(INBOX_META_TEMPLATE_STATUSES);
export const inboxCampaignStatusSchema = z.enum(INBOX_CAMPAIGN_STATUSES);
export const inboxCampaignRecipientStatusSchema = z.enum(
  INBOX_CAMPAIGN_RECIPIENT_STATUSES,
);
export const inboxAutomationTriggerSchema = z.enum(INBOX_AUTOMATION_TRIGGERS);
export const inboxAutomationActionSchema = z.enum(INBOX_AUTOMATION_ACTIONS);
export const inboxAutomationModeSchema = z.enum(INBOX_AUTOMATION_MODES);
export const inboxAutomationStatusSchema = z.enum(INBOX_AUTOMATION_STATUSES);

export const createInboxChannelSchema = z.object({
  canal: inboxChannelSchema,
  identificadorExterno: optionalTextSchema,
  nombre: nonEmptyTextSchema,
});

export const changeInboxChannelStatusSchema = z.object({
  canalId: uuidSchema,
  estado: inboxChannelStatusSchema,
});

export const createInboxConversationSchema = z.object({
  asignadoA: optionalFormUuidSchema,
  canal: inboxChannelSchema.default("manual"),
  canalId: optionalFormUuidSchema,
  clienteId: optionalFormUuidSchema,
  contactoIdentificador: optionalTextSchema,
  contactoNombre: optionalTextSchema,
  contactoTelefono: optionalTextSchema,
  contactoUsuario: optionalTextSchema,
  mensajeInicial: optionalTextSchema,
});

export const addInboxMessageSchema = z
  .object({
    contenido: nonEmptyTextSchema,
    conversacionId: uuidSchema,
    direccion: inboxMessageDirectionSchema,
    esNotaInterna: z.coerce.boolean().optional().default(false),
  })
  .refine((data) => !data.esNotaInterna || data.direccion === "interna", {
    message: "Las notas internas deben usar direccion interna.",
    path: ["direccion"],
  });

export const assignInboxConversationSchema = z.object({
  asignadoA: optionalFormUuidSchema,
  conversacionId: uuidSchema,
});

export const linkInboxConversationCustomerSchema = z.object({
  clienteId: uuidSchema,
  conversacionId: uuidSchema,
});

export const markInboxConversationReadSchema = z.object({
  conversacionId: uuidSchema,
});

export const changeInboxConversationStatusSchema = z.object({
  conversacionId: uuidSchema,
  estado: inboxConversationStatusSchema,
});

export const createMetaChannelSchema = z.object({
  appId: optionalTextSchema,
  businessId: optionalTextSchema,
  canal: inboxMetaChannelSchema,
  identificadorExterno: optionalTextSchema,
  instagramBusinessAccountId: optionalTextSchema,
  nombre: nonEmptyTextSchema,
  pageId: optionalTextSchema,
  phoneNumberId: optionalTextSchema,
  wabaId: optionalTextSchema,
});

export const updateMetaChannelConfigSchema = createMetaChannelSchema.extend({
  canalId: uuidSchema,
  conexionEstado: inboxConnectionStatusSchema.optional().default("pendiente"),
});

export const saveMetaChannelSecretsSchema = z.object({
  accessToken: optionalTextSchema,
  appSecret: optionalTextSchema,
  canalId: uuidSchema,
  tokenExpiresAt: optionalTextSchema,
  verifyToken: optionalTextSchema,
});

export const regenerateVerifyTokenSchema = z.object({
  canalId: uuidSchema,
});

export const upsertMetaTemplateSchema = z.object({
  canalId: optionalFormUuidSchema,
  categoria: inboxMetaTemplateCategorySchema.default("UTILITY"),
  cuerpo: nonEmptyTextSchema,
  estado: inboxMetaTemplateStatusSchema.default("borrador"),
  idioma: nonEmptyTextSchema.default("es"),
  nombre: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Usa solo minusculas, numeros y guion bajo."),
  rechazoMotivo: optionalTextSchema,
  templateId: optionalFormUuidSchema,
  variables: optionalTextSchema,
});

export const sendWhatsAppTemplateSchema = z.object({
  conversacionId: uuidSchema,
  templateId: uuidSchema,
  variables: optionalTextSchema,
});

export const upsertInboxCampaignSchema = z.object({
  audiencia: optionalTextSchema,
  campaignId: optionalFormUuidSchema,
  canalId: uuidSchema,
  estado: inboxCampaignStatusSchema.default("borrador"),
  nombre: nonEmptyTextSchema,
  objetivo: optionalTextSchema,
  scheduledAt: optionalTextSchema,
  templateId: uuidSchema,
});

export const addInboxCampaignRecipientSchema = z.object({
  campaignId: uuidSchema,
  clienteId: optionalFormUuidSchema,
  conversacionId: optionalFormUuidSchema,
  externalRecipientId: optionalTextSchema,
  nombre: optionalTextSchema,
  optIn: z.coerce.boolean().refine((value) => value, {
    message: "El opt-in es obligatorio para cargar destinatarios de campana.",
  }),
  optInSource: nonEmptyTextSchema.default("manual_whapp"),
  telefono: nonEmptyTextSchema,
  variables: optionalTextSchema,
});

export const updateInboxCampaignStatusSchema = z.object({
  campaignId: uuidSchema,
  estado: inboxCampaignStatusSchema,
});

export const prepareInboxCampaignQueueSchema = z.object({
  campaignId: uuidSchema,
});

export const dispatchInboxCampaignBatchSchema = z.object({
  campaignId: uuidSchema,
});

export const updateInboxCampaignRecipientStatusSchema = z.object({
  recipientId: uuidSchema,
  estado: inboxCampaignRecipientStatusSchema,
  lastError: optionalTextSchema,
});

export const upsertInboxAutomationRuleSchema = z.object({
  accionConfig: optionalTextSchema,
  accionTipo: inboxAutomationActionSchema.default("crear_sugerencia"),
  automationId: optionalFormUuidSchema,
  canalId: optionalFormUuidSchema,
  condiciones: optionalTextSchema,
  descripcion: optionalTextSchema,
  estado: inboxAutomationStatusSchema.default("inactiva"),
  modo: inboxAutomationModeSchema.default("sugerida"),
  nombre: nonEmptyTextSchema,
  prioridad: z.coerce.number().int().min(1).max(999).default(100),
  triggerTipo: inboxAutomationTriggerSchema.default("mensaje_entrante"),
});

export const recordInboxAutomationExecutionSchema = z.object({
  automationId: uuidSchema,
  conversacionId: uuidSchema,
  estado: z.enum(["sugerida", "ejecutada", "fallida", "omitida"]).default("sugerida"),
  resultado: optionalTextSchema,
});

export type CreateInboxChannelInput = z.infer<typeof createInboxChannelSchema>;
export type ChangeInboxChannelStatusInput = z.infer<
  typeof changeInboxChannelStatusSchema
>;
export type CreateInboxConversationInput = z.infer<
  typeof createInboxConversationSchema
>;
export type AddInboxMessageInput = z.infer<typeof addInboxMessageSchema>;
export type AssignInboxConversationInput = z.infer<
  typeof assignInboxConversationSchema
>;
export type LinkInboxConversationCustomerInput = z.infer<
  typeof linkInboxConversationCustomerSchema
>;
export type MarkInboxConversationReadInput = z.infer<
  typeof markInboxConversationReadSchema
>;
export type ChangeInboxConversationStatusInput = z.infer<
  typeof changeInboxConversationStatusSchema
>;
export type CreateMetaChannelInput = z.infer<typeof createMetaChannelSchema>;
export type UpdateMetaChannelConfigInput = z.infer<
  typeof updateMetaChannelConfigSchema
>;
export type SaveMetaChannelSecretsInput = z.infer<
  typeof saveMetaChannelSecretsSchema
>;
export type RegenerateVerifyTokenInput = z.infer<
  typeof regenerateVerifyTokenSchema
>;
export type UpsertMetaTemplateInput = z.infer<typeof upsertMetaTemplateSchema>;
export type SendWhatsAppTemplateInput = z.infer<
  typeof sendWhatsAppTemplateSchema
>;
export type UpsertInboxCampaignInput = z.infer<
  typeof upsertInboxCampaignSchema
>;
export type AddInboxCampaignRecipientInput = z.infer<
  typeof addInboxCampaignRecipientSchema
>;
export type UpdateInboxCampaignStatusInput = z.infer<
  typeof updateInboxCampaignStatusSchema
>;
export type PrepareInboxCampaignQueueInput = z.infer<
  typeof prepareInboxCampaignQueueSchema
>;
export type DispatchInboxCampaignBatchInput = z.infer<
  typeof dispatchInboxCampaignBatchSchema
>;
export type UpdateInboxCampaignRecipientStatusInput = z.infer<
  typeof updateInboxCampaignRecipientStatusSchema
>;
export type UpsertInboxAutomationRuleInput = z.infer<
  typeof upsertInboxAutomationRuleSchema
>;
export type RecordInboxAutomationExecutionInput = z.infer<
  typeof recordInboxAutomationExecutionSchema
>;
