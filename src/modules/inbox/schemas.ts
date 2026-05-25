import { z } from "zod";

import {
  INBOX_CHANNEL_STATUSES,
  INBOX_CHANNELS,
  INBOX_CONNECTION_STATUSES,
  INBOX_CONVERSATION_STATUSES,
  INBOX_MESSAGE_DIRECTIONS,
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
