import { normalizeQuote } from "./provenance";
import type {
  CommitmentStatus,
  Finding,
  Scope,
  ScopeItem,
} from "./schema";

export type ComparisonSection =
  | "problemStatement"
  | "inScope"
  | "outOfScope"
  | "assumptions"
  | "openQuestions"
  | "requirements"
  | "acceptanceCriteria";

export type ItemChangeKind = "added" | "removed" | "changed" | "moved";

export type ItemChange = {
  section: ComparisonSection;
  /** Destination section when an existing decision changes section. */
  afterSection?: ComparisonSection;
  kind: ItemChangeKind;
  beforeText?: string;
  afterText?: string;
  beforeStatus?: CommitmentStatus;
  afterStatus?: CommitmentStatus;
  beforeRationale?: string;
  afterRationale?: string;
  beforeSourceKind?: string;
  afterSourceKind?: string;
  textChanged: boolean;
  statusChanged: boolean;
  provenanceChanged: boolean;
};

export type FindingChange = {
  before: Finding;
  after: Finding;
};

export type FindingsComparison = {
  resolved: Finding[];
  remaining: Finding[];
  changed: FindingChange[];
  added: Finding[];
  unmatched: Finding[];
};

export type ScopeComparison = {
  items: ItemChange[];
  findings: FindingsComparison;
  questionResolved: boolean;
  clarification: {
    question: string;
    answer: string;
    confirmed: boolean;
  };
  summary: string[];
};

export const SECTION_LABELS: Record<ComparisonSection, string> = {
  problemStatement: "Problem Statement",
  inScope: "In Scope",
  outOfScope: "Out of Scope",
  assumptions: "Assumptions",
  openQuestions: "Open Questions",
  requirements: "Requirements",
  acceptanceCriteria: "Acceptance Criteria",
};

const ITEM_SECTIONS: Exclude<ComparisonSection, "problemStatement">[] = [
  "inScope",
  "outOfScope",
  "assumptions",
  "openQuestions",
  "requirements",
  "acceptanceCriteria",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "are", "was",
  "were", "will", "must", "should", "can", "not", "but", "have", "has", "all",
  "any", "each", "their", "them", "they", "you", "your", "our", "its", "it",
  "a", "an", "to", "of", "in", "on", "at", "as", "by", "or", "be", "is", "we",
  "us", "i", "if", "may", "per", "than", "then", "there", "these", "those",
]);

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function similarity(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));

  if (left.size === 0 || right.size === 0) {
    return normalizeQuote(a).toLowerCase() === normalizeQuote(b).toLowerCase()
      ? 1
      : 0;
  }

  let shared = 0;
  for (const token of left) {
    if (right.has(token)) {
      shared += 1;
    }
  }

  return shared / (left.size + right.size - shared);
}

