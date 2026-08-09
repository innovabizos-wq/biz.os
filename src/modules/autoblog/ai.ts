import "server-only";

import { z } from "zod";

import { getConversationProviderAdapter } from "@/lib/ai/providers";
import type { AiProviderGenerateResult } from "@/lib/ai/providers/types";
import { getBrainAiProviderSettings } from "@/modules/ai/conversation-layer-service";
import type { ConversationLayerSettingsForProvider } from "@/modules/ai/types";
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

export type AutoblogAiStatus = {
  canGenerate: boolean;
  detail: string;
  href?: string;
  label: string;
  tone: "error" | "warning" | "ready";
};

type EditorialBusinessContext = {
  cta: string | null;
  conclusion: string | null;
  geographicScope: string | null;
  intro: string | null;
  serviceAreas: string | null;
};

type EditorialSignals = {
  sourceSummary: string | null;
  topicTerms: string[];
};

const REQUIRED_HEADING_PATTERNS = [
  /<h2[^>]*>\s*Qu[e\u00e9] es\s*<\/h2>/i,
  /<h2[^>]*>\s*C[o\u00f3]mo funciona\s*<\/h2>/i,
  /<h2[^>]*>\s*Beneficios\s*<\/h2>/i,
  /<h2[^>]*>\s*Errores comunes\s*<\/h2>/i,
  /<h2[^>]*>\s*Preguntas frecuentes\s*<\/h2>/i,
  /<h2[^>]*>\s*Conclusi[o\u00f3]n\s*<\/h2>/i,
];

const CORPORATE_PHRASES = [
  /nuestra empresa/i,
  /nosotros ofrecemos/i,
  /nuestra soluci[o\u00f3]n/i,
  /nuestros servicios/i,
  /somos l[i\u00ed]deres/i,
  /somos expertos/i,
  /agenda una revisi[o\u00f3]n/i,
  /solicita una demo/i,
  /solicita una demostraci[o\u00f3]n/i,
  /automatiza tu negocio/i,
  /agenda una demo/i,
  /contacta con nosotros/i,
  /habla con un asesor/i,
  /escr[i\u00ed]benos/i,
  /cotiza ahora/i,
];

const COMMERCIAL_BLOCK_PHRASES = [
  /agenda\s+(una|tu|revision|consulta|demo|demostracion)/i,
  /solicita\s+(una\s+)?(demo|demostracion|consulta|cotizacion)/i,
  /demo\s+(gratis|gratuita|personalizada)/i,
  /contacta(nos|\s+con\s+nosotros)/i,
  /escribenos/i,
  /llamanos/i,
  /cotiza/i,
  /prueba\s+gratuita/i,
  /empieza\s+hoy/i,
];

const MAX_CONTEXT_WORDS = 20;
const MAX_SEO_DESCRIPTION_CHARS = 160;
const MAX_SEO_TITLE_CHARS = 60;
const MAX_SOURCE_SUMMARY_CHARS = 500;
const MAX_SUMMARY_CHARS = 180;
const MAX_TITLE_CHARS = 90;

