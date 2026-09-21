import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export {};" };
    }

    if (specifier === "next/headers") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export async function cookies(){return {getAll(){return []},get(){return undefined},set(){},delete(){}};}",
      };
    }

    if (specifier.startsWith("@/")) {
      const base = path.join(root, "src", specifier.slice(2));
      const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
      const resolved = candidates.find((candidate) => existsSync(candidate));
      if (!resolved) throw new Error(`Cannot resolve test alias: ${specifier}`);

      return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }

    return nextResolve(specifier, context);
  },
});

const { buildAutoblogDeterministicDraftForDiagnostics } = await import(
  new URL("../src/modules/autoblog/ai.ts", import.meta.url)
);

const requiredHeadings = [
  /<h2[^>]*>Qu[eé] es<\/h2>/i,
  /<h2[^>]*>C[oó]mo funciona<\/h2>/i,
  /<h2[^>]*>Beneficios<\/h2>/i,
  /<h2[^>]*>Errores comunes<\/h2>/i,
  /<h2[^>]*>Preguntas frecuentes<\/h2>/i,
  /<h2[^>]*>Conclusi[oó]n<\/h2>/i,
];

const bannedGenericPhrases = [
  "requiere una lectura practica",
  "Conviene contrastar definicion, funcionamiento, beneficios y riesgos antes de sacar conclusiones.",
  "Reduce la incertidumbre al convertir un tema amplio en pasos observables.",
  "El funcionamiento se entiende mejor cuando se separan tres capas",
];

function assertUsefulDraft(topic, expectedFragments) {
  const draft = buildAutoblogDeterministicDraftForDiagnostics({
    businessContext: null,
    sourceNotes: `Prueba automatica de calidad editorial para ${topic}.`,
    sourceUrls: [],
    topic,
  });

  assert.equal(draft.title, topic);
  assert.ok(draft.summary && draft.summary.length > 40, `${topic}: summary missing`);
  assert.ok(draft.seoTitle?.includes(topic.slice(0, 12)), `${topic}: seo title weak`);
  assert.ok(draft.keywords?.toLowerCase().includes(topic.toLowerCase().split(" ")[0]), `${topic}: keywords weak`);
  assert.ok(draft.content.length > 1800, `${topic}: content too short`);

  for (const pattern of requiredHeadings) {
    assert.match(draft.content, pattern, `${topic}: missing required heading`);
  }

  for (const phrase of bannedGenericPhrases) {
    assert.ok(!draft.content.includes(phrase), `${topic}: contains old generic fallback`);
  }

  for (const fragment of expectedFragments) {
    assert.match(draft.content.toLowerCase(), fragment, `${topic}: missing expected topic detail`);
  }
}

test("Autoblog deterministic fallback creates topic-specific articles", () => {
  const topics = [
    {
      expected: [/mapear riesgos/, /incidentes/, /condiciones inseguras/],
      topic: "Seguridad industrial en bodegas",
    },
    {
      expected: [/punto de reorden/, /obsolet/, /dias de inventario/],
      topic: "Como reducir inventario obsoleto en una pyme",
    },
    {
      expected: [/cuentas vencidas/, /promesas de pago/, /flujo de caja/],
      topic: "Automatizacion de cobros vencidos",
    },
    {
      expected: [/leer historial/, /tiempo de respuesta/, /conversaciones abiertas/],
      topic: "WhatsApp para servicio al cliente",
    },
    {
      expected: [/consumo energetico/, /residuos/, /sostenibilidad/],
      topic: "IA y su impacto en el ambiente",
    },
  ];

  for (const item of topics) {
    assertUsefulDraft(item.topic, item.expected);
  }
});
