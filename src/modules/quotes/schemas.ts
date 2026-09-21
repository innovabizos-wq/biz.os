import { z } from "zod";

import {
  DEFAULT_QUOTE_MONEDA,
  QUOTE_MONEDAS,
  QUOTE_STATUS_FILTERS,
  QUOTE_STATUSES,
} from "@/modules/quotes/constants";
import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// Browser forms submit blank hidden UUID fields as "". Preprocess those
// blanks instead of declaring an empty-string literal, which Gemini rejects
// when this schema is exposed as a function declaration.
const optionalFormUuidSchema = z.preprocess(
  emptyStringToUndefined,
  uuidSchema.optional(),
);

const optionalProductUuidSchema = optionalFormUuidSchema
  .nullable()
  .transform((value) => value ?? undefined);

const optionalDateSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

const numericFormSchema = z.coerce.number();
const nonNegativeMoneySchema = numericFormSchema.min(0);
const positiveMoneySchema = numericFormSchema.positive();

export const quoteStatusSchema = z.enum(QUOTE_STATUSES);
export const quoteStatusFilterSchema = z.enum(QUOTE_STATUS_FILTERS);
export const quoteMonedaSchema = z.enum(QUOTE_MONEDAS);

export const createQuoteSchema = z.object({
  clienteId: optionalFormUuidSchema,
  condiciones: optionalTextSchema,
  fechaVencimiento: optionalDateSchema,
  moneda: quoteMonedaSchema.default(DEFAULT_QUOTE_MONEDA),
  notas: optionalTextSchema,
});

export const quoteModalItemSchema = z.object({
  cantidad: numericFormSchema.positive(),
  descripcion: nonEmptyTextSchema,
  descuento: nonNegativeMoneySchema.default(0),
  impuestoPorcentaje: nonNegativeMoneySchema.default(0),
  precioUnitario: positiveMoneySchema,
  productoId: optionalProductUuidSchema,
});

export const quoteModalItemsSchema = z.array(quoteModalItemSchema).min(1);

export const updateQuoteSchema = createQuoteSchema.extend({
  cotizacionId: uuidSchema,
});

export const addQuoteItemSchema = z.object({
  cantidad: numericFormSchema.positive(),
  cotizacionId: uuidSchema,
  descripcion: nonEmptyTextSchema,
  descuento: nonNegativeMoneySchema.default(0),
  impuestoPorcentaje: nonNegativeMoneySchema.default(0),
  precioUnitario: positiveMoneySchema,
  productoId: optionalProductUuidSchema,
});

export const updateQuoteItemSchema = addQuoteItemSchema
  .omit({ cotizacionId: true })
  .extend({
    itemId: uuidSchema,
  });

export const deleteQuoteItemSchema = z.object({
  cotizacionId: uuidSchema.optional(),
  itemId: uuidSchema,
});

export const changeQuoteStatusSchema = z.object({
  cotizacionId: uuidSchema,
  estado: quoteStatusSchema,
});

export const quoteIdActionSchema = z.object({
  cotizacionId: uuidSchema,
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type QuoteModalItemInput = z.infer<typeof quoteModalItemSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type AddQuoteItemInput = z.infer<typeof addQuoteItemSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;
export type DeleteQuoteItemInput = z.infer<typeof deleteQuoteItemSchema>;
export type ChangeQuoteStatusInput = z.infer<typeof changeQuoteStatusSchema>;
