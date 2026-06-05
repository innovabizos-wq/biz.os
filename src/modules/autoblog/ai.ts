import type { BusinessContext } from "@/modules/business-context/types";
import type { AutoblogDraft } from "@/modules/autoblog/types";

export type GenerateAutoblogDraftInput = {
  businessContext: BusinessContext | null;
  sourceNotes?: string | null;
  sourceUrls?: string[];
  topic: string;
};

export type GenerateAutoblogDraftResult =
  | {
      data: AutoblogDraft;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

export function isAutoblogAiConfigured() {
  return false;
}

export async function generateAutoblogDraft(
  _input: GenerateAutoblogDraftInput,
): Promise<GenerateAutoblogDraftResult> {
  return {
    message:
      "La generacion IA todavia no esta configurada. Puedes crear el articulo manualmente.",
    ok: false,
  };
}
