import "server-only";

import type { AutoblogSourceMode } from "@/modules/autoblog/types";

export type AutoblogResearchSource = {
  excerpt: string | null;
  title: string;
  url: string;
};

export type AutoblogResearchResult = {
  sourceNotes: string | null;
  sourceUrls: string[];
  sources: AutoblogResearchSource[];
  warnings: string[];
};

type ResearchInput = {
  sourceMode: AutoblogSourceMode;
  sourceNotes?: string | null;
  sourceUrls?: string[];
  topic: string;
};

const MAX_FETCH_BYTES = 180_000;
const MAX_RESEARCH_SOURCES = 5;
const WEB_TIMEOUT_MS = 7000;

const BLOCKED_HOSTS = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "localhost",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForSearch(value: string) {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^\[?::1\]?$/.test(host)) return true;

  return false;
}

function toSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (isPrivateHost(url.hostname)) return null;

    return url;
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
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

function stripHtml(html: string) {
  return normalizeWhitespace(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function extractTitle(html: string, fallbackUrl: string) {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ??
    html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];

  if (title) return normalizeWhitespace(stripHtml(title)).slice(0, 130);

  try {
    return new URL(fallbackUrl).hostname.replace(/^www\./, "");
  } catch {
    return fallbackUrl;
  }
}

function scoreSentence(sentence: string, terms: string[]) {
  const normalized = normalizeForSearch(sentence);
  return terms.reduce(
    (score, term) => score + (normalized.includes(term) ? 1 : 0),
    0,
  );
}

function extractRelevantExcerpt(text: string, topic: string) {
  const terms = normalizeForSearch(topic)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4)
    .slice(0, 12);
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 80 && sentence.length <= 520);
  const selected = [...sentences]
    .sort((left, right) => scoreSentence(right, terms) - scoreSentence(left, terms))
    .slice(0, 3);
  const excerpt = normalizeWhitespace(selected.join(" "));

  if (excerpt) return excerpt.slice(0, 900);
  return text.slice(0, 900);
}

async function fetchText(url: string, timeoutMs = WEB_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.2",
        "user-agent": "biz.os AutoblogResearch/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return response.text();

    const chunks: Uint8Array[] = [];
    let bytes = 0;

    while (bytes < MAX_FETCH_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      bytes += value.byteLength;
    }

    return new TextDecoder().decode(Buffer.concat(chunks));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseDuckDuckGoResults(html: string) {
  const urls: string[] = [];
  const resultPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(html)) && urls.length < 10) {
    const rawHref = decodeHtml(match[1]);
    const resolved = rawHref.startsWith("//")
      ? `https:${rawHref}`
      : rawHref.startsWith("/")
        ? `https://duckduckgo.com${rawHref}`
        : rawHref;

    try {
      const url = new URL(resolved);
      const destination = url.searchParams.get("uddg") ?? resolved;
      const safe = toSafeHttpUrl(destination);

      if (safe && safe.hostname !== "duckduckgo.com") {
        urls.push(safe.toString());
      }
    } catch {
      continue;
    }
  }

  return uniqueStrings(urls);
}

async function searchWeb(topic: string) {
  const query = encodeURIComponent(`${topic} guia mejores practicas referencias`);
  const html = await fetchText(`https://duckduckgo.com/html/?q=${query}`, WEB_TIMEOUT_MS);

  if (!html) return [];
  return parseDuckDuckGoResults(html);
}

async function readSource(urlValue: string, topic: string): Promise<AutoblogResearchSource | null> {
  const safeUrl = toSafeHttpUrl(urlValue);
  if (!safeUrl) return null;

  const html = await fetchText(safeUrl.toString());
  if (!html) return null;

  const text = stripHtml(html);
  if (text.length < 180) return null;

  return {
    excerpt: extractRelevantExcerpt(text, topic),
    title: extractTitle(html, safeUrl.toString()),
    url: safeUrl.toString(),
  };
}

function shouldAttemptWebResearch(input: ResearchInput) {
  if (process.env.AUTOBLOG_WEB_RESEARCH_DISABLED === "1") return false;
  if ((input.sourceUrls ?? []).length > 0) return true;

  return ["internal_context", "news", "trend"].includes(input.sourceMode);
}

function buildResearchNotes(input: ResearchInput, sources: AutoblogResearchSource[]) {
  const sections = [
    input.sourceNotes?.trim() ? `Notas del usuario: ${input.sourceNotes.trim()}` : null,
  ];

  if (sources.length > 0) {
    sections.push(
      [
        "Investigacion web verificada para este borrador:",
        ...sources.map((source, index) =>
          [
            `${index + 1}. ${source.title}`,
            `URL: ${source.url}`,
            source.excerpt ? `Hallazgos: ${source.excerpt}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n"),
    );
  }

  return sections.filter(Boolean).join("\n\n") || null;
}

export async function researchAutoblogTopic(
  input: ResearchInput,
): Promise<AutoblogResearchResult> {
  const warnings: string[] = [];
  const rawManualUrls = uniqueStrings(input.sourceUrls ?? []);
  const manualUrls = rawManualUrls
    .map((url) => toSafeHttpUrl(url)?.toString() ?? null)
    .filter((url): url is string => Boolean(url));

  if (rawManualUrls.length > manualUrls.length) {
    warnings.push("Algunas URLs fueron omitidas porque no son referencias web publicas validas.");
  }

  const candidateUrls = [...manualUrls];

  if (shouldAttemptWebResearch(input) && rawManualUrls.length === 0) {
    const discovered = await searchWeb(input.topic);
    candidateUrls.push(...discovered);

    if (discovered.length === 0) {
      warnings.push("No se encontraron referencias web accesibles para el tema.");
    }
  }

  const sources: AutoblogResearchSource[] = [];
  for (const url of uniqueStrings(candidateUrls)) {
    if (sources.length >= MAX_RESEARCH_SOURCES) break;
    const source = await readSource(url, input.topic);
    if (source) sources.push(source);
  }

  if (candidateUrls.length > 0 && sources.length === 0) {
    warnings.push("No se pudieron leer las referencias web disponibles.");
  }

  return {
    sourceNotes: buildResearchNotes(input, sources),
    sourceUrls: uniqueStrings([...manualUrls, ...sources.map((source) => source.url)]),
    sources,
    warnings,
  };
}
