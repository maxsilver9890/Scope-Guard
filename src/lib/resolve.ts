import { randomUUID } from "node:crypto";

import { z } from "zod";

import { critiqueScope } from "./critique";
import { compareScopes, similarity, type ScopeComparison } from "./diff";
import { generateScope } from "./generate";
import { reconcileCritique } from "./reconcile";
import {
  enforceFindingProvenance,
  isQuoteInSource,
  normalizeQuote,
  repairScopeProvenance,
} from "./provenance";
import {
  findingSchema,
  scopeSchema,
  type Clarification,
  type Finding,
  type Scope,
  type ScopeItem,
} from "./schema";

export const resolveRequestSchema = z.object({
  /** Original transcript, preserved exactly as analyzed. */
  input: z
    .string()
    .min(1)
    .max(50_000)
    .refine((value) => value.trim().length > 0, {
      message: "Source transcript is required.",
    }),
  scope: scopeSchema,
  /** Unedited scope snapshot used to detect manual changes before regeneration. */
  baseScope: scopeSchema.optional(),
  findings: z.array(findingSchema).default([]),
  question: z.string().trim().min(1).max(2_000),
  answer: z.string().trim().min(1).max(10_000),
  confirmed: z.boolean(),
  acknowledgeEdits: z.boolean().optional(),
});

export type ResolveRequest = z.infer<typeof resolveRequestSchema>;

export type ResolveResult = {
  scope: Scope;
  findings: Finding[];
  comparison: ScopeComparison;
};

export type ResolveDependencies = {
  generateScope: typeof generateScope;
  critiqueScope: typeof critiqueScope;
  newClarificationId: () => string;
};

export type ResolveOptions = {
  /** Absolute deadline shared by generation, review, and reconciliation. */
  deadline?: number;
};

export class ResolveInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolveInputError";
  }
}

function isSelectedQuestion(
  scope: Scope,
  question: string,
): boolean {
  return scope.openQuestions.some(
    (item) =>
      normalizeQuote(item.text) === normalizeQuote(question) ||
      similarity(item.text, question) >= 0.8,
  );
}

