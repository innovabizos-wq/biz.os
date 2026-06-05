import { z } from "zod";

import { optionalTextSchema } from "@/lib/validation/shared-schemas";

export const businessContextSchema = z.object({
  aiInstructions: optionalTextSchema,
  brandPersonality: optionalTextSchema,
  businessHours: optionalTextSchema,
  businessSummary: optionalTextSchema,
  competitors: optionalTextSchema,
  coreValues: optionalTextSchema,
  customerPainPoints: optionalTextSchema,
  customerServiceRules: optionalTextSchema,
  differentiators: optionalTextSchema,
  forbiddenTopics: optionalTextSchema,
  geographicScope: optionalTextSchema,
  keywords: optionalTextSchema,
  mainOffers: optionalTextSchema,
  mission: optionalTextSchema,
  notes: optionalTextSchema,
  operationalRules: optionalTextSchema,
  preferredCta: optionalTextSchema,
  pricingNotes: optionalTextSchema,
  productsServices: optionalTextSchema,
  requiredDisclaimers: optionalTextSchema,
  salesRules: optionalTextSchema,
  serviceAreas: optionalTextSchema,
  serviceProcess: optionalTextSchema,
  targetAudience: optionalTextSchema,
  toneOfVoice: optionalTextSchema,
  vision: optionalTextSchema,
});

export type BusinessContextInput = z.infer<typeof businessContextSchema>;