const COMMON_STOPWORDS = new Set([
  "ademas",
  "agora",
  "algo",
  "alguna",
  "algunas",
  "algunos",
  "antes",
  "apenas",
  "aqui",
  "asi",
  "bajo",
  "bastante",
  "bien",
  "cada",
  "casi",
  "como",
  "con",
  "contra",
  "cual",
  "cuales",
  "cuando",
  "cualquier",
  "debe",
  "deben",
  "desde",
  "donde",
  "durante",
  "e",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "era",
  "eran",
  "esa",
  "esas",
  "ese",
  "eso",
  "esos",
  "esta",
  "estaba",
  "estaban",
  "estamos",
  "estara",
  "estaran",
  "estas",
  "este",
  "esto",
  "estos",
  "etc",
  "falta",
  "frente",
  "gran",
  "grande",
  "hasta",
  "hay",
  "incluso",
  "junto",
  "luego",
  "mas",
  "mientras",
  "mucho",
  "muchos",
  "nada",
  "ningun",
  "ninguna",
  "no",
  "nos",
  "nuestra",
  "nuestro",
  "nueva",
  "nuevo",
  "o",
  "otra",
  "otro",
  "para",
  "pero",
  "poco",
  "por",
  "porque",
  "puede",
  "pueden",
  "que",
  "quien",
  "quienes",
  "sera",
  "seran",
  "sin",
  "sobre",
  "solo",
  "son",
  "su",
  "sus",
  "tambien",
  "tanto",
  "te",
  "tiene",
  "tienen",
  "todo",
  "todos",
  "tu",
  "una",
  "unas",
  "uno",
  "unos",
  "usar",
  "usos",
  "va",
  "vamos",
  "varias",
  "varios",
  "ya",
  "empresa",
  "empresas",
  "servicio",
  "servicios",
  "solucion",
  "soluciones",
  "negocio",
  "negocios",
  "marca",
  "cliente",
  "clientes",
  "publico",
  "objetivo",
  "contenido",
  "articulo",
  "blog",
  "tema",
  "temas",
  "guia",
  "manual",
  "marketing",
  "ventas",
  "venta",
  "demo",
  "demos",
  "contacto",
  "contacta",
  "agenda",
  "solicita",
  "cotiza",
  "empresa",
  "corporativo",
]);

const autoblogDraftSchema = z.object({
  content: z.string().trim().min(120),
  cta: z.string().trim().nullable().optional(),
  keywords: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
  seoTitle: z.string().trim().nullable().optional(),
  socialFacebook: z.string().trim().nullable().optional(),
  socialInstagram: z.string().trim().nullable().optional(),
  socialLinkedin: z.string().trim().nullable().optional(),
  socialWhatsapp: z.string().trim().nullable().optional(),
  summary: z.string().trim().nullable().optional(),
  title: z.string().trim().min(8),
});

function asText(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncateChars(value: string | null | undefined, limit: number) {
  const text = asText(value);
  if (!text) return null;
  return text.length > limit ? text.slice(0, limit).trim() : text;
}

function compactText(...parts: Array<string | null | undefined>) {
  return normalizeWhitespace(
    parts
      .map((part) => asText(part))
      .filter((part): part is string => Boolean(part))
      .join(" "),
  );
}

function limitWords(value: string | null | undefined, limit: number) {
  const text = asText(value);
  if (!text) return null;
  const words = text.split(/\s+/);
  return words.length > limit ? words.slice(0, limit).join(" ") : text;
}

function normalizeForMatch(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) =>
      String.fromCharCode(Number.parseInt(decimal, 10)),
    );
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function stripCommercialPhrases(value: string) {
  let text = value;
  for (const pattern of CORPORATE_PHRASES) {
    text = text.replace(pattern, " ");
  }
  return normalizeWhitespace(text);
}

function extractMeaningfulTokens(value: string | null | undefined) {
  const normalized = normalizeForMatch(value).replace(/[^a-z0-9]+/g, " ");
  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !COMMON_STOPWORDS.has(token));

  if (tokens.length > 0) {
    return [...new Set(tokens)];
  }

  const fallback = normalized.trim();
  return fallback ? [fallback] : [];
}

function collectBusinessEvidence(context: BusinessContext | null) {
  if (!context) return "";

  return compactText(
    context.businessSummary,
    context.targetAudience,
    context.keywords,
    context.mainOffers,
    context.productsServices,
    context.differentiators,
    context.customerPainPoints,
    context.serviceProcess,
    context.geographicScope,
    context.serviceAreas,
    context.notes,
  );
}