function issuesFrom(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

type CommitmentSectionKey =
  | "inScope"
  | "outOfScope"
  | "requirements"
  | "acceptanceCriteria";

function promotionSupportedByClarification(
  item: ScopeItem,
  clarifications: Clarification[],
): boolean {
  if (!item.sourceQuote) {
    return false;
  }

  return clarifications.some(
    (clarification) =>
      clarification.confirmed &&
      isQuoteInSource(item.sourceQuote ?? "", clarification.answer),
  );
}

function findPreviousItem(
  items: ScopeItem[],
  candidate: ScopeItem,
): ScopeItem | undefined {
  const exact = items.find(
    (item) => normalizeQuote(item.text) === normalizeQuote(candidate.text),
  );
  if (exact) {
    return exact;
  }

  let best: ScopeItem | undefined;
  let bestScore = 0;
  for (const item of items) {
    const score = similarity(item.text, candidate.text);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 0.8 ? best : undefined;
}

const COMMITMENT_SECTIONS: CommitmentSectionKey[] = [
  "inScope",
  "outOfScope",
  "requirements",
  "acceptanceCriteria",
];

/**
 * Keep a previously source-verified client commitment unless the latest
 * confirmed clarification produced a related, clarification-sourced update.
 */
function preserveConfirmedCommitments(
  previous: Pick<Scope, CommitmentSectionKey>,
  generated: Scope,
  clarification: Clarification,
): Scope {
  const next = { ...generated };

  for (const section of COMMITMENT_SECTIONS) {
    const items = [...next[section]];
    for (const previousItem of previous[section]) {
      if (previousItem.status !== "confirmed") continue;

      const matches = COMMITMENT_SECTIONS.flatMap((key) => next[key]).filter(
        (candidate) => similarity(previousItem.text, candidate.text) > 0,
      );
      const explicitlyUpdated =
        clarification.confirmed &&
        matches.some(
          (candidate) =>
            candidate.sourceKind === "clarification" &&
            candidate.clarificationId === clarification.id &&
            [candidate.text, candidate.sourceQuote ?? "", clarification.question].some(
              (context) => similarity(previousItem.text, context) > 0,
            ),
        );

      if (explicitlyUpdated) continue;

      const existingIndex = items.findIndex(
        (candidate) => similarity(previousItem.text, candidate.text) >= 0.55,
      );
      if (existingIndex >= 0) {
        items[existingIndex] = previousItem;
      } else {
        items.push(previousItem);
      }
    }
    next[section] = items;
  }

  return next;
}

/**
 * A proposal or inference cannot silently become a confirmed commitment just
 * because the model re-emitted it. Promotion requires evidence from a
 * client-confirmed clarification.
 */
function enforcePromotionRules(
  scope: Scope,
  previous: Scope,
  clarifications: Clarification[],
): { scope: Scope; downgraded: number } {
  let downgraded = 0;

  const repair = (section: CommitmentSectionKey) =>
    scope[section].map((item) => {
      const before = findPreviousItem(previous[section], item);
      const wasProvisional =
        before?.status === "proposed" || before?.status === "inferred";

      if (
        wasProvisional &&
        item.status === "confirmed" &&
        !promotionSupportedByClarification(item, clarifications)
      ) {
        downgraded += 1;
        return {
          text: item.text,
          status: "proposed" as const,
          rationale:
            "Promotion to confirmed requires a client-confirmed clarification.",
          ...(item.sourceQuote ? { sourceQuote: item.sourceQuote } : {}),
          ...(item.sourceKind ? { sourceKind: item.sourceKind } : {}),
          ...(item.clarificationId
            ? { clarificationId: item.clarificationId }
            : {}),
        };
      }

      return item;
    });

  return {
    scope: {
      ...scope,
      inScope: repair("inScope"),
      outOfScope: repair("outOfScope"),
      requirements: repair("requirements"),
      acceptanceCriteria: repair("acceptanceCriteria"),
    },
    downgraded,
  };
}

/**
 * Apply one clarification: regenerate the scope, revalidate provenance,
 * rerun Scope Guard, and compute a deterministic comparison.
 *
 * Model calls are injectable so the orchestration can be tested without a
 * live provider.
 */
export async function resolveScope(
  request: ResolveRequest | unknown,
  overrides: Partial<ResolveDependencies> = {},
  options: ResolveOptions = {},
): Promise<ResolveResult> {
  const parsed = resolveRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new ResolveInputError(issuesFrom(parsed.error));
  }

  const data = parsed.data;

  if (!isSelectedQuestion(data.scope, data.question)) {
    throw new ResolveInputError(
      "The selected question is not open in the current scope.",
    );
  }

  if (
    data.baseScope &&
    JSON.stringify(data.scope) !== JSON.stringify(data.baseScope) &&
    data.acknowledgeEdits !== true
  ) {
    throw new ResolveInputError(
      "The scope contains manual edits. Acknowledge replacing them before applying this clarification.",
    );
  }

  const deps: ResolveDependencies = {
    generateScope,
    critiqueScope,
    newClarificationId: () => randomUUID(),
    ...overrides,
  };

  const clarification: Clarification = {
    id: deps.newClarificationId(),
    question: data.question,
    answer: data.answer,
    confirmed: data.confirmed,
  };

  const clarifications = [...data.scope.clarifications, clarification];
  const corpus = { transcript: data.input, clarifications };

  const generated = await deps.generateScope(data.input, {
    clarification,
    clarifications,
    currentScope: data.scope,
    deadline: options.deadline,
  });

  // Re-run provenance here as a trust boundary, even though the real
  // generator already validates. This catches injected or future generators.
  const repaired = repairScopeProvenance(generated, corpus);
  const promoted = enforcePromotionRules(
    { ...repaired.scope, clarifications },
    data.scope,
    clarifications,
  );
  if (promoted.downgraded > 0) {
    console.warn(
      `[resolve] blocked ${promoted.downgraded} unsupported promotion(s) to confirmed`,
    );
  }

  const trustedPreviousScope = repairScopeProvenance(
    data.baseScope ?? data.scope,
    corpus,
  ).scope;
  const preserved = preserveConfirmedCommitments(
    trustedPreviousScope,
    promoted.scope,
    clarification,
  );
  const candidate = {
    ...repairScopeProvenance(preserved, corpus).scope,
    clarifications,
  };
  const verified = scopeSchema.safeParse(candidate);
  if (!verified.success) {
    throw new Error(
      `The regenerated scope failed validation: ${issuesFrom(verified.error)}`,
    );
  }

  const generatedFindings = await deps.critiqueScope(
    data.input,
    verified.data,
    { clarifications, deadline: options.deadline },
  );
  const reconciled = await reconcileCritique(
    data.input,
    verified.data,
    enforceFindingProvenance(generatedFindings, corpus).findings,
    { clarifications, deadline: options.deadline },
    { generateScope: deps.generateScope, critiqueScope: deps.critiqueScope },
  );

  const comparison = compareScopes(
    data.scope,
    reconciled.scope,
    data.findings,
    reconciled.findings,
    {
      question: data.question,
      answer: data.answer,
      confirmed: data.confirmed,
    },
  );

  return {
    scope: reconciled.scope,
    findings: reconciled.findings,
    comparison,
  };
}
