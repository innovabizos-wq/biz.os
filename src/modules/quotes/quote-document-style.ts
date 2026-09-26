export const QUOTE_DOCUMENT_TEMPLATES = [
  { code: "executive", description: "Profesional y equilibrado", name: "Ejecutiva" },
  { code: "bold", description: "Número y total protagonistas", name: "Impacto" },
  { code: "minimal", description: "Limpia y sobria", name: "Minimal" },
  { code: "editorial", description: "Elegante con jerarquía visual", name: "Editorial" },
  { code: "classic", description: "Formal y tradicional", name: "Clásica" },
] as const;

export const QUOTE_DOCUMENT_ACCENT_COLORS = [
  { label: "Verde", value: "#0F766E" },
  { label: "Azul", value: "#1D4ED8" },
  { label: "Vino", value: "#BE123C" },
  { label: "Morado", value: "#7E22CE" },
  { label: "Grafito", value: "#334155" },
] as const;

export const QUOTE_DOCUMENT_LABELS = ["Cotización", "Proforma", "Presupuesto"] as const;

export type QuoteDocumentTemplateCode = (typeof QUOTE_DOCUMENT_TEMPLATES)[number]["code"];
export type QuoteDocumentLabel = (typeof QUOTE_DOCUMENT_LABELS)[number];
export type QuoteDocumentAccentColor = (typeof QUOTE_DOCUMENT_ACCENT_COLORS)[number]["value"];

export type QuoteDocumentSettings = {
  accentColor: QuoteDocumentAccentColor;
  documentLabel: QuoteDocumentLabel;
  footerText: string | null;
  logoDataUrl: string | null;
  templateCode: QuoteDocumentTemplateCode;
};

export type QuoteDocumentCompany = {
  email: string | null;
  identification: string | null;
  name: string;
  phone: string | null;
  tradeName: string | null;
};

export const DEFAULT_QUOTE_DOCUMENT_SETTINGS: QuoteDocumentSettings = {
  accentColor: "#0F766E",
  documentLabel: "Proforma",
  footerText: "Gracias por considerar nuestra propuesta.",
  logoDataUrl: null,
  templateCode: "executive",
};