function collectBrandCandidates(context: BusinessContext | null) {
  if (!context) return [];

  const text = compactText(
    context.businessSummary,
    context.brandPersonality,
    context.keywords,
    context.mainOffers,
    context.productsServices,
    context.differentiators,
    context.mission,
    context.vision,
    context.notes,
    context.preferredCta,
  );

  const candidates = new Set<string>();
  const matches =
    text.match(
      /\b(?:[A-Z][A-Za-z0-9&.-]*[A-Z][A-Za-z0-9&.-]*|[A-Z]{2,}[A-Za-z0-9&.-]*|[A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g,
    ) ?? [];

  for (const match of matches) {
    const candidate = normalizeWhitespace(match);
    if (candidate.length >= 4 && !COMMON_STOPWORDS.has(normalizeForMatch(candidate))) {
      candidates.add(candidate);
    }
  }

  return [...candidates];
}

function shouldUseBusinessContext(
  topic: string,
  context: BusinessContext | null,
) {
  if (!context) return false;

  const topicTokens = extractMeaningfulTokens(topic);
  const contextTokens = extractMeaningfulTokens(collectBusinessEvidence(context));

  if (topicTokens.length === 0 || contextTokens.length === 0) {
    return false;
  }

  return topicTokens.some((token) => contextTokens.includes(token));
}

function sanitizeByRemovingTerms(value: string, terms: string[]) {
  let text = value;
  const orderedTerms = [...terms].sort((a, b) => b.length - a.length);

  for (const term of orderedTerms) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    text = text.replace(pattern, " ");
  }

  return normalizeWhitespace(text);
}

function sanitizeBusinessBlock(
  value: string | null | undefined,
  brandCandidates: string[],
  limit = MAX_CONTEXT_WORDS,
) {
  const cleaned = sanitizeByRemovingTerms(
    stripCommercialPhrases(asText(value) ?? ""),
    brandCandidates,
  );

  return limitWords(cleaned, limit);
}

function buildEditorialBusinessContext(
  context: BusinessContext | null,
  topic: string,
): EditorialBusinessContext | null {
  if (!shouldUseBusinessContext(topic, context)) {
    return null;
  }

  const brandCandidates = collectBrandCandidates(context);
  const intro = sanitizeBusinessBlock(
    compactText(context?.businessSummary, context?.targetAudience),
    brandCandidates,
  );
  const conclusion = sanitizeBusinessBlock(
    compactText(context?.businessSummary),
    brandCandidates,
  );
  const cta = sanitizeBusinessBlock(context?.preferredCta, brandCandidates);
  const geographicScope = sanitizeBusinessBlock(
    compactText(context?.geographicScope),
    brandCandidates,
  );
  const serviceAreas = sanitizeBusinessBlock(
    compactText(context?.serviceAreas),
    brandCandidates,
  );

  return {
    cta,
    conclusion,
    geographicScope,
    intro,
    serviceAreas,
  };
}

function buildGeoGuidance(context: EditorialBusinessContext | null) {
  if (!context) {
    return "No hay contexto geografico util. Usa enfoque global.";
  }

  const location = compactText(context.geographicScope, context.serviceAreas);
  if (!location) {
    return "No hay contexto geografico util. Usa enfoque global.";
  }

  return `Contexto geografico: ${location}. Adapta ejemplos, regulaciones, moneda y referencias locales solo si aportan claridad.`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildEditorialSignals(input: GenerateAutoblogDraftInput): EditorialSignals {
  const topicTerms = extractMeaningfulTokens(input.topic);
  const sourceNotes = truncateChars(input.sourceNotes, MAX_SOURCE_SUMMARY_CHARS);
  const sourceUrlHints = (input.sourceUrls ?? [])
    .map((url) => asText(url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 5)
    .join(" ");
  const sourceSummary = truncateChars(
    compactText(sourceNotes, sourceUrlHints),
    MAX_SOURCE_SUMMARY_CHARS,
  );

  return {
    sourceSummary,
    topicTerms,
  };
}

function buildEditorialPrompt(
  topic: string,
  context: EditorialBusinessContext | null,
) {
  return [
    "Eres un redactor editorial senior para Autoblog.",
    "Prioriza utilidad, precision, profundidad y claridad.",
    "El topic debe representar casi todo el articulo.",
    "Usa sourceNotes y sourceUrls solo como referencias aportadas por el usuario; no inventes investigacion externa.",
    "No conviertas el texto en una landing page, publicidad o repeticion corporativa.",
    "businessContext solo puede aparecer, si aplica, en una introduccion breve, una conclusion breve y un CTA final opcional.",
    "Si el negocio no es claramente relevante para el topic, omite por completo la marca y el CTA.",
    "No uses frases como: Nuestra empresa, Nosotros ofrecemos, Nuestra solucion, Nuestros servicios, Somos lideres, Somos expertos.",
    "Estructura obligatoria en content:",
    "<h2>Qu\u00e9 es</h2>",
    "<h2>C\u00f3mo funciona</h2>",
    "<h2>Beneficios</h2>",
    "<h2>Errores comunes</h2>",
    "<h2>Preguntas frecuentes</h2>",
    "<h2>Conclusi\u00f3n</h2>",
    "La FAQ debe tener entre 3 y 8 preguntas reales y respuestas directas.",
    "GEO: si hay contexto geografico valido, adapta ejemplos, regulacion, moneda y referencias locales. Si no, usa enfoque global.",
    "No inventes precios, promociones, certificaciones, cobertura ni datos legales no provistos.",
    `Tema central: ${topic.trim()}`,
    `Contexto geografico: ${buildGeoGuidance(context)}`,
  ].join("\n");
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("JSON_PARSE_FAILED");
    }

    return JSON.parse(match[0]) as unknown;
  }
}

function plainTextToDraft(input: GenerateAutoblogDraftInput, content: string): AutoblogDraft {
  const text = normalizeWhitespace(content);
  const title = input.topic.trim();
  const summary = truncateChars(
    stripTags(text).replace(/\s+/g, " "),
    MAX_SUMMARY_CHARS,
  );

  return {
    content: text.includes("<p") || text.includes("<h2")
      ? text
      : text
          .split(/\n{2,}/)
          .map((paragraph) => `<p>${paragraph.trim()}</p>`)
          .join("\n"),
    cta: null,
    keywords: null,
    seoDescription: summary || null,
    seoTitle: title,
    socialFacebook: summary || null,
    socialInstagram: summary || null,
    socialLinkedin: summary || null,
    socialWhatsapp: summary || null,
    summary: summary || null,
    title,
  };
}

function extractBlocks(content: string) {
  const htmlBlocks =
    content.match(
      /<(h2|h3|p|li|ul|ol|blockquote|section|article)[^>]*>[\s\S]*?<\/\1>/gi,
    ) ?? [];

  if (htmlBlocks.length > 0) {
    return htmlBlocks.map((block) => block.trim());
  }

  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function normalizeBlockText(block: string) {
  return normalizeForMatch(stripTags(decodeHtmlEntities(block)));
}

function stripBrandCandidates(block: string, brandCandidates: string[]) {
  let output = block;
  for (const candidate of [...brandCandidates].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "gi");
    output = output.replace(pattern, " ");
  }

  return normalizeWhitespace(output);
}

function isCommercialBlock(block: string) {
  const text = normalizeBlockText(block);
  return COMMERCIAL_BLOCK_PHRASES.some((pattern) => pattern.test(text));
}

function cleanContentBlocks(content: string, brandCandidates: string[]) {
  const blocks = extractBlocks(content);
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const block of blocks) {
    if (isCommercialBlock(block)) {
      continue;
    }

    const stripped = stripBrandCandidates(block, brandCandidates);
    const normalized = normalizeBlockText(stripped);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    cleaned.push(stripped);
  }

  return normalizeWhitespace(cleaned.join("\n"));
}

