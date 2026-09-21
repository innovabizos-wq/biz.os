import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export {};" };
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

const { researchAutoblogTopic } = await import(
  new URL("../src/modules/autoblog/research.ts", import.meta.url)
);

function response(body, contentType = "text/html") {
  return new Response(body, {
    headers: { "content-type": contentType },
    status: 200,
  });
}

test("Autoblog research searches the web and builds verified notes", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);

    if (target.startsWith("https://duckduckgo.com/html/")) {
      return response(`
        <html><body>
          <a class="result__a" href="/l/?uddg=${encodeURIComponent("https://example.com/seguridad")}">Seguridad en bodegas</a>
        </body></html>
      `);
    }

    if (target === "https://example.com/seguridad") {
      return response(`
        <html>
          <head><title>Guia de seguridad en bodegas</title></head>
          <body>
            <main>
              <p>La seguridad industrial en bodegas requiere mapear riesgos de montacargas,
              pasillos, estanterias, cargas pesadas y condiciones inseguras antes de definir
              controles operativos.</p>
              <p>Los indicadores utiles incluyen incidentes, casi accidentes, inspecciones
              vencidas y cumplimiento de rutas de evacuacion.</p>
            </main>
          </body>
        </html>
      `);
    }

    return new Response("", { status: 404 });
  };

  try {
    const result = await researchAutoblogTopic({
      sourceMode: "internal_context",
      topic: "Seguridad industrial en bodegas",
    });

    assert.ok(calls.some((call) => call.startsWith("https://duckduckgo.com/html/")));
    assert.deepEqual(result.sourceUrls, ["https://example.com/seguridad"]);
    assert.equal(result.sources.length, 1);
    assert.match(result.sourceNotes ?? "", /Investigacion web verificada/);
    assert.match(result.sourceNotes ?? "", /mapear riesgos de montacargas/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Autoblog research blocks private and local URLs", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return response("<html><title>Local</title><body>secret</body></html>");
  };

  try {
    const result = await researchAutoblogTopic({
      sourceMode: "news",
      sourceUrls: ["http://localhost:54321/private", "http://192.168.0.4/admin"],
      topic: "tema",
    });

    assert.deepEqual(calls, []);
    assert.deepEqual(result.sourceUrls, []);
    assert.equal(result.sources.length, 0);
    assert.match(result.warnings.join(" "), /omitidas/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
