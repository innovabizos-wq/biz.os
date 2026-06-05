import type { BusinessContext } from "@/modules/business-context/types";

export type AutoblogNewsSource = {
  notes?: string | null;
  title: string;
  url: string;
};

export async function findRelevantNewsForBusinessContext(
  _context: BusinessContext | null,
): Promise<AutoblogNewsSource[]> {
  return [];
}
