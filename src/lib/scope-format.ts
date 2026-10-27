import type { Clarification, Scope } from "./schema";

export type ReviewableScope = Omit<Scope, "clarifications">;

const SECTIONS = [
  ["In Scope", "inScope"],
  ["Out of Scope", "outOfScope"],
  ["Assumptions", "assumptions"],
  ["Open Questions", "openQuestions"],
  ["Requirements", "requirements"],
  ["Acceptance Criteria", "acceptanceCriteria"],
] as const;

function provenanceLabel(item: {
  sourceKind?: "transcript" | "clarification";
}): string {
  return item.sourceKind === "clarification" ? " · clarification" : "";
}

/**
 * Status-grouped rendering for model context. Confirmations and provisional
 * items are deliberately separated so proposals are never read as agreements.
 * Verified quotes are included for provisional items too: without them the
 * critique cannot tell a source-supported proposal from an invention.
 */
export function formatScopeForReview(scope: ReviewableScope): string {
  const confirmed: string[] = [];
  const provisional: string[] = [];

  for (const [label, key] of SECTIONS) {
    for (const item of scope[key]) {
      const rationale = item.rationale ? ` (rationale: ${item.rationale})` : "";
      const evidence = item.sourceQuote
        ? ` (source quote: “${item.sourceQuote}”)`
        : "";
      const line = `[${label} · ${item.status}${provenanceLabel(
        item,
      )}] ${item.text}${rationale}${evidence}`;
      if (item.status === "confirmed") {
        confirmed.push(line);
      } else {
        provisional.push(line);
      }
    }
  }

  return [
    "CONFIRMED COMMITMENTS (client agreement; only these are commitments):",
    confirmed.length > 0
      ? confirmed.map((line) => `- ${line}`).join("\n")
      : "- none",
    "",
    "PROVISIONAL ITEMS (proposed, inferred, or unresolved; NOT commitments):",
    provisional.length > 0
      ? provisional.map((line) => `- ${line}`).join("\n")
      : "- none",
  ].join("\n");
}

export function formatClarificationsForReview(
  clarifications: Clarification[],
): string {
  if (clarifications.length === 0) {
    return "";
  }

  const latestByQuestion = new Map<string, number>();
  clarifications.forEach((clarification, index) => {
    latestByQuestion.set(
      clarification.question.trim().replace(/\s+/g, " ").toLowerCase(),
      index,
    );
  });

  return [
    "CLIENT CLARIFICATIONS (recorded separately from the transcript):",
    "For repeated questions, only the latest response is current; earlier responses are history.",
    ...clarifications.map((clarification, index) => {
      const state = clarification.confirmed
        ? "CONFIRMED BY CLIENT"
        : "UNCONFIRMED NOTE";
      const key = clarification.question.trim().replace(/\s+/g, " ").toLowerCase();
      const recency = latestByQuestion.get(key) === index
        ? "LATEST RESPONSE"
        : "HISTORICAL RESPONSE; SUPERSEDED BY LATEST RESPONSE";
      return [
        `- [${recency}; ${state}]`,
        `  Question: ${clarification.question}`,
        `  Answer: ${clarification.answer}`,
      ].join("\n");
    }),
  ].join("\n");
}
