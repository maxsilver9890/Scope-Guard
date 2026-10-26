import { normalizeQuote } from "./provenance";
import { similarity } from "./diff";
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

function latestClarificationFor(
  clarifications: Clarification[],
  question: string,
): Clarification | undefined {
  const normalized = normalizeQuote(question);
  let closest: Clarification | undefined;
  let closestScore = 0;
  for (let index = clarifications.length - 1; index >= 0; index -= 1) {
    const candidate = clarifications[index];
    if (normalizeQuote(candidate.question) === normalized) {
      return clarifications[index];
    }
    const score = similarity(candidate.question, question);
    if (score > closestScore) {
      closest = candidate;
      closestScore = score;
    }
  }
  return closestScore >= 0.3 ? closest : undefined;
}

/**
 * An answered question still needs review while it remains in openQuestions.
 * Preserve that distinction so a tentative note or an inconclusive confirmed
 * answer is not mistaken for a resolved decision.
 */
export function unresolvedClarificationQuestions(
  scope: Pick<Scope, "openQuestions" | "clarifications">,
): Array<{
  question: ScopeItem;
  answerState: "unanswered" | "tentative" | "confirmed-but-unresolved";
}> {
  return scope.openQuestions
    .filter((question) => question.status === "unresolved")
    .map((question) => {
      const clarification = latestClarificationFor(scope.clarifications, question.text);
      return {
        question,
        answerState: !clarification?.answer.trim()
          ? "unanswered"
          : clarification.confirmed
            ? "confirmed-but-unresolved"
            : "tentative",
      };
    });
}

export function getPdfExportPreflight(
  scope: Pick<Scope, "openQuestions" | "clarifications">,
): {
  requiresConfirmation: boolean;
  count: number;
  unansweredCount: number;
  tentativeCount: number;
  confirmedButUnresolvedCount: number;
  firstQuestion?: ScopeItem;
} {
  const questions = unresolvedClarificationQuestions(scope);
  return {
    requiresConfirmation: questions.length > 0,
    count: questions.length,
    unansweredCount: questions.filter((entry) => entry.answerState === "unanswered").length,
    tentativeCount: questions.filter((entry) => entry.answerState === "tentative").length,
    confirmedButUnresolvedCount: questions.filter((entry) => entry.answerState === "confirmed-but-unresolved").length,
    ...(questions[0] ? { firstQuestion: questions[0].question } : {}),
  };
}
