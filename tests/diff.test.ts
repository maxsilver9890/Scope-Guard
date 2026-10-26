import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareScopes,
  isScopeComparison,
  questionStillOpen,
  relatedToQuestion,
} from "../src/lib/diff.ts";
import type { Finding, Scope, ScopeItem } from "../src/lib/schema.ts";

function scope(overrides: Partial<Scope> = {}): Scope {
  return {
    problemStatement: "Customers need order tracking.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
    ...overrides,
  };
}

function item(
  text: string,
  status: ScopeItem["status"] = "confirmed",
): ScopeItem {
  return {
    text,
    status,
    ...(status === "confirmed" ? { sourceQuote: "order tracking" } : {}),
  };
}

function finding(
  type: Finding["type"],
  description: string,
  sourceSnippet = "order tracking",
): Finding {
  return {
    type,
    description,
    whyItMatters: "It changes what gets built.",
    sourceSnippet,
  };
}

const CLARIFICATION = {
  question: "What is the report delivery time?",
  answer: "Every Monday at 8 AM.",
  confirmed: true,
};

test("compareScopes reports status changes with unchanged text", () => {
  const before = scope({
    requirements: [item("The report is ready before the Monday meeting.", "proposed")],
  });
  const after = scope({
    requirements: [
      {
        text: "The report is ready before the Monday meeting.",
        status: "confirmed",
        sourceQuote: "Every Monday at 8 AM.",
        sourceKind: "clarification",
        clarificationId: "c1",
      },
    ],
  });

  const result = compareScopes(
    before,
    after,
    [],
    [],
    { question: "When is the report needed?", answer: "Monday", confirmed: true },
  );

  const change = result.items.find((entry) => entry.section === "requirements");
  assert.ok(change);
  assert.equal(change.kind, "changed");
  assert.equal(change.statusChanged, true);
  assert.equal(change.beforeStatus, "proposed");
  assert.equal(change.afterStatus, "confirmed");
  assert.equal(change.textChanged, false);
});

test("compareScopes reports added and removed items", () => {
  const before = scope({ inScope: [item("A dashboard")] });
  const after = scope({ inScope: [item("Order tracking portal")] });

  const result = compareScopes(
    before,
    after,
    [],
    [],
    { question: "What is included?", answer: "A portal", confirmed: true },
  );

  assert.deepEqual(
    result.items.map((entry) => entry.kind).sort(),
    ["added", "removed"],
  );
});

test("compareScopes reports a changed problem statement", () => {
  const before = scope();
  const after = scope({ problemStatement: "Customers need clearer tracking." });

  const result = compareScopes(
    before,
    after,
    [],
    [],
    { question: "What is the problem?", answer: "Tracking", confirmed: true },
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].section, "problemStatement");
  assert.equal(result.items[0].textChanged, true);
});

test("questionStillOpen matches the same question with different wording", () => {
  const current = scope({
    openQuestions: [{ text: "What is the report delivery time?", status: "unresolved" }],
  });

  assert.equal(
    questionStillOpen(current, "What delivery time is required for the report?"),
    true,
  );
  assert.equal(questionStillOpen(scope(), "What is the report delivery time?"), false);
});

test("relatedToQuestion links a finding to the resolved question", () => {
  const related = finding(
    "missing-info",
    "The report delivery time is undefined.",
  );
  const unrelated = finding(
    "contradiction",
    "Client access conflicts with the security policy.",
  );

  assert.equal(relatedToQuestion(related, CLARIFICATION.question), true);
  assert.equal(relatedToQuestion(unrelated, CLARIFICATION.question), false);
});

test("compareScopes marks a related missing finding resolved when the question closes", () => {
  const before = scope({
    openQuestions: [
      { text: "What is the report delivery time?", status: "unresolved" },
    ],
  });
  const after = scope();
  const oldFinding = finding(
    "missing-info",
    "The report delivery time is undefined.",
  );
  const retained = finding(
    "contradiction",
    "Client access conflicts with the security policy.",
    "client access",
  );

  const result = compareScopes(
    before,
    after,
    [oldFinding, retained],
    [retained],
    CLARIFICATION,
  );

  assert.equal(result.questionResolved, true);
  assert.deepEqual(result.findings.resolved, [oldFinding]);
  assert.deepEqual(result.findings.remaining, [retained]);
  assert.equal(result.findings.unmatched.length, 0);
});

test("compareScopes does not claim a finding is resolved while the question remains open", () => {
  const before = scope({
    openQuestions: [
      { text: "What is the report delivery time?", status: "unresolved" },
    ],
  });
  const oldFinding = finding(
    "missing-info",
    "The report delivery time is undefined.",
  );

  const result = compareScopes(before, before, [oldFinding], [], CLARIFICATION);

  assert.equal(result.questionResolved, false);
  assert.equal(result.findings.resolved.length, 0);
  assert.deepEqual(result.findings.unmatched, [oldFinding]);
});

test("compareScopes classifies reworded findings as changed, not resolved", () => {
  const before = scope();
  const oldFinding = finding(
    "missing-info",
    "The report delivery time is undefined.",
  );
  const reworded = finding(
    "missing-info",
    "The report delivery time is still not defined.",
  );

  const result = compareScopes(
    before,
    before,
    [oldFinding],
    [reworded],
    CLARIFICATION,
  );

  assert.equal(result.findings.changed.length, 1);
  assert.equal(result.findings.resolved.length, 0);
  assert.equal(result.findings.remaining.length, 0);
});

test("compareScopes reports newly added findings", () => {
  const current = scope();
  const newFinding = finding(
    "unsupported-assumption",
    "The answer assumes order data is available.",
    "order tracking",
  );

  const result = compareScopes(
    current,
    current,
    [],
    [newFinding],
    CLARIFICATION,
  );

  assert.deepEqual(result.findings.added, [newFinding]);
});
test("compareScopes does not resolve a reworded finding when the question closes", () => {
  const before = scope();
  const after = scope();
  const oldFinding = finding(
    "missing-info",
    "The report delivery time is undefined.",
    "delivery time is undefined",
  );
  const reworded = finding(
    "missing-info",
    "The report delivery time is still not defined.",
    "delivery time is still not defined",
  );

  const result = compareScopes(
    before,
    after,
    [oldFinding],
    [reworded],
    CLARIFICATION,
  );

  assert.equal(result.questionResolved, true);
  assert.equal(result.findings.changed.length, 1);
  assert.equal(result.findings.resolved.length, 0);
});

test("isScopeComparison accepts a valid comparison", () => {
  const comparison = compareScopes(scope(), scope(), [], [], CLARIFICATION);
  assert.equal(isScopeComparison(comparison), true);
});

test("isScopeComparison rejects malformed comparison payloads", () => {
  assert.equal(isScopeComparison(null), false);
  assert.equal(isScopeComparison({}), false);
  assert.equal(
    isScopeComparison({
      items: [],
      summary: [],
      questionResolved: true,
      clarification: { question: "Q", answer: "A", confirmed: true },
      findings: { resolved: [] },
    }),
    false,
  );
});
