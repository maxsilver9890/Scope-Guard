import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analysisLoadingMessages,
  analysisRequestBody,
  analysisResultsReducer,
  ANALYSIS_LOADING_INTERVAL_MS,
  analyzeButtonLabel,
  EMPTY_ANALYSIS_RESULTS,
  nextAnalysisLoadingStep,
} from "../src/lib/analysis-state.ts";
import type { Scope } from "../src/lib/schema.ts";

const oldScope: Scope = {
  problemStatement: "A previous project needs recurring subscriptions.",
  inScope: [{ text: "Recurring billing is confirmed.", status: "confirmed", sourceQuote: "Recurring billing is confirmed." }],
  outOfScope: [], assumptions: [], openQuestions: [], requirements: [],
  acceptanceCriteria: [], clarifications: [],
};

const newScope: Scope = {
  problemStatement: "UrbanNest needs a home decor storefront.",
  inScope: [{ text: "Products are grouped by room.", status: "confirmed", sourceQuote: "Group products by room." }],
  outOfScope: [], assumptions: [], openQuestions: [], requirements: [],
  acceptanceCriteria: [], clarifications: [],
};

test("a failed analysis preserves the previous valid results", () => {
  const state = analysisResultsReducer(EMPTY_ANALYSIS_RESULTS, {
    type: "analysis-succeeded", input: "previous source", scope: oldScope, findings: [],
  });

  const afterFailure = analysisResultsReducer(state, { type: "analysis-failed" });

  assert.equal(afterFailure, state);
  assert.equal(afterFailure.scope, oldScope);
  assert.equal(afterFailure.editedScope, oldScope);
});

test("successful reanalysis atomically replaces results with the new validated scope", () => {
  const previous = analysisResultsReducer(EMPTY_ANALYSIS_RESULTS, {
    type: "analysis-succeeded", input: "previous source", scope: oldScope, findings: [],
  });
  const nextFindings = [{
    type: "missing-info" as const,
    description: "Confirm product filter behavior.",
    whyItMatters: "Filter implementation depends on the decision.",
    sourceSnippet: "Group products by room.",
  }];

  const next = analysisResultsReducer(previous, {
    type: "analysis-succeeded", input: "new UrbanNest source", scope: newScope, findings: nextFindings,
  });

  assert.equal(next.scope, newScope);
  assert.equal(next.editedScope, newScope);
  assert.equal(next.findings, nextFindings);
  assert.equal(next.analyzedInput, "new UrbanNest source");
  assert.equal(next.comparison, null);
  assert.equal(next.scope?.inScope.some((item) => /recurring billing/i.test(item.text)), false);
});

test("new source requests never send prior scope or findings to analysis", () => {
  const request = analysisRequestBody("UrbanNest's new e-commerce brief");

  assert.deepEqual(request, { input: "UrbanNest's new e-commerce brief" });
  assert.equal("scope" in request, false);
  assert.equal("findings" in request, false);
});

test("a retry after a failed attempt commits only the retry response", () => {
  const previous = analysisResultsReducer(EMPTY_ANALYSIS_RESULTS, {
    type: "analysis-succeeded", input: "previous source", scope: oldScope, findings: [],
  });
  const afterFailure = analysisResultsReducer(previous, { type: "analysis-failed" });
  const afterRetry = analysisResultsReducer(afterFailure, {
    type: "analysis-succeeded", input: "retry source", scope: newScope, findings: [],
  });

  assert.equal(afterFailure, previous);
  assert.equal(afterRetry.scope, newScope);
  assert.equal(afterRetry.analyzedInput, "retry source");
});

test("the analyze action reflects whether results already exist", () => {
  assert.equal(analyzeButtonLabel(false, false), "Analyze");
  assert.equal(analyzeButtonLabel(false, true), "Re-analyze");
  assert.equal(analyzeButtonLabel(true, false), "Analyzing brief\u2026");
  assert.equal(analyzeButtonLabel(true, true), "Re-analyzing brief\u2026");
});

test("loading guidance is indicative and never promises a percentage", () => {
  const initial = analysisLoadingMessages(false);
  const reanalysis = analysisLoadingMessages(true);

  assert.deepEqual(initial, [
    "Preparing source material",
    "Generating structured scope",
    "Reviewing assumptions and gaps",
    "Validating scope consistency",
  ]);
  assert.equal(reanalysis.length, initial.length);
  assert.equal(reanalysis[0], "Re-reading the updated source");
  assert.ok(ANALYSIS_LOADING_INTERVAL_MS >= 5_000);
  for (const message of [...initial, ...reanalysis]) {
    assert.doesNotMatch(message, /%|complete|finished|done/i);
  }
});

test("the loading step stops at the final message", () => {
  assert.equal(nextAnalysisLoadingStep(0, 4), 1);
  assert.equal(nextAnalysisLoadingStep(2, 4), 3);
  assert.equal(nextAnalysisLoadingStep(3, 4), 3);
});
