import assert from "node:assert/strict";
import { test } from "node:test";

import {
  markdownFilename,
  markdownText,
  scopeToMarkdown,
} from "../src/lib/markdown.ts";
import type { Finding, Scope } from "../src/lib/schema.ts";

const SCOPE: Scope = {
  problemStatement: "Customers cannot track orders without contacting support.",
  inScope: [
    { text: "Order tracking portal", status: "confirmed", sourceQuote: "order tracking" },
  ],
  outOfScope: [
    {
      text: "Native mobile app",
      status: "proposed",
      rationale: "No mobile requirement was stated.",
    },
  ],
  assumptions: [
    {
      text: "Order data exists in an accessible system",
      status: "inferred",
      rationale: "The request implies reading existing orders.",
    },
  ],
  openQuestions: [
    { text: "Which system holds order data?", status: "unresolved" },
  ],
  requirements: [
    { text: "Show current order status", status: "confirmed", sourceQuote: "order tracking" },
  ],
  acceptanceCriteria: [
    {
      text: "A customer can look up an order",
      status: "proposed",
      rationale: "Suggested verification step.",
    },
  ],
  clarifications: [],
};

const FINDINGS: Finding[] = [
  {
    type: "missing-info",
    description: "The order data source is unidentified.",
    whyItMatters: "Integration effort cannot be estimated.",
    sourceSnippet: "order tracking",
  },
];

test("scopeToMarkdown includes every section and commitment status", () => {
  const { content } = scopeToMarkdown(SCOPE, FINDINGS);

  for (const heading of [
    "## Problem Statement",
    "## In Scope",
    "## Out of Scope",
    "## Assumptions",
    "## Open Questions",
    "## Requirements",
    "## Acceptance Criteria",
    "## Scope Guard Findings",
  ]) {
    assert.ok(content.includes(heading), `missing ${heading}`);
  }

  assert.ok(content.includes("**Confirmed**"));
  assert.ok(content.includes("**Proposed**"));
  assert.ok(content.includes("**Inferred**"));
  assert.ok(content.includes("**Unresolved**"));
  assert.ok(content.includes("**Why it matters:**"));
  assert.ok(content.includes("> order tracking"));
});

test("scopeToMarkdown marks edited documents", () => {
  const { content } = scopeToMarkdown(SCOPE, FINDINGS, { edited: true });
  assert.match(content, /Edited after analysis/);
});

test("scopeToMarkdown handles empty findings and empty sections", () => {
  const emptyScope: Scope = {
    ...SCOPE,
    inScope: [],
  };

  const { content } = scopeToMarkdown(emptyScope, []);

  assert.ok(content.includes("_None recorded._"));
  assert.ok(content.includes("_No findings were returned by the review._"));
});

test("markdownText escapes HTML and leading block syntax", () => {
  assert.equal(markdownText("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.equal(markdownText("# not a heading"), "\\# not a heading");
});

test("markdownFilename is meaningful and safe", () => {
  const filename = markdownFilename(SCOPE);
  assert.match(filename, /^scope-guard-customers-cannot-track-orders/);
  assert.match(filename, /^[a-z0-9-]+\.md$/);
  assert.ok(!filename.includes("--"));
});

test("markdownFilename falls back when the problem statement has no words", () => {
  assert.equal(
    markdownFilename({ ...SCOPE, problemStatement: "!!!" }),
    "scope-guard-project-scope.md",
  );
});
test("scopeToMarkdown includes client clarifications and provenance", () => {
  const clarifications = [
    {
      id: "c1",
      question: "What is the report delivery time?",
      answer: "Every Monday at 8 AM.",
      confirmed: true,
    },
  ];
  const scopeWithClarification: Scope = {
    ...SCOPE,
    clarifications,
    requirements: [
      {
        text: "The Monday report is ready at 8 AM",
        status: "confirmed",
        sourceQuote: "Every Monday at 8 AM",
        sourceKind: "clarification",
        clarificationId: "c1",
      },
    ],
  };

  const { content } = scopeToMarkdown(scopeWithClarification, FINDINGS);

  assert.ok(content.includes("## Client Clarifications"));
  assert.ok(content.includes("What is the report delivery time?"));
  assert.ok(content.includes("Every Monday at 8 AM."));
  assert.ok(content.includes("Confirmed by client"));
  assert.ok(content.includes("from a client-confirmed clarification"));
});

test("scopeToMarkdown marks unconfirmed clarifications as notes", () => {
  const scopeWithNote: Scope = {
    ...SCOPE,
    clarifications: [
      {
        id: "c2",
        question: "Who needs access?",
        answer: "Probably managers.",
        confirmed: false,
      },
    ],
  };

  const { content } = scopeToMarkdown(scopeWithNote, FINDINGS);

  assert.ok(content.includes("Unconfirmed note"));
});
