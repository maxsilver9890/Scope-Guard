import type {
  Clarification,
  CommitmentSection,
  Finding,
  Scope,
  ScopeItem,
} from "./schema";

/**
 * Quote matching is whitespace-insensitive so quotes that span transcript
 * line breaks still verify, while wording and punctuation must match exactly.
 */
export function normalizeQuote(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isQuoteInSource(quote: string, source: string): boolean {
  const normalized = normalizeQuote(quote);
  return (
    normalized.length > 0 && normalizeQuote(source).includes(normalized)
  );
}

export type SourceCorpus = {
  transcript: string;
  clarifications: Clarification[];
};

export type QuoteOrigin = {
  kind: "transcript" | "clarification";
  clarificationId?: string;
  confirmed: boolean;
};

export function toSourceCorpus(source: string | SourceCorpus): SourceCorpus {
  return typeof source === "string"
    ? { transcript: source, clarifications: [] }
    : source;
}

/**
 * Locate the exact source a quote came from. The original transcript wins when
 * a phrase appears in both places, so existing client wording keeps its
 * original provenance.
 */
export function findQuoteOrigin(
  quote: string,
  source: string | SourceCorpus,
): QuoteOrigin | undefined {
  const corpus = toSourceCorpus(source);
  const normalized = normalizeQuote(quote);

  if (!normalized) {
    return undefined;
  }

  if (normalizeQuote(corpus.transcript).includes(normalized)) {
    return { kind: "transcript", confirmed: true };
  }

  for (const clarification of [...corpus.clarifications].reverse()) {
    if (normalizeQuote(clarification.answer).includes(normalized)) {
      return {
        kind: "clarification",
        clarificationId: clarification.id,
        confirmed: clarification.confirmed,
      };
    }
  }

  return undefined;
}

export type FindingProvenanceResult = {
  findings: Finding[];
  rejected: number;
  duplicates: number;
};

/**
 * Drop findings whose evidence cannot be found verbatim in the original input
 * or a recorded clarification. Invalid evidence is never replaced with a
 * fabricated quote.
 */
export function enforceFindingProvenance(
  findings: Finding[],
  source: string | SourceCorpus,
): FindingProvenanceResult {
  const kept: Finding[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let duplicates = 0;

  for (const finding of findings) {
    const snippet = normalizeQuote(finding.sourceSnippet);
    const origin = findQuoteOrigin(snippet, source);

    if (!origin) {
      rejected += 1;
      continue;
    }

    const key = snippet.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    kept.push({
      ...finding,
      sourceKind: origin.kind,
      ...(origin.clarificationId
        ? { clarificationId: origin.clarificationId }
        : {}),
    });
  }

  return { findings: kept, rejected, duplicates };
}

export type ScopeProvenanceResult = {
  scope: RepairableScope;
  downgraded: number;
};

export type RepairableScope = Omit<Scope, "clarifications"> & {
  clarifications?: Clarification[];
};

function downgradeNote(section: CommitmentSection): string {
  return section === "outOfScope"
    ? "Proposed exclusion: the source does not explicitly state this."
    : "Needs client confirmation: no verbatim support was found in the source.";
}

const DETAIL_PATTERNS = [
  /\b(?:daily|weekly|biweekly|monthly|quarterly|annually)\b/gi,
  /\b(?:automatic(?:ally)?|scheduled|real-time)\b/gi,
  /\b(?:pdf|excel|csv|xml|json)\b/gi,
  /\b\d+(?:\.\d+)?\s*(?:%|percent|seconds?|minutes?|hours?|days?|weeks?|months?)\b/gi,
  /\b(?:soc\s?2|iso\s?27001|gdpr|encrypted at rest)\b/gi,
];

const TENTATIVE_PATTERN =
  /\b(?:maybe|perhaps|might|could|i think|i'?d have to|not sure|would love|would be useful|would be nice|i'?d (?:also )?like|we would like|if it'?s easy|let'?s say yes|we can always)\b|\b(?:i would like)\b|\b(?:i'?d|i would) like\b.{0,100}\b(?:propos\w*|consider\w*|recommend\w*|option)\b/i;

/**
 * If the quote sits inside a client turn that also contains a caveat, treat
 * the statement as tentative even when the quoted fragment looks definite.
 */
export function quoteContextIsTentative(
  rawInput: string,
  quote: string,
): boolean {
  const normalizedQuote = normalizeQuote(quote);
  if (!normalizedQuote) {
    return false;
  }

  const matchingLines = rawInput
    .split(/\r?\n/)
    .filter((line) => normalizeQuote(line).includes(normalizedQuote));

  return matchingLines.some((line) => TENTATIVE_PATTERN.test(line));
}

/**
 * Find a cadence, automation, format, numeric threshold, or security guarantee
 * in the item text that is absent from the source material.
 */
export function findUnsupportedDetail(
  text: string,
  source: string,
): string | undefined {
  const lowerSource = source.toLowerCase();

  for (const pattern of DETAIL_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!lowerSource.includes(match.toLowerCase())) {
        return match;
      }
    }
  }

  return undefined;
}

function stripProvenance(item: ScopeItem): ScopeItem {
  const next: ScopeItem = { ...item };
  delete next.sourceQuote;
  delete next.sourceKind;
  delete next.clarificationId;
  return next;
}

function withOrigin(item: ScopeItem, origin: QuoteOrigin): ScopeItem {
  return {
    ...item,
    sourceKind: origin.kind,
    ...(origin.clarificationId
      ? { clarificationId: origin.clarificationId }
      : {}),
    ...(!origin.clarificationId ? { clarificationId: undefined } : {}),
  };
}

function repairItem(
  item: ScopeItem,
  corpus: SourceCorpus,
  section: CommitmentSection,
): { item: ScopeItem; downgraded: boolean } {
  const quote = item.sourceQuote?.trim();
  const origin = quote ? findQuoteOrigin(quote, corpus) : undefined;
  const clarification = origin?.clarificationId
    ? corpus.clarifications.find(
        (entry) => entry.id === origin.clarificationId,
      )
    : undefined;
  const needsSupport =
    item.status === "confirmed" || item.status === "inferred";

  // An inference without a stated rationale cannot be reviewed; treat it as a
  // proposal that still needs client approval.
  if (item.status === "inferred" && !item.rationale) {
    return {
      item: {
        text: item.text,
        status: "proposed",
        rationale:
          "Needs client confirmation: no rationale was provided for this inference.",
      },
      downgraded: true,
    };
  }

  if (needsSupport && !origin) {
    return {
      item: {
        text: item.text,
        status: "proposed",
        rationale: downgradeNote(section),
      },
      downgraded: true,
    };
  }

  // Only a client-confirmed clarification can support a confirmed commitment.
  if (
    item.status === "confirmed" &&
    origin?.kind === "clarification" &&
    !clarification?.confirmed
  ) {
    return {
      item: {
        text: item.text,
        status: "proposed",
        rationale:
          "The clarification is recorded as unconfirmed, so this cannot be a confirmed commitment.",
      },
      downgraded: true,
    };
  }

  if (needsSupport && origin?.kind === "transcript") {
    const unsupportedDetail = findUnsupportedDetail(
      item.text,
      corpus.transcript,
    );
    if (unsupportedDetail) {
      return {
        item: {
          text: item.text,
          status: "proposed",
          rationale: `Proposed because "${unsupportedDetail}" is not stated in the source.`,
        },
        downgraded: true,
      };
    }
  }

  // Tentative transcript language is not agreement, even when it verifies.
  if (
    item.status === "confirmed" &&
    origin?.kind === "transcript" &&
    quote &&
    (TENTATIVE_PATTERN.test(quote) ||
      quoteContextIsTentative(corpus.transcript, quote))
  ) {
    return {
      item: {
        text: item.text,
        status: "proposed",
        rationale:
          "The quoted source is tentative, not a confirmed commitment; needs client confirmation.",
      },
      downgraded: true,
    };
  }

  if (origin) {
    return { item: withOrigin(item, origin), downgraded: false };
  }

  // Never keep evidence that cannot be verified, even on provisional items.
  return { item: stripProvenance(item), downgraded: false };
}

function repairNonCommitmentItem(
  item: ScopeItem,
  corpus: SourceCorpus,
): ScopeItem {
  let next = item;

  if (next.status === "inferred" && !next.rationale) {
    next = {
      ...next,
      rationale: "Provisional interpretation; needs client confirmation.",
    };
  }

  const quote = next.sourceQuote?.trim();
  if (!quote) {
    return stripProvenance(next);
  }

  const origin = findQuoteOrigin(quote, corpus);
  if (!origin) {
    return stripProvenance(next);
  }

  return withOrigin(next, origin);
}

/**
 * Ensure confirmed/inferred items are actually supported by the original
 * transcript or a recorded clarification. Unsupported commitments are
 * downgraded to proposals; unverifiable quotes are stripped. A confirmed
 * commitment may only come from a client-confirmed clarification.
 */
export function repairScopeProvenance(
  scope: RepairableScope,
  source: string | SourceCorpus,
): ScopeProvenanceResult {
  const corpus = toSourceCorpus(source);
  let downgraded = 0;

  const repairList = (items: ScopeItem[], section: CommitmentSection) =>
    items.map((item) => {
      const result = repairItem(item, corpus, section);
      if (result.downgraded) {
        downgraded += 1;
      }
      return result.item;
    });

  return {
    scope: {
      ...scope,
      inScope: repairList(scope.inScope, "inScope"),
      outOfScope: repairList(scope.outOfScope, "outOfScope"),
      requirements: repairList(scope.requirements, "requirements"),
      acceptanceCriteria: repairList(
        scope.acceptanceCriteria,
        "acceptanceCriteria",
      ),
      assumptions: scope.assumptions.map((item) =>
        repairNonCommitmentItem(item, corpus),
      ),
      openQuestions: scope.openQuestions.map((item) =>
        repairNonCommitmentItem(item, corpus),
      ),
    },
    downgraded,
  };
}
