import type { ScopeComparison } from "./diff";
import type { Finding, Scope } from "./schema";

export type AnalysisResults = {
  scope: Scope | null;
  editedScope: Scope | null;
  findings: Finding[] | null;
  analyzedInput: string | null;
  comparison: ScopeComparison | null;
};

export type AnalysisResultsAction =
  | { type: "analysis-succeeded"; input: string; scope: Scope; findings: Finding[] }
  | { type: "clarification-succeeded"; scope: Scope; findings: Finding[]; comparison: ScopeComparison | null }
  | { type: "scope-edited"; scope: Scope }
  | { type: "analysis-failed" };

export const EMPTY_ANALYSIS_RESULTS: AnalysisResults = {
  scope: null,
  editedScope: null,
  findings: null,
  analyzedInput: null,
  comparison: null,
};

/** Analysis is stateless across source documents; only the current input goes to the API. */
export function analysisRequestBody(input: string): { input: string } {
  return { input };
}

/** Commit validated analysis atomically; failed requests retain the last valid result. */
export function analysisResultsReducer(
  state: AnalysisResults,
  action: AnalysisResultsAction,
): AnalysisResults {
  switch (action.type) {
    case "analysis-succeeded":
      return {
        scope: action.scope,
        editedScope: action.scope,
        findings: action.findings,
        analyzedInput: action.input,
        comparison: null,
      };
    case "clarification-succeeded":
      return {
        ...state,
        scope: action.scope,
        editedScope: action.scope,
        findings: action.findings,
        comparison: action.comparison,
      };
    case "scope-edited":
      return { ...state, editedScope: action.scope, comparison: null };
    case "analysis-failed":
      return state;
  }
}
