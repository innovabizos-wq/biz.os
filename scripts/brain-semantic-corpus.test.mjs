import assert from "node:assert/strict";
import test from "node:test";

import { brainSemanticCorpus } from "../src/modules/brain/evals/semantic-corpus.ts";
import { rankBusinessSkills } from "../src/modules/brain/runtime/skill-search.ts";

const mockSkills = Array.from(
  new Map(
    brainSemanticCorpus.map((item) => [
      item.expectedCapabilityId,
      {
        description: item.message,
        enabled: true,
        id: item.expectedCapabilityId,
        kind: /(crea|registra|ajusta|transfiere|confirma)/i.test(item.message)
          ? "command"
          : /prepara|redacta|escribe/i.test(item.message)
            ? "draft"
            : "query",
        module: item.expectedModule,
        name: item.message,
      },
    ]),
  ).values(),
);

test("Brain semantic corpus contains 250 unique natural-language prompts", () => {
  assert.equal(brainSemanticCorpus.length, 250);
  assert.equal(new Set(brainSemanticCorpus.map((item) => item.id)).size, 250);
  assert.equal(new Set(brainSemanticCorpus.map((item) => item.message)).size, 250);
});

test("semantic skill search exposes the expected capability for the complete corpus", () => {
  for (const item of brainSemanticCorpus) {
    const candidates = rankBusinessSkills({
      currentModule: item.expectedModule,
      limit: 5,
      message: item.message,
      skills: mockSkills,
    });
    assert.ok(
      candidates.some((candidate) => candidate.id === item.expectedCapabilityId),
      `${item.id} did not expose ${item.expectedCapabilityId}`,
    );
  }
});