function hasRepeatedBlocks(content: string) {
  const blocks = extractBlocks(content);
  const seen = new Set<string>();

  for (const block of blocks) {
    const normalized = normalizeBlockText(block);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }

  return false;
}

function hasTopicCoverage(content: string, topicTerms: string[]) {
  const normalized = normalizeForMatch(content);
  const matches = topicTerms.filter((term) => normalized.includes(term));

  if (topicTerms.length <= 2) {
    return matches.length >= 1;
  }

  return matches.length >= 2 || matches.length >= Math.ceil(topicTerms.length / 4);
}

function hasMarketingLanguage(content: string) {
  const normalized = normalizeForMatch(content);
  return CORPORATE_PHRASES.some((pattern) => pattern.test(normalized));
}

function hasRequiredStructure(content: string) {
  return REQUIRED_HEADING_PATTERNS.every((pattern) => pattern.test(content));
}

function buildFaqItems(topic: string, signals: EditorialSignals) {
  const topicLabel = topic.trim();
  const hint = signals.topicTerms.length > 0 ? signals.topicTerms[0] : topicLabel;

  return [
    {
      answer: `Primero conviene definir el alcance real de ${topicLabel}, para no mezclar concepto, uso y expectativa.`,
      question: `Que deberia aclararse antes de aplicar ${topicLabel}?`,
    },
    {
      answer: `La comparacion debe hacerse con criterios medibles: costo, complejidad, tiempo, riesgo y resultados esperados.`,
      question: `Como se compara con alternativas?`,
    },
    {
      answer: `Los errores mas comunes son elegir sin contexto, ignorar limitaciones y confundir una tendencia con una solucion lista.`,
      question: `Cuales son los errores comunes?`,
    },
    {
      answer: `Tiene sentido cuando el caso de uso es concreto, los datos o referencias existen y el impacto se puede medir.`,
      question: `Cuando vale la pena usarlo?`,
    },
    {
      answer: `Si el enfoque es local, revisa ${hint}, regulacion, moneda y referencias del mercado antes de decidir.`,
      question: `Que cambia cuando hay contexto geografico?`,
    },
  ];
}

