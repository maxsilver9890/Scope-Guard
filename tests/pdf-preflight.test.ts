import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPdfPreflightSummary, getPdfExportPreflight, runPdfExportIntent } from "../src/lib/clarifications.ts";
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
    unansweredCount: 0,
    tentativeCount: 0,
    confirmedButUnresolvedCount: 0,
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
    count: 2,
    unansweredCount: 1,
    tentativeCount: 0,
    confirmedButUnresolvedCount: 1,
    firstQuestion: scope.openQuestions[0],
  });
});

test("blank and whitespace-only answers remain unanswered", () => {
  const scope = testScope();
  scope.openQuestions = [scope.openQuestions[0]];
  scope.clarifications = [
    {
      id: "c1",
      question: scope.openQuestions[0].text,
      answer: "   \n ",
      confirmed: true,
    },
  ];

  assert.equal(getPdfExportPreflight(scope).count, 1);
  assert.equal(getPdfExportPreflight(scope).unansweredCount, 1);
});

test("a tentative answer remains unresolved and is counted distinctly", () => {
  const scope = testScope();
  scope.openQuestions = [scope.openQuestions[0]];
  scope.clarifications = [
    {
      id: "c1",
      question: "Should online payments be included?",
      answer: "Maybe later; this still needs a decision.",
      confirmed: false,
    },
  ];

  assert.equal(getPdfExportPreflight(scope).count, 1);
  assert.equal(getPdfExportPreflight(scope).tentativeCount, 1);
  assert.equal(getPdfExportPreflight(scope).unansweredCount, 0);
  assert.equal(scope.clarifications[0].confirmed, false);
});

test("a client-confirmed answer that leaves the question open is still unresolved", () => {
  const scope = testScope();
  scope.clarifications = [{
    id: "c1",
    question: scope.openQuestions[0].text,
    answer: "Online deposits may be considered later; launch method remains undecided.",
    confirmed: true,
  }];

  const preflight = getPdfExportPreflight(scope);
  assert.equal(preflight.count, 2);
  assert.equal(preflight.confirmedButUnresolvedCount, 1);
  assert.equal(preflight.unansweredCount, 1);
});

test("answered and resolved questions do not warn", () => {
  const scope = testScope();
  scope.openQuestions = [];
  scope.clarifications = [{
    id: "c1",
    question: "Should online payments be included?",
    answer: "No online payments at launch.",
    confirmed: true,
  }];

  assert.equal(getPdfExportPreflight(scope).requiresConfirmation, false);
});

test("eight open questions all require confirmation with a live count", () => {
  const scope = testScope();
  scope.openQuestions = Array.from({ length: 8 }, (_, index) => ({
    text: `Clarification ${index + 1}?`,
    status: "unresolved" as const,
  }));

  assert.equal(getPdfExportPreflight(scope).count, 8);
  assert.equal(getPdfExportPreflight(scope).unansweredCount, 8);
});

test("preflight reflects a clarification answer added after the initial count", () => {
  const scope = testScope();
  assert.equal(getPdfExportPreflight(scope).unansweredCount, 2);
  scope.clarifications = [{
    id: "c1",
    question: scope.openQuestions[0].text,
    answer: "Maybe; we still need a decision.",
    confirmed: false,
  }];

  const latest = getPdfExportPreflight(scope);
  assert.equal(latest.count, 2);
  assert.equal(latest.unansweredCount, 1);
  assert.equal(latest.tentativeCount, 1);
});

test("preflight classifies a repeated question using the latest recorded answer", () => {
  const scope = testScope();
  const question = scope.openQuestions[0].text;
  scope.clarifications = [
    { id: "old", question, answer: "Maybe later.", confirmed: false },
    { id: "new", question, answer: "The final decision is still pending.", confirmed: true },
  ];

  const latest = getPdfExportPreflight(scope);
  assert.equal(latest.confirmedButUnresolvedCount, 1);
  assert.equal(latest.tentativeCount, 0);
});

test("preflight associates a substantially reworded clarification with its open decision", () => {
  const scope = testScope();
  scope.openQuestions = [{ text: "Which payment approach should launch?", status: "unresolved" }];
  scope.clarifications = [{
    id: "c1",
    question: "Which payment approach should be included in the first release?",
    answer: "The launch payment decision still needs approval.",
    confirmed: false,
  }];

  const preflight = getPdfExportPreflight(scope);
  assert.equal(preflight.tentativeCount, 1);
  assert.equal(preflight.unansweredCount, 0);
});

test("twelve unresolved scope decisions trigger an exact, non-overlapping warning summary", () => {
  const scope = testScope();
  const decisions = [
    "What delivery channel will customers use?",
    "Who owns the product inventory approval?",
    "Which countries are in the first rollout?",
    "What date is the public announcement planned for?",
    "Which supplier provides shipping rates?",
    "Where should customer records be stored?",
    "What process handles product returns?",
    "Which team will maintain the catalog?",
    "How are refunds approved by finance?",
    "What accessibility standard should apply?",
    "Which analytics events should be tracked?",
    "Who signs off on the launch checklist?",
  ];
  scope.openQuestions = decisions.map((text) => ({
    text,
    status: "unresolved" as const,
  }));
  scope.clarifications = [
    { id: "c1", question: scope.openQuestions[0].text, answer: "Maybe after review.", confirmed: false },
    { id: "c2", question: scope.openQuestions[1].text, answer: "The client confirmed the preference, but timing remains open.", confirmed: true },
  ];

  const preflight = getPdfExportPreflight(scope);
  assert.equal(preflight.count, 12);
  assert.equal(preflight.unansweredCount, 10);
  assert.equal(preflight.tentativeCount, 1);
  assert.equal(preflight.confirmedButUnresolvedCount, 1);
  assert.equal(
    formatPdfPreflightSummary(preflight),
    "12 scope decisions remain open: 10 unanswered clarification questions; 2 decisions have answers recorded but remain unresolved.",
  );
});

test("Review questions never downloads and returns the first current unresolved decision", () => {
  const scope = testScope();
  const events: string[] = [];
  const outcome = runPdfExportIntent(scope, "review", {
    warn: () => events.push("warning"),
    review: (question) => events.push(question?.text ?? "no-question"),
    download: () => events.push("download"),
  });

  assert.equal(outcome, "review");
  assert.deepEqual(events, [scope.openQuestions[0].text]);
});

test("Download anyway exports the latest supplied draft despite unresolved questions", () => {
  const scope = testScope();
  const latestDraft = { ...scope, problemStatement: "Latest edited draft." };
  const events: unknown[] = [];
  const outcome = runPdfExportIntent(latestDraft, "download-anyway", {
    warn: () => events.push("warning"),
    review: () => events.push("review"),
    download: (current) => events.push(current),
  });

  assert.equal(outcome, "download");
  assert.deepEqual(events, [latestDraft]);
});

test("a fully resolved scope downloads without a warning", () => {
  const scope = testScope();
  scope.openQuestions = scope.openQuestions.map((question) => ({ ...question, status: "confirmed" as const }));
  const events: string[] = [];
  const outcome = runPdfExportIntent(scope, "download", {
    warn: () => events.push("warning"),
    review: () => events.push("review"),
    download: () => events.push("download"),
  });

  assert.equal(outcome, "download");
  assert.deepEqual(events, ["download"]);
});
