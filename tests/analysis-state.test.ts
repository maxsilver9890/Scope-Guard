import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analysisRequestBody,
  analysisResultsReducer,
  EMPTY_ANALYSIS_RESULTS,
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
