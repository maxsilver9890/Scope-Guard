import { similarity } from "./diff";
import { normalizeQuote } from "./provenance";
import type { CommitmentStatus, Scope, ScopeItem } from "./schema";

export const DECISION_SECTIONS = [
  "inScope",
  "outOfScope",
  "assumptions",
  "openQuestions",
  "requirements",
  "acceptanceCriteria",
] as const;

export type DecisionStatusCounts = Record<CommitmentStatus, number>;

function normalizedText(value: string): string {
  return normalizeQuote(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizedText(value).split(" ").filter(Boolean));
}

/** Share of the smaller token set that also appears in the larger one. */
function containment(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of left) {
    if (right.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.min(left.size, right.size);
}

/**
 * Decide whether two section entries are two representations of the same
 * underlying decision. Matching is deliberately conservative:
 *
 * - status is part of the identity, so incompatible labels are never merged;
 * - identical wording is always the same decision;
 * - a shared verbatim quote only merges strongly overlapping wording, so two
 *   distinct commitments derived from one paragraph stay separate.
 */
function sameDecision(a: ScopeItem, b: ScopeItem): boolean {
  if (a.status !== b.status) {
    return false;
  }

  if (normalizedText(a.text) === normalizedText(b.text)) {
    return true;
  }

  const textSimilarity = similarity(a.text, b.text);

  if (a.sourceQuote && b.sourceQuote) {
    const sameQuote =
      normalizeQuote(a.sourceQuote).toLowerCase() ===
      normalizeQuote(b.sourceQuote).toLowerCase();
    if (sameQuote) {
      return textSimilarity >= 0.8 || containment(a.text, b.text) >= 0.85;
    }
  }

  if (!a.sourceQuote && !b.sourceQuote) {
    return textSimilarity >= 0.9;
  }

  return textSimilarity >= 0.92;
}

/**
 * Executive-summary counts over distinct decisions, not section entries.
 * Every section keeps its full contents; only the aggregate is deduplicated.
 */
export function distinctDecisionStatusCounts(
  scope: Pick<Scope, (typeof DECISION_SECTIONS)[number]>,
): DecisionStatusCounts {
  const counts: DecisionStatusCounts = {
    confirmed: 0,
    inferred: 0,
    proposed: 0,
    unresolved: 0,
  };
  const seen: ScopeItem[] = [];

  for (const section of DECISION_SECTIONS) {
    for (const item of scope[section]) {
      if (seen.some((existing) => sameDecision(existing, item))) {
        continue;
      }
      seen.push(item);
      counts[item.status] += 1;
    }
  }

  return counts;
}