function itemMatchIndex(
  before: ScopeItem,
  candidates: ScopeItem[],
  used: Set<number>,
): number {
  const exactText = candidates.findIndex(
    (candidate, index) =>
      !used.has(index) &&
      normalizeQuote(candidate.text) === normalizeQuote(before.text),
  );
  if (exactText >= 0) {
    return exactText;
  }

  if (before.sourceQuote) {
    const exactQuote = candidates.findIndex(
      (candidate, index) =>
        !used.has(index) &&
        candidate.sourceQuote &&
        normalizeQuote(candidate.sourceQuote) ===
          normalizeQuote(before.sourceQuote ?? "") &&
        similarity(before.text, candidate.text) >= 0.3,
    );
    if (exactQuote >= 0) {
      return exactQuote;
    }
  }

  let bestIndex = -1;
  let bestScore = 0;
  candidates.forEach((candidate, index) => {
    if (used.has(index)) {
      return;
    }
    const score = similarity(before.text, candidate.text);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 0.55 ? bestIndex : -1;
}

/**
 * Cross-section moves must be much stronger than same-section rewordings.
 * A requirement and an acceptance criterion can discuss adjacent ideas with
 * shared vocabulary; treating those as one moved item would hide a real
 * removal or addition.
 */
function strongItemMatch(before: ScopeItem, candidate: ScopeItem): boolean {
  if (normalizeQuote(before.text) === normalizeQuote(candidate.text)) {
    return true;
  }

  if (
    before.sourceQuote &&
    candidate.sourceQuote &&
    normalizeQuote(before.sourceQuote) === normalizeQuote(candidate.sourceQuote) &&
    similarity(before.text, candidate.text) >= 0.3
  ) {
    return true;
  }

  return similarity(before.text, candidate.text) >= 0.75;
}

function changeFromPair(
  section: Exclude<ComparisonSection, "problemStatement">,
  before: ScopeItem,
  after: ScopeItem,
): ItemChange | undefined {
  const textChanged = normalizeQuote(before.text) !== normalizeQuote(after.text);
  const statusChanged = before.status !== after.status;
  const provenanceChanged = before.sourceKind !== after.sourceKind;

  if (!textChanged && !statusChanged && !provenanceChanged) {
    return undefined;
  }

  return {
    section,
    kind: "changed",
    beforeText: before.text,
    afterText: after.text,
    beforeStatus: before.status,
    afterStatus: after.status,
    beforeRationale: before.rationale,
    afterRationale: after.rationale,
    beforeSourceKind: before.sourceKind,
    afterSourceKind: after.sourceKind,
    textChanged,
    statusChanged,
    provenanceChanged,
  };
}

export function questionStillOpen(scope: Scope, question: string): boolean {
  return scope.openQuestions.some(
    (item) =>
      normalizeQuote(item.text) === normalizeQuote(question) ||
      similarity(item.text, question) >= 0.6,
  );
}

export function relatedTextToQuestion(text: string, question: string): boolean {
  const questionTokens = tokens(question);
  if (questionTokens.length === 0) {
    return false;
  }

  const textTokens = new Set(tokens(text));
  const overlap = questionTokens.filter((token) => textTokens.has(token)).length;

  return overlap / questionTokens.length >= 0.34;
}

export function relatedToQuestion(finding: Finding, question: string): boolean {
  return relatedTextToQuestion(
    `${finding.description} ${finding.sourceSnippet} ${finding.whyItMatters}`,
    question,
  );
}

/**
 * A related proposal or inference that is still present means the underlying
 * decision has not been approved yet, even if the open question was removed.
 */
function provisionalDecisionStillRepresentsQuestion(
  scope: Scope,
  question: string,
): boolean {
  const questionTokens = tokens(question);
  if (questionTokens.length === 0) {
    return false;
  }

  return (
    ["inScope", "outOfScope", "requirements", "acceptanceCriteria"] as const
  ).some((section) =>
    scope[section].some((item) => {
      if (item.status !== "proposed" && item.status !== "inferred") {
        return false;
      }
      const itemTokens = new Set(
        tokens(`${item.text} ${item.sourceQuote ?? ""}`),
      );
      const overlap = questionTokens.filter((token) =>
        itemTokens.has(token),
      ).length;
      return overlap / questionTokens.length >= 0.5;
    }),
  );
}

/**
 * The selected question can be worded differently from the finding. If a
 * proposal describing the same feature is still present, the issue is not
 * resolved just because the open question disappeared.
 */
function provisionalDecisionStillRepresentsFinding(
  scope: Scope,
  finding: Finding,
): boolean {
  const findingTokens = new Set(
    tokens(`${finding.description} ${finding.sourceSnippet}`),
  );

  return (
    ["inScope", "outOfScope", "requirements", "acceptanceCriteria"] as const
  ).some((section) =>
    scope[section].some((item) => {
      if (item.status !== "proposed" && item.status !== "inferred") {
        return false;
      }
      const itemTokens = new Set(
        tokens(`${item.text} ${item.sourceQuote ?? ""}`),
      );
      let shared = 0;
      for (const token of findingTokens) {
        if (itemTokens.has(token)) {
          shared += 1;
        }
      }
      return shared >= 2;
    }),
  );
}

function findingKey(finding: Finding): string {
  return `${finding.type}|${normalizeQuote(finding.description).toLowerCase()}`;
}

function compareFindings(
  before: Finding[],
  after: Finding[],
  afterScope: Scope,
  questionResolved: boolean,
  question: string,
  clarificationConfirmed: boolean,
): FindingsComparison {
  const used = new Set<number>();
  const remaining: Finding[] = [];
  const changed: FindingChange[] = [];
  const resolved: Finding[] = [];
  const unmatched: Finding[] = [];
  const decisionStillProvisional = provisionalDecisionStillRepresentsQuestion(
    afterScope,
    question,
  );

  for (const oldFinding of before) {
    const exactIndex = after.findIndex(
      (candidate, index) =>
        !used.has(index) && findingKey(candidate) === findingKey(oldFinding),
    );
    if (exactIndex >= 0) {
      used.add(exactIndex);
      remaining.push(after[exactIndex]);
      continue;
    }

    const snippetIndex = after.findIndex(
      (candidate, index) =>
        !used.has(index) &&
        normalizeQuote(candidate.sourceSnippet).toLowerCase() ===
          normalizeQuote(oldFinding.sourceSnippet).toLowerCase(),
    );
    if (snippetIndex >= 0) {
      used.add(snippetIndex);
      changed.push({ before: oldFinding, after: after[snippetIndex] });
      continue;
    }

    const similarIndex = after.findIndex(
      (candidate, index) =>
        !used.has(index) &&
        candidate.type === oldFinding.type &&
        similarity(candidate.description, oldFinding.description) >= 0.5,
    );
    if (similarIndex >= 0) {
      used.add(similarIndex);
      changed.push({ before: oldFinding, after: after[similarIndex] });
      continue;
    }

    if (
      questionResolved &&
      clarificationConfirmed &&
      !decisionStillProvisional &&
      !provisionalDecisionStillRepresentsFinding(afterScope, oldFinding) &&
      relatedToQuestion(oldFinding, question)
    ) {
      resolved.push(oldFinding);
    } else {
      unmatched.push(oldFinding);
    }
  }

  const added = after.filter((_, index) => !used.has(index));

  return { resolved, remaining, changed, added, unmatched };
}

export function isScopeComparison(value: unknown): value is ScopeComparison {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.items) ||
    !Array.isArray(candidate.summary) ||
    typeof candidate.questionResolved !== "boolean" ||
    !candidate.clarification ||
    typeof candidate.clarification !== "object"
  ) {
    return false;
  }

  const clarification = candidate.clarification as Record<string, unknown>;
  if (
    typeof clarification.question !== "string" ||
    typeof clarification.answer !== "string" ||
    typeof clarification.confirmed !== "boolean"
  ) {
    return false;
  }

  if (!candidate.findings || typeof candidate.findings !== "object") {
    return false;
  }

  const findings = candidate.findings as Record<string, unknown>;
  return ["resolved", "remaining", "changed", "added", "unmatched"].every(
    (key) => Array.isArray(findings[key]),
  );
}

