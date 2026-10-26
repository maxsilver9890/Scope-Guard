import assert from "node:assert/strict";
import { test } from "node:test";

import { scopeToPdfDefinition } from "../src/lib/pdf-export.ts";
import type { Scope } from "../src/lib/schema.ts";

function collectText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!value || typeof value !== "object") return [];

  return Object.values(value).flatMap(collectText);
}

test("PDF definition exports the effective scope and unresolved clarification state", () => {
  const answer = "Payments remain undecided pending a provider review.";
  const scope: Scope = {
    problemStatement: "A learning platform needs a clear project scope.",
    inScope: [
      {
        text: "The catalog includes client-provided testimonials.",
        status: "confirmed",
        sourceQuote: "We will provide testimonials.",
      },
      {
        text: "Payment options await provider review.",
        status: "proposed",
        rationale: "The answer remains tentative.",
      },
    ],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      { text: "Should payments be included?", status: "unresolved" },
    ],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [
      {
        id: "c1",
        question: "Should payments be included?",
        answer,
        confirmed: false,
      },
    ],
  };

  const definition = scopeToPdfDefinition(scope, []);
  const content = collectText(definition.content).join("\n");

  assert.match(content, /client-provided testimonials/);
  assert.match(content, /Payments remain undecided/);
  assert.match(content, /Should payments be included\?/);
  assert.match(content, /Unconfirmed note/);
  assert.match(content, /Current scope: question remains open/);
  assert.doesNotMatch(content, /payments are excluded/i);
});

test("PDF clarifications distinguish confirmed answers", () => {
  const scope: Scope = {
    problemStatement: "The team needs a project scope.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [
      {
        id: "c1",
        question: "Which course materials will be provided?",
        answer: "The client will provide course descriptions and testimonials.",
        confirmed: true,
      },
    ],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");

  assert.match(content, /Client-confirmed answer/);
  assert.match(content, /Current scope: question is no longer listed as open/);
  assert.match(content, /course descriptions and testimonials/);
});
