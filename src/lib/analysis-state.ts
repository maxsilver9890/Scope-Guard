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

/**
 * How long each indicative loading message stays visible. These labels
 * describe the work the pipeline is doing; they do not claim that a stage has
 * actually completed, because the API returns only after the full pipeline.
 */
export const ANALYSIS_LOADING_INTERVAL_MS = 15_000;

/** The label for the primary analysis action, given the current state. */
export function analyzeButtonLabel(
  isAnalyzing: boolean,
  hasAnalysis: boolean,
): string {
  if (isAnalyzing) {
    return hasAnalysis ? "Re-analyzing brief…" : "Analyzing brief…";
  }
  return hasAnalysis ? "Re-analyze" : "Analyze";
}

/** Indicative messages shown while the two-pass analysis is running. */
export function analysisLoadingMessages(hasAnalysis: boolean): string[] {
  return hasAnalysis
    ? [
        "Re-reading the updated source",
        "Rebuilding the structured scope",
        "Refreshing assumptions and findings",
        "Validating the updated scope",
      ]
    : [
        "Preparing source material",
        "Generating structured scope",
        "Reviewing assumptions and gaps",
        "Validating scope consistency",
      ];
}

/** Advance through the loading messages without overshooting the final one. */
export function nextAnalysisLoadingStep(
  current: number,
  total: number,
): number {
  return Math.min(current + 1, Math.max(0, total - 1));
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