export function compareScopes(
  before: Scope,
  after: Scope,
  beforeFindings: Finding[],
  afterFindings: Finding[],
  clarification: { question: string; answer: string; confirmed: boolean },
): ScopeComparison {
  const items: ItemChange[] = [];
  const matchedAfter = new Set<string>();

  if (
    normalizeQuote(before.problemStatement) !==
    normalizeQuote(after.problemStatement)
  ) {
    items.push({
      section: "problemStatement",
      kind: "changed",
      beforeText: before.problemStatement,
      afterText: after.problemStatement,
      textChanged: true,
      statusChanged: false,
      provenanceChanged: false,
    });
  }

  for (const section of ITEM_SECTIONS) {
    const used = new Set<number>();

    for (const oldItem of before[section]) {
      const availableSameSection = after[section].map((item, index) =>
        matchedAfter.has(`${section}:${index}`) ? { ...item, text: "" } : item,
      );
      const matchIndex = itemMatchIndex(oldItem, availableSameSection, used);

      if (matchIndex >= 0) {
        used.add(matchIndex);
        matchedAfter.add(`${section}:${matchIndex}`);
        const change = changeFromPair(
          section,
          oldItem,
          after[section][matchIndex],
        );
        if (change) {
          items.push(change);
        }
      } else {
        let movedMatch:
          | {
              section: (typeof ITEM_SECTIONS)[number];
              index: number;
              alreadyRepresented: boolean;
            }
          | undefined;
        for (const destination of ITEM_SECTIONS) {
          if (destination === section) continue;

          const openIndex = after[destination].findIndex(
            (candidate, index) =>
              !matchedAfter.has(`${destination}:${index}`) &&
              strongItemMatch(oldItem, candidate),
          );
          if (openIndex >= 0) {
            movedMatch = {
              section: destination,
              index: openIndex,
              alreadyRepresented: false,
            };
            break;
          }

          // A duplicate representation may already have matched in its own
          // section. It still means the underlying decision was retained.
          const representedIndex = after[destination].findIndex(
            (candidate, index) =>
              matchedAfter.has(`${destination}:${index}`) &&
              strongItemMatch(oldItem, candidate),
          );
          if (representedIndex >= 0) {
            movedMatch = {
              section: destination,
              index: representedIndex,
              alreadyRepresented: true,
            };
            break;
          }
        }

        if (movedMatch) {
          const afterItem = after[movedMatch.section][movedMatch.index];
          if (!movedMatch.alreadyRepresented) {
            matchedAfter.add(`${movedMatch.section}:${movedMatch.index}`);
          }
          const statusChanged = oldItem.status !== afterItem.status;
          const textChanged = normalizeQuote(oldItem.text) !== normalizeQuote(afterItem.text);
          const provenanceChanged = oldItem.sourceKind !== afterItem.sourceKind;
          items.push({
            section,
            afterSection: movedMatch.section,
            kind: statusChanged || textChanged || provenanceChanged ? "changed" : "moved",
            beforeText: oldItem.text,
            afterText: afterItem.text,
            beforeStatus: oldItem.status,
            afterStatus: afterItem.status,
            beforeRationale: oldItem.rationale,
            afterRationale: afterItem.rationale,
            beforeSourceKind: oldItem.sourceKind,
            afterSourceKind: afterItem.sourceKind,
            textChanged,
            statusChanged,
            provenanceChanged,
          });
        } else {
          items.push({
            section,
            kind: "removed",
            beforeText: oldItem.text,
            beforeStatus: oldItem.status,
            beforeRationale: oldItem.rationale,
            beforeSourceKind: oldItem.sourceKind,
            textChanged: true,
            statusChanged: false,
            provenanceChanged: false,
          });
        }
      }
    }

  }

  for (const section of ITEM_SECTIONS) {
    after[section].forEach((newItem, index) => {
      if (matchedAfter.has(`${section}:${index}`)) return;
      items.push({
        section,
        kind: "added",
        afterText: newItem.text,
        afterStatus: newItem.status,
        afterRationale: newItem.rationale,
        afterSourceKind: newItem.sourceKind,
        textChanged: true,
        statusChanged: false,
        provenanceChanged: false,
      });
    });
  }

  const questionResolved = !questionStillOpen(after, clarification.question);
  const findings = compareFindings(
    beforeFindings,
    afterFindings,
    after,
    questionResolved,
    clarification.question,
    clarification.confirmed,
  );

  const added = items.filter((item) => item.kind === "added").length;
  const removed = items.filter((item) => item.kind === "removed").length;
  const changedItems = items.filter((item) => item.kind === "changed").length;

  const moved = items.filter((item) => item.kind === "moved").length;
  const summary = [
    clarification.confirmed
      ? "Clarification recorded as confirmed by the client."
      : "Clarification recorded as an unconfirmed note; commitments were not upgraded.",
    questionResolved
      ? "The selected open question no longer appears in the updated scope."
      : "The selected open question remains open.",
    added + removed + changedItems === 0 && moved === 0
      ? "No scope items changed."
      : `${added} item(s) added, ${removed} removed, ${changedItems} changed${moved ? `, ${moved} moved between sections without changing the decision` : ""}.`,
    `${findings.resolved.length} finding(s) resolved, ${findings.remaining.length} retained, ${findings.changed.length} reworded, ${findings.added.length} new, ${findings.unmatched.length} not re-reported.`,
  ];

  return {
    items,
    findings,
    questionResolved,
    clarification,
    summary,
  };
}
