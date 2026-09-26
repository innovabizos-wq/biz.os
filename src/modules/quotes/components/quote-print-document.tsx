import { QuoteDocumentLayout } from "@/modules/quotes/components/quote-document-layout";
import type {
  QuoteDocumentCompany,
  QuoteDocumentSettings,
} from "@/modules/quotes/quote-document-style";
import type { Quote, QuoteItem } from "@/modules/quotes/types";

type QuotePrintDocumentProps = {
  company: QuoteDocumentCompany;
  items: QuoteItem[];
  quote: Quote;
  settings: QuoteDocumentSettings;
};

export function QuotePrintDocument({ company, items, quote, settings }: QuotePrintDocumentProps) {
  return <QuoteDocumentLayout company={company} data={quote} items={items} settings={settings} />;
}
