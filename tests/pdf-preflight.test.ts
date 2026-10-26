import assert from "node:assert/strict";
import { test } from "node:test";

import { getPdfExportPreflight } from "../src/lib/clarifications.ts";
import type { Scope } from "../src/lib/schema.ts";

function testScope(): Scope {
  return {
    problemStatement: "A project needs a clear scope.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      { text: "Should online payments be included?", status: "unresolved" },
      { text: "Which regions should launch first?", status: "unresolved" },
    ],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
  };
}

test("PDF export proceeds without a warning when no unanswered questions remain", () => {
  const scope = testScope();
  scope.openQuestions = [];

  assert.deepEqual(getPdfExportPreflight(scope), {
    requiresConfirmation: false,
    count: 0,
  });
});

test("PDF preflight reports the exact unanswered question count", () => {
  const scope = testScope();
  scope.clarifications = [
    {
      id: "c1",
      question: "Should online payments be included?",
      answer: "The client confirmed online payments.",
      confirmed: true,
    },
  ];

  assert.deepEqual(getPdfExportPreflight(scope), {
    requiresConfirmation: true,
    count: 1,
    firstQuestion: scope.openQuestions[1],
  });
});

test("blank and whitespace-only clarification answers do not count as answered", () => {
  const scope = testScope();
  scope.clarifications = [
    {
      id: "c1",
      question: scope.openQuestions[0].text,
      answer: "   \n ",
      confirmed: true,
    },
  ];

  assert.equal(getPdfExportPreflight(scope).count, 2);
});

test("an unconfirmed but nonblank answer is answered without being client-confirmed", () => {
  const scope = testScope();
  scope.clarifications = [
    {
      id: "c1",
      question: "Should online payments be included?",
      answer: "Maybe later; this still needs a decision.",
      confirmed: false,
    },
  ];

  assert.equal(getPdfExportPreflight(scope).count, 1);
  assert.equal(scope.clarifications[0].confirmed, false);
});
