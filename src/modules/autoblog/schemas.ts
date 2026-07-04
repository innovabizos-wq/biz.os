import { z } from "zod";

import {
  AUTOBLOG_SOURCE_MODES,
  AUTOBLOG_STATUSES,
  AUTOBLOG_TOPIC_STATUSES,
} from "@/modules/autoblog/constants";
import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const autoblogStatusSchema = z.enum(AUTOBLOG_STATUSES);
export const autoblogSourceModeSchema = z.enum(AUTOBLOG_SOURCE_MODES);
export const autoblogTopicStatusSchema = z.enum(AUTOBLOG_TOPIC_STATUSES);

export const createAutoblogTopicSchema = z.object({
  description: optionalTextSchema,
  sourceMode: autoblogSourceModeSchema.default("manual"),
  sourceUrlsText: optionalTextSchema,
  title: z.string().trim().min(1, "Agrega un tema."),
});

export const createAutoblogArticleSchema = z.object({
  content: optionalTextSchema,
  cta: optionalTextSchema,
  keywords: optionalTextSchema,
  seoDescription: optionalTextSchema,
  seoTitle: optionalTextSchema,
  socialFacebook: optionalTextSchema,
  socialInstagram: optionalTextSchema,
  socialLinkedin: optionalTextSchema,
  socialWhatsapp: optionalTextSchema,
  sourceMode: autoblogSourceModeSchema.default("manual"),
  sourceNotes: optionalTextSchema,
  sourceUrlsText: optionalTextSchema,
  summary: optionalTextSchema,
  title: z.string().trim().min(1, "Agrega un titulo."),
  topic: optionalTextSchema,
});

export const updateAutoblogArticleSchema = createAutoblogArticleSchema.extend({
  articleId: uuidSchema,
});

export const changeAutoblogArticleStatusSchema = z.object({
  articleId: uuidSchema,
  status: autoblogStatusSchema,
});

export const generateAutoblogDraftSchema = z.object({
  sourceMode: autoblogSourceModeSchema.default("manual"),
  sourceNotes: optionalTextSchema,
  sourceUrlsText: optionalTextSchema,
  topic: z.string().trim().min(1, "Agrega un tema para generar el borrador."),
});

export type CreateAutoblogTopicInput = z.infer<
  typeof createAutoblogTopicSchema
>;
export type CreateAutoblogArticleInput = z.infer<
  typeof createAutoblogArticleSchema
>;
export type UpdateAutoblogArticleInput = z.infer<
  typeof updateAutoblogArticleSchema
>;
export type ChangeAutoblogArticleStatusInput = z.infer<
  typeof changeAutoblogArticleStatusSchema
>;
export type GenerateAutoblogDraftInput = z.infer<
  typeof generateAutoblogDraftSchema
>;
export const deleteAutoblogArticleSchema = z.object({ articleId: uuidSchema });
export const deleteAutoblogTopicSchema = z.object({ topicId: uuidSchema });

export type DeleteAutoblogArticleInput = z.infer<typeof deleteAutoblogArticleSchema>;
export type DeleteAutoblogTopicInput = z.infer<typeof deleteAutoblogTopicSchema>;

export const updateAutoblogTopicSchema = z.object({
  topicId: uuidSchema,
  title: z.string().trim().min(1, "Agrega un tema."),
  description: optionalTextSchema,
  sourceMode: autoblogSourceModeSchema.default("manual"),
  sourceUrlsText: optionalTextSchema,
});

export type UpdateAutoblogTopicInput = z.infer<typeof updateAutoblogTopicSchema>;
