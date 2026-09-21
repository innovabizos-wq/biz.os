"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAccess } from "@/modules/platform-console/guards";
import { normalizeMetaMarketCode } from "@/services/meta/pricing";

const metaRateSchema = z.object({
  category: z.enum(["AUTHENTICATION", "AUTHENTICATION_INTERNATIONAL", "MARKETING", "UTILITY", "SERVICE"]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  effectiveFrom: z.string().date(),
  effectiveTo: z.union([z.string().date(), z.literal("")]).optional(),
  marketCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,48}$/),
  sourceUrl: z.union([z.string().url(), z.literal("")]).optional(),
  unitCost: z.coerce.number().min(0),
  volumeFrom: z.coerce.number().int().min(1),
  volumeTo: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(1).optional(),
  ),
}).superRefine((rate, context) => {
  if (rate.volumeTo !== undefined && rate.volumeTo < rate.volumeFrom) {
    context.addIssue({ code: "custom", message: "El final del tramo no puede ser menor al inicio." });
  }
  if (
    !["AUTHENTICATION", "AUTHENTICATION_INTERNATIONAL", "UTILITY"].includes(rate.category) &&
    (rate.volumeFrom !== 1 || rate.volumeTo !== undefined)
  ) {
    context.addIssue({ code: "custom", message: "Meta solo aplica tramos a Utility y Authentication." });
  }
});

export async function upsertMetaRateAction(formData: FormData) {
  await requirePlatformAccess(["owner", "admin"]);
  const parsed = metaRateSchema.safeParse({
    category: formData.get("category"),
    currency: formData.get("currency"),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveTo: formData.get("effectiveTo"),
    marketCode: formData.get("marketCode"),
    sourceUrl: formData.get("sourceUrl"),
    unitCost: formData.get("unitCost"),
    volumeFrom: formData.get("volumeFrom"),
    volumeTo: formData.get("volumeTo"),
  });
  if (!parsed.success) {
    redirect("/platform/whapp?error=Tarifa%20Meta%20invalida.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inbox_meta_tarifas").upsert({
    categoria: parsed.data.category,
    currency: parsed.data.currency,
    effective_from: parsed.data.effectiveFrom,
    effective_to: parsed.data.effectiveTo || null,
    market_code: normalizeMetaMarketCode(parsed.data.marketCode),
    source_url: parsed.data.sourceUrl || null,
    unit_cost: parsed.data.unitCost,
    volume_from: parsed.data.volumeFrom,
    volume_to: parsed.data.volumeTo ?? null,
  }, { onConflict: "market_code,categoria,currency,effective_from,volume_from" });
  if (error) {
    console.error("Meta rate upsert failed", { code: error.code, message: error.message });
    redirect("/platform/whapp?error=No%20se%20pudo%20guardar%20la%20tarifa.");
  }

  revalidatePath("/platform/whapp");
  redirect("/platform/whapp?success=Tarifa%20Meta%20guardada.");
}
