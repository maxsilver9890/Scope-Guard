import { critiqueScope } from "./critique";
import { generateScope, type GenerateOptions } from "./generate";
import { similarity } from "./diff";
import { enforceFindingProvenance, repairScopeProvenance } from "./provenance";
import {
  scopeSchema,
  type Clarification,
  type Finding,
  type Scope,
  type ScopeItem,
} from "./schema";

export type ReconciliationDependencies = {
  generateScope: typeof generateScope;
  critiqueScope: typeof critiqueScope;
};

export type ReconciliationResult = {
  scope: Scope;
  findings: Finding[];
  reconciled: boolean;
};

export type ReconciliationFailureCategory =
  | "invalid-reconciled-scope"
  | "confirmed-decision-conflict";

export type ReconciliationConflictDetail = {
  section: CommitmentSection;
  commitment: string;
};

export class ScopeReconciliationError extends Error {
  readonly stage = "reconciliation-validation";

  constructor(
    readonly category: ReconciliationFailureCategory,
    readonly conflicts: ReconciliationConflictDetail[] = [],
  ) {
    super(
      category === "confirmed-decision-conflict"
        ? "The generated scope still marks a decision as confirmed even though the review found a conflict. Your previous results are unchanged. Review the flagged commitment and related open questions, then retry analysis."
        : "The generated scope could not be validated. Your previous results are unchanged. Retry analysis; if the problem continues, contact support.",
    );
    this.name = "ScopeReconciliationError";
  }
}
type CommitmentSection = "inScope" | "outOfScope" | "requirements" | "acceptanceCriteria";
const commitmentSections: CommitmentSection[] = [
  "inScope", "outOfScope", "requirements", "acceptanceCriteria",
];
const includedSections: CommitmentSection[] = ["inScope", "requirements", "acceptanceCriteria"];

function preserveUnchallengedConfirmedItems(
  previous: Scope,
  generated: Scope,
  findings: Finding[],
): Scope {
  const next = { ...generated };
  for (const section of commitmentSections) {
    const items = [...next[section]];
    for (const item of previous[section]) {
      if (item.status !== "confirmed") continue;
      const implicated = findings.some((finding) =>
        Math.max(
          similarity(item.text, finding.description),
          similarity(item.text, finding.sourceSnippet),
          item.sourceQuote ? similarity(item.sourceQuote, finding.sourceSnippet) : 0,
        ) >= 0.12,
      );
      if (implicated) continue;

      const index = items.findIndex((candidate) =>
        similarity(item.text, candidate.text) >= 0.55 ||
        Boolean(item.sourceQuote && candidate.sourceQuote && similarity(item.sourceQuote, candidate.sourceQuote) >= 0.8),
      );
      if (index < 0) items.push(item);
      else if (items[index].status !== "confirmed") items[index] = item;
    }
    next[section] = items;
  }
  return next;
}

function confirmedConflictsForFinding(
  scope: Scope,
  finding: Finding,
): ReconciliationConflictDetail[] {
  // Match the critique's description to the decision and its direction. A
  // source quote often repeats the topic while describing a different,
  // unresolved choice (for example, room categories versus product filters).
  // Matching raw quote tokens made those neighboring decisions look like
  // confirmed contradictions. An explicit exclusion must also not be read as
  // an included feature just because a critique mentions both directions.
  const minimumDecisionMatch = 0.24;
  const description = finding.description.toLowerCase();
  const saysIncluded = /\b(?:include[ds]?|in scope|approv(?:ed|es)|confirm(?:ed|s)|require[ds]?|will offer|will support)\b/.test(description);
  const saysExcluded = /\b(?:exclud(?:e|es|ed)|out of scope|not included|omitted)\b/.test(description);
  const saysUnsettled = /\b(?:undecided|not decided|tentative|not confirmed|not agreed|unapproved|despite|although|conflicts?|contradicts?|unsupported)\b/.test(description);
  const saysSourceConfirms = /\b(?:client confirms|source confirms|explicitly requested|explicitly required|agreed to|confirmed by the client)\b/.test(description);
  const sourceExplicitlyBlocks = /\b(?:explicitly excluded|expressly excluded|forbidden|prohibited|refused|denied|will not approve|cannot approve|unavailable)\b/i.test(finding.sourceSnippet);
  const isConditional = (text: string) =>
    /\b(?:only if|only after|subject to|conditional on|contingent on|provided that|unless|if)\b/i.test(text);
  const itemConflicts = (item: ScopeItem) => {
    const directlyMatchesDecision =
      similarity(item.text, finding.description) >= minimumDecisionMatch;
    const conditionIsPartOfDecision =
      isConditional(item.text) || Boolean(item.sourceQuote && isConditional(item.sourceQuote));

    return directlyMatchesDecision && (!conditionIsPartOfDecision || sourceExplicitlyBlocks);
  };

  const matches = (section: CommitmentSection) =>
    scope[section]
      .filter((item) => item.status === "confirmed" && itemConflicts(item))
      .map((item) => ({ section, commitment: item.text }));

  if (saysIncluded && saysUnsettled) {
    const includedConflicts = includedSections.flatMap(matches);
    if (includedConflicts.length > 0) return includedConflicts;
  }

  if (saysExcluded && saysSourceConfirms) return matches("outOfScope");
  return [];
}

/**
 * One bounded repair pass: feed the critique back into scope generation, run
 * deterministic provenance/schema checks, then critique the returned scope.
 * It never retries itself; provider or validation failures stop the pipeline.
 */
export async function reconcileCritique(
  input: string,
  scope: Scope,
  findings: Finding[],
  options: Omit<GenerateOptions, "currentScope" | "reconciliationFindings"> & {
    clarifications?: Clarification[];
  } = {},
  overrides: Partial<ReconciliationDependencies> = {},
): Promise<ReconciliationResult> {
  if (findings.length === 0) return { scope, findings, reconciled: false };

  const deps: ReconciliationDependencies = {
    generateScope,
    critiqueScope,
    ...overrides,
  };
  const clarifications = options.clarifications ?? scope.clarifications ?? [];
  const corpus = { transcript: input, clarifications };
  const rawCandidate = await deps.generateScope(input, {
    ...options,
    clarifications,
    currentScope: scope,
    reconciliationFindings: findings,
  });
  const candidate = preserveUnchallengedConfirmedItems(scope, rawCandidate, findings);
  const repaired = repairScopeProvenance(candidate, corpus);
  const parsed = scopeSchema.safeParse({ ...repaired.scope, clarifications });
  if (!parsed.success) {
    throw new ScopeReconciliationError("invalid-reconciled-scope");
  }

  const reviewed = await deps.critiqueScope(input, parsed.data, { clarifications });
  const verifiedFindings = enforceFindingProvenance(reviewed, corpus).findings;
  const unaddressed = verifiedFindings
    .filter((finding) => finding.type === "contradiction" || finding.type === "unsupported-assumption")
    .flatMap((finding) => confirmedConflictsForFinding(parsed.data, finding));
  const uniqueConflicts = [...new Map(
    unaddressed.map((conflict) => [`${conflict.section}:${conflict.commitment}`, conflict]),
  ).values()];
  if (uniqueConflicts.length > 0) {
    throw new ScopeReconciliationError("confirmed-decision-conflict", uniqueConflicts.slice(0, 5));
  }
  return { scope: parsed.data, findings: verifiedFindings, reconciled: true };
}