function buildFallbackContent(
  input: GenerateAutoblogDraftInput,
  context: EditorialBusinessContext | null,
  signals: EditorialSignals,
) {
  const topic = input.topic.trim();
  const intro = context?.intro
    ? `<p>${context.intro}. El enfoque editorial debe partir del problema, no de la promocion.</p>`
    : `<p>${topic} requiere una lectura practica: primero conviene entender el concepto, luego ver como se aplica y al final decidir con criterio.</p>`;
  const sourceLine = signals.sourceSummary
    ? `<p>Las referencias aportadas ayudan a contrastar definicion, funcionamiento, beneficios y riesgos sin caer en afirmaciones vacias.</p>`
    : `<p>Conviene contrastar definicion, funcionamiento, beneficios y riesgos antes de sacar conclusiones.</p>`;
  const geoSentence =
    context?.geographicScope || context?.serviceAreas
      ? `<p>Si el caso se analiza en ${compactText(
          context.geographicScope,
          context.serviceAreas,
        )}, los ejemplos deben adaptarse a regulacion, moneda y referencias locales.</p>`
      : `<p>En un enfoque global, los ejemplos deben ser neutrales y faciles de adaptar a distintos mercados.</p>`;
  const conclusion = context?.conclusion
    ? `<p>${context.conclusion}. La decision final debe apoyarse en evidencia, contexto y una lectura realista del caso.</p>`
    : `<p>La decision final debe apoyarse en evidencia, contexto y una lectura realista del caso.</p>`;
  const cta = context?.cta ? `<p>${context.cta}</p>` : "";
  const faq = buildFaqItems(topic, signals);

  return [
    intro,
    sourceLine,
    geoSentence,
    "<h2>Qu\u00e9 es</h2>",
    `<p>${topic} es un tema que conviene explicar desde los fundamentos: definicion, alcance y porque importa en la practica.</p>`,
    "<p>Una buena lectura editorial evita promesas vagas y se centra en conceptos que el lector pueda aplicar de inmediato.</p>",
    "<h2>C\u00f3mo funciona</h2>",
    "<p>El funcionamiento se entiende mejor cuando se separan tres capas: entrada de datos o contexto, proceso de analisis y resultado final.</p>",
    "<p>Eso ayuda a distinguir entre una explicacion tecnica, una estrategia de negocio y una decision operativa.</p>",
    "<h2>Beneficios</h2>",
    "<ul><li>Reduce la incertidumbre al convertir un tema amplio en pasos observables.</li><li>Ayuda a priorizar inversiones y esfuerzos.</li><li>Mejora la calidad de las decisiones porque introduce criterios medibles.</li></ul>",
    "<h2>Errores comunes</h2>",
    "<ul><li>Confundir una tendencia con una estrategia lista para ejecutar.</li><li>Vender la idea antes de validar los casos de uso reales.</li><li>Ignorar datos, contexto y limitaciones del entorno.</li></ul>",
    "<h2>Preguntas frecuentes</h2>",
    ...faq.slice(0, 4).flatMap((item) => [
      `<h3>${item.question}</h3>`,
      `<p>${item.answer}</p>`,
    ]),
    "<h2>Conclusi\u00f3n</h2>",
    conclusion,
    cta,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSeoTitle(topic: string, context: EditorialBusinessContext | null) {
  const location = compactText(context?.geographicScope, context?.serviceAreas);
  const base = topic.trim();
  const candidate = location ? `${base} | ${location}` : `${base} | Guia 2026`;
  const normalized = truncateChars(candidate, MAX_SEO_TITLE_CHARS);
  return normalized || truncateChars(base, MAX_SEO_TITLE_CHARS) || base;
}

function buildSeoDescription(
  content: string,
  topic: string,
  signals: EditorialSignals,
) {
  const summary = extractSummary(content) || topic.trim();
  if (!summary) return topic.trim();

  const normalizedSummary = normalizeWhitespace(summary);
  const topicTerms = signals.topicTerms;
  const hasCoverage = hasTopicCoverage(normalizedSummary, topicTerms);

  const description = hasCoverage
    ? normalizedSummary
    : `${topic.trim()}: ${normalizedSummary}`;

  return truncateChars(description, MAX_SEO_DESCRIPTION_CHARS) || topic.trim();
}

function buildKeywordList(
  topic: string,
  context: EditorialBusinessContext | null,
  signals: EditorialSignals,
) {
  const topicTerms = signals.topicTerms;
  const sourceTerms = extractMeaningfulTokens(signals.sourceSummary).filter(
    (term) => !topicTerms.includes(term),
  );
  const geo = compactText(context?.geographicScope, context?.serviceAreas);
  const items = [
    topic.trim(),
    `${topic.trim()} guia`,
    `${topic.trim()} 2026`,
    `${topic.trim()} beneficios`,
    `${topic.trim()} errores comunes`,
    `${topic.trim()} preguntas frecuentes`,
    geo ? `${topic.trim()} ${geo}` : null,
    ...sourceTerms.slice(0, 3).map((term) => `${topic.trim()} ${term}`),
  ].filter((item): item is string => Boolean(item));

  return uniqueStrings(items).slice(0, 8).join(", ");
}

function sanitizeOptionalCta(
  value: string | null | undefined,
  brandCandidates: string[],
) {
  const cleaned = sanitizeByRemovingTerms(
    stripCommercialPhrases(asText(value) ?? ""),
    brandCandidates,
  );

  if (!cleaned) return null;
  if (cleaned.length > 120) return null;
  if (COMMERCIAL_BLOCK_PHRASES.some((pattern) => pattern.test(normalizeForMatch(cleaned)))) {
    return null;
  }

  return cleaned;
}

function sanitizeTitle(
  value: string | null | undefined,
  brandCandidates: string[],
  topicTerms: string[],
  fallback: string,
) {
  const cleaned = sanitizeByRemovingTerms(asText(value) ?? "", brandCandidates);
  if (!cleaned) return fallback;
  if (hasMarketingLanguage(cleaned)) return fallback;
  if (!hasTopicCoverage(cleaned, topicTerms)) return fallback;

  return truncateChars(cleaned, MAX_TITLE_CHARS) || fallback;
}

function extractSummary(content: string) {
  const text = normalizeWhitespace(stripTags(decodeHtmlEntities(content)));
  if (!text) return null;

  const firstSentence = text.match(/^(.+?[.!?])\s/)?.[1];
  return firstSentence || text;
}

function buildSummaryFromContent(content: string) {
  const summary = extractSummary(content);
  return summary ? truncateChars(summary, MAX_SUMMARY_CHARS) || summary : null;
}

function shouldFallback(
  content: string,
  topicTerms: string[],
  brandCandidates: string[],
) {
  if (!content || content.length < 300) return true;
  if (hasRepeatedBlocks(content)) return true;
  if (!hasTopicCoverage(content, topicTerms)) return true;
  return false;
}

function normalizeDraft(
  input: GenerateAutoblogDraftInput,
  context: EditorialBusinessContext | null,
  signals: EditorialSignals,
  draft: AutoblogDraft,
): AutoblogDraft {
  const topic = input.topic.trim();
  const topicTerms = signals.topicTerms;
  const brandCandidates = collectBrandCandidates(input.businessContext);
  const cleanedDraftContent = cleanContentBlocks(draft.content, brandCandidates);
  const finalContent = shouldFallback(cleanedDraftContent, topicTerms, brandCandidates)
    ? cleanContentBlocks(buildFallbackContent(input, context, signals), brandCandidates)
    : cleanedDraftContent;
  const content = normalizeWhitespace(finalContent);
  const title = sanitizeTitle(draft.title, brandCandidates, topicTerms, topic);
  const summary = buildSummaryFromContent(content) ?? topic;
  const seoTitle = buildSeoTitle(title || topic, context);
  const seoDescription = buildSeoDescription(content, topic, signals);
  const keywords = buildKeywordList(topic, context, signals);
  const cta = sanitizeOptionalCta(draft.cta ?? context?.cta, brandCandidates);

  return {
    content,
    cta,
    keywords,
    seoDescription,
    seoTitle,
    socialFacebook: summary,
    socialInstagram: summary,
    socialLinkedin: summary,
    socialWhatsapp: summary,
    summary,
    title,
  };
}

async function generateWithFallback(
  settings: ConversationLayerSettingsForProvider,
  messages: Parameters<ReturnType<typeof getConversationProviderAdapter>["generateJson"]>[0]["messages"],
): Promise<AiProviderGenerateResult> {
  const adapter = getConversationProviderAdapter(settings.provider);

  try {
    return await adapter.generateJson({ messages, settings });
  } catch (error) {
    const relaxedSettings = {
      ...settings,
      outputMode: "natural_text" as const,
    };

    if (settings.provider === "gemini") {
      const modelFallbacks = [
        settings.model,
        "gemini-2.0-flash",
        "gemini-1.5-flash",
      ].filter((model, index, models) => models.indexOf(model) === index);

      let lastError = error;
      for (const model of modelFallbacks) {
        try {
          return await adapter.generateJson({
            messages,
            settings: { ...relaxedSettings, model },
          });
        } catch (nextError) {
          lastError = nextError;
        }
      }

      throw lastError;
    }

    return adapter.generateJson({ messages, settings: relaxedSettings });
  }
}

function providerErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "No se pudo generar el articulo con IA.";
  }

  if (error.message === "API_KEY_MISSING") {
    return "Falta la API key real de IA. Revisa Administracion / IA.";
  }

  if (error.message.startsWith("PROVIDER_CONNECTION_FAILED:")) {
    const status = error.message.split(":")[1] ?? "";

    if (status === "400" || status === "404") {
      return "El proveedor de IA rechazo el modelo configurado. Revisa el modelo en Administracion / IA y prueba la conexion.";
    }

    if (status === "401" || status === "403") {
      return "La API key de IA fue rechazada. Guarda una key valida en Administracion / IA.";
    }

    if (status === "429") {
      return "El proveedor de IA respondio limite de uso. Espera o revisa la cuota de la API key.";
    }

    return `El proveedor de IA rechazo la solicitud (HTTP ${status}). Revisa Administracion / IA.`;
  }

  if (error.message === "INVALID_AI_RESPONSE") {
    return "El proveedor de IA no devolvio contenido util. Prueba otro modelo en Administracion / IA.";
  }

  if (error.message === "JSON_PARSE_FAILED") {
    return "La IA respondio en un formato no compatible. Prueba de nuevo o cambia el modelo en Administracion / IA.";
  }

  return "No se pudo generar el articulo con IA.";
}

