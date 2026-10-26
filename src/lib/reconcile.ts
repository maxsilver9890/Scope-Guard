import { critiqueScope } from "./critique";
import { generateScope, type GenerateOptions } from "./generate";
import { similarity } from "./diff";
import { enforceFindingProvenance, repairScopeProvenance } from "./provenance";
import {
  scopeSchema,
  type Clarification,
  type Finding,
  type Scope,
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

export class ScopeReconciliationError extends Error {
  constructor() {
    super("The scope still contains a confirmed decision that conflicts with the source. Your current results were left unchanged. Review the source and open questions, then retry analysis.");
    this.name = "ScopeReconciliationError";
  }
}
type CommitmentSection = "inScope" | "outOfScope" | "requirements" | "acceptanceCriteria";
const commitmentSections: CommitmentSection[] = [
  "inScope", "outOfScope", "requirements", "acceptanceCriteria",
];

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

function hasUnresolvedIssue(scope: Scope, finding: Finding): boolean {
  return scope.openQuestions.some((question) =>
    Math.max(
      similarity(question.text, finding.description),
      similarity(question.text, finding.sourceSnippet),
    ) >= 0.18,
  );
}

function hasConfirmedConflict(scope: Scope, finding: Finding): boolean {
  return commitmentSections.some((section) => scope[section].some((item) =>
    item.status === "confirmed" && Math.max(
      similarity(item.text, finding.description),
      similarity(item.text, finding.sourceSnippet),
      item.sourceQuote ? similarity(item.sourceQuote, finding.sourceSnippet) : 0,
    ) >= 0.18,
  ));
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
    throw new ScopeReconciliationError();
  }

  const reviewed = await deps.critiqueScope(input, parsed.data, { clarifications });
  const verifiedFindings = enforceFindingProvenance(reviewed, corpus).findings;
  const unaddressed = verifiedFindings.filter((finding) =>
    (finding.type === "contradiction" || finding.type === "unsupported-assumption") &&
    (!hasUnresolvedIssue(parsed.data, finding) || hasConfirmedConflict(parsed.data, finding)),
  );
  if (unaddressed.length > 0) {
    throw new ScopeReconciliationError();
  }
  return { scope: parsed.data, findings: verifiedFindings, reconciled: true };
}
