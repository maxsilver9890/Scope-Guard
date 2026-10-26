import { normalizeQuote } from "./provenance";
import type { Clarification, Scope, ScopeItem } from "./schema";

/**
 * Open questions without a nonblank recorded answer. Confirmation is tracked
 * separately: an unconfirmed note is still an answer, but not a commitment.
 */
export function unansweredClarificationQuestions(
  scope: Pick<Scope, "openQuestions" | "clarifications">,
): ScopeItem[] {
  const answered = new Set(
    scope.clarifications
      .filter((clarification: Clarification) => clarification.answer.trim())
      .map((clarification) => normalizeQuote(clarification.question)),
  );

  return scope.openQuestions.filter(
    (question) =>
      question.status === "unresolved" &&
      !answered.has(normalizeQuote(question.text)),
  );
}

export function getPdfExportPreflight(
  scope: Pick<Scope, "openQuestions" | "clarifications">,
): { requiresConfirmation: boolean; count: number; firstQuestion?: ScopeItem } {
  const questions = unansweredClarificationQuestions(scope);
  return {
    requiresConfirmation: questions.length > 0,
    count: questions.length,
    ...(questions[0] ? { firstQuestion: questions[0] } : {}),
  };
}