export async function getAutoblogAiStatus(): Promise<AutoblogAiStatus> {
  const settings = await getBrainAiProviderSettings();
  if (!settings.ok) {
    return {
      canGenerate: false,
      detail: settings.error.message,
      href: "/admin/ia",
      label: "IA sin configurar",
      tone: "error",
    };
  }

  if (!settings.data.enabled) {
    return {
      canGenerate: false,
      detail: "Activa la Capa de conversacion en Administracion / IA.",
      href: "/admin/ia",
      label: "IA inactiva",
      tone: "error",
    };
  }

  if (!settings.data.apiKey && settings.data.provider !== "ollama-compatible") {
    return {
      canGenerate: false,
      detail: "Falta guardar una API key real para el proveedor de IA.",
      href: "/admin/ia",
      label: "Falta API key",
      tone: "error",
    };
  }

  if (settings.data.lastTestStatus !== "success") {
    return {
      canGenerate: true,
      detail: "Hay credencial guardada, pero falta probar la conexion en Administracion / IA.",
      href: "/admin/ia",
      label: "IA sin probar",
      tone: "warning",
    };
  }

  return {
    canGenerate: true,
    detail: "Proveedor conectado y listo para generar borradores.",
    label: "IA conectada",
    tone: "ready",
  };
}

export async function isAutoblogAiConfigured() {
  return (await getAutoblogAiStatus()).canGenerate;
}

export async function generateAutoblogDraft(
  input: GenerateAutoblogDraftInput,
): Promise<GenerateAutoblogDraftResult> {
  const settings = await getBrainAiProviderSettings();
  if (!settings.ok || !settings.data.enabled) {
    return {
      message:
        "La capa de IA no esta activa. Configura IA en Administracion > IA.",
      ok: false,
    };
  }

  if (!settings.data.apiKey && settings.data.provider !== "ollama-compatible") {
    return {
      message: "Falta la API key real de IA para generar articulos.",
      ok: false,
    };
  }

  const editorialContext = buildEditorialBusinessContext(
    input.businessContext,
    input.topic,
  );
  const signals = buildEditorialSignals(input);

  try {
    const messages = [
      {
        role: "system",
        content: buildEditorialPrompt(input.topic, editorialContext),
      },
      {
        role: "user",
        content: JSON.stringify({
          businessContext: editorialContext,
          sourceNotes: asText(input.sourceNotes),
          sourceUrls: (input.sourceUrls ?? []).filter(Boolean),
          topic: input.topic.trim(),
        }),
      },
    ] satisfies Parameters<ReturnType<typeof getConversationProviderAdapter>["generateJson"]>[0]["messages"];

    const result = await generateWithFallback(settings.data, messages);

    let parsed = autoblogDraftSchema.safeParse(null);
    try {
      parsed = autoblogDraftSchema.safeParse(parseJsonObject(result.content));
    } catch {
      return {
        data: normalizeDraft(
          input,
          editorialContext,
          signals,
          plainTextToDraft(input, result.content),
        ),
        ok: true,
      };
    }

    if (!parsed.success) {
      return {
        data: normalizeDraft(
          input,
          editorialContext,
          signals,
          plainTextToDraft(input, result.content),
        ),
        ok: true,
      };
    }

    return {
      data: normalizeDraft(input, editorialContext, signals, {
        content: parsed.data.content,
        cta: asText(parsed.data.cta),
        keywords: asText(parsed.data.keywords),
        seoDescription: asText(parsed.data.seoDescription),
        seoTitle: asText(parsed.data.seoTitle),
        socialFacebook: asText(parsed.data.socialFacebook),
        socialInstagram: asText(parsed.data.socialInstagram),
        socialLinkedin: asText(parsed.data.socialLinkedin),
        socialWhatsapp: asText(parsed.data.socialWhatsapp),
        summary: asText(parsed.data.summary),
        title: parsed.data.title,
      }),
      ok: true,
    };
  } catch (error) {
    return {
      message: providerErrorMessage(error),
      ok: false,
    };
  }
}

