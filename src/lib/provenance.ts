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
  /\b(?:sync(?:s|ed|ing)?|synchroni[sz](?:e|es|ed|ing|ation))\b/gi,
  /\b(?:without (?:any )?(?:customer|checkout) (?:issues|problems)|zero (?:incidents|failures|errors)|never fail(?:s|ure)?|100\s*%\s*(?:uptime|reliability)|guaranteed (?:secure|reliable))\b/gi,
];

const TENTATIVE_PATTERN =
  /\b(?:maybe|perhaps|might|could|i think|i'?d have to|not sure|would love|would (?:also )?be useful|would be nice|i'?d (?:also )?like|we would like|if it'?s easy|let'?s say yes|we can always)\b|\b(?:i would like)\b|\b(?:i'?d|i would) like\b.{0,100}\b(?:propos\w*|consider\w*|recommend\w*|option)\b/i;

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

const PROPOSED_SCOPE_REVIEW_PATTERN =
  /include (?:it )?in (?:the )?proposed scope/i;

/**
 * A client can explicitly ask for a requested feature to be considered in the
 * proposed scope. That supports the request while still leaving approval to
 * the client, so the item must stay proposed rather than being reported as
 * unsupported or silently promoted.
 */
export function requestedForProposedReview(
  transcript: string,
  quote: string,
): boolean {
  const normalizedQuote = normalizeQuote(quote);
  if (!normalizedQuote) {
    return false;
  }

  if (PROPOSED_SCOPE_REVIEW_PATTERN.test(normalizedQuote)) {
    return true;
  }

  return transcript.split(/\r?\n/).some((line) => {
    const normalizedLine = normalizeQuote(line);
    return (
      normalizedLine.includes(normalizedQuote) &&
      PROPOSED_SCOPE_REVIEW_PATTERN.test(normalizedLine)
    );
  });
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

function provisionalWithEvidence(
  item: ScopeItem,
  origin: QuoteOrigin,
  rationale: string,
): ScopeItem {
  return {
    text: item.text,
    status: "proposed",
    rationale,
    ...(item.sourceQuote ? { sourceQuote: item.sourceQuote } : {}),
    sourceKind: origin.kind,
    ...(origin.clarificationId ? { clarificationId: origin.clarificationId } : {}),
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
  const proposedReviewRequested = Boolean(
    quote && requestedForProposedReview(corpus.transcript, quote),
  );

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
        item: provisionalWithEvidence(
          item,
          origin,
          `Proposed because the specific detail “${unsupportedDetail}” is not stated in the source; the broader need remains supported by the quoted source.`,
        ),
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
      item: provisionalWithEvidence(
        item,
        origin,
        proposedReviewRequested
          ? "The client asked to include this in the proposed scope for review; it still needs approval as a commitment."
          : "The quoted source is tentative, not a confirmed commitment; needs client confirmation.",
      ),
      downgraded: true,
    };
  }

  if (origin) {
    if (item.status === "proposed" && proposedReviewRequested) {
      return {
        item: {
          ...withOrigin(item, origin),
          rationale: "The client asked to include this in the proposed scope for review; it still needs approval as a commitment.",
        },
        downgraded: false,
      };
    }
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

function repairAssumptionItem(
  item: ScopeItem,
  corpus: SourceCorpus,
): ScopeItem {
  if (item.status !== "confirmed") {
    return repairNonCommitmentItem(item, corpus);
  }

  const quote = item.sourceQuote?.trim();
  const origin = quote ? findQuoteOrigin(quote, corpus) : undefined;
  const clarification = origin?.clarificationId
    ? corpus.clarifications.find((entry) => entry.id === origin.clarificationId)
    : undefined;
  const tentative = Boolean(
    origin?.kind === "transcript" && quote &&
    (TENTATIVE_PATTERN.test(quote) || quoteContextIsTentative(corpus.transcript, quote)),
  );
  const unsupportedDetail =
    origin?.kind === "transcript"
      ? findUnsupportedDetail(item.text, corpus.transcript)
      : undefined;

  if (!origin || (origin.kind === "clarification" && !clarification?.confirmed) || tentative || unsupportedDetail) {
    const rationale = unsupportedDetail
      ? `Treated as an inference because the specific detail “${unsupportedDetail}” is not stated in the source.`
      : "Treated as an inference because the source does not establish this as a confirmed decision.";
    const downgraded: ScopeItem = {
      ...item,
      status: "inferred",
      rationale: item.rationale ?? rationale,
    };
    return origin ? withOrigin(downgraded, origin) : stripProvenance(downgraded);
  }

  return withOrigin(item, origin);
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
      assumptions: scope.assumptions.map((item) => repairAssumptionItem(item, corpus)),
      openQuestions: scope.openQuestions.map((item) =>
        repairNonCommitmentItem(item, corpus),
      ),
    },
    downgraded,
  };
}

const CLAIM_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "are", "was",
  "were", "will", "must", "should", "can", "not", "but", "have", "has", "all",
  "any", "each", "their", "them", "they", "you", "your", "our", "its", "it",
  "a", "an", "to", "of", "in", "on", "at", "as", "by", "or", "be", "is", "we",
  "us", "i", "if", "may", "per", "than", "then", "there", "these", "those",
  "scope", "source", "client", "item", "listed", "marked", "treated",
  "which", "what", "who", "when", "where", "how", "used", "use", "choose", "chosen", "select", "selected",
]);

function claimTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !CLAIM_STOPWORDS.has(token)),
  );
}

function tokenSimilarity(a: string, b: string): number {
  const left = claimTokens(a);
  const right = claimTokens(b);
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

function tokenContainment(a: string, b: string): number {
  const left = claimTokens(a);
  const right = claimTokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

const CLAIMS_CONFIRMED_PATTERN =
  /\b(?:is|are|was|were|marked|treated|recorded|presented|listed|shown|shows?|keeps?|remains?)\b[^.!?]{0,32}\b(?:confirmed|approved|agreed|committed|guaranteed)\b/i;
const CLAIMS_UNSUPPORTED_PATTERN =
  /\b(?:unsupported|not supported|no (?:source|transcript) (?:support|evidence)|absent from the source|not (?:stated|mentioned|requested|included) in (?:the )?(?:source|transcript)|never (?:requested|mentioned|included|stated))\b/i;
const CLAIMS_DECISION_UNRESOLVED_PATTERN =
  /\b(?:unresolved|undecided|remain(?:s|ed)?(?: completely)? unresolved|still (?:open|undecided|unresolved)|not yet (?:decided|selected|chosen|confirmed)|has not been (?:decided|selected|chosen|confirmed)|hasn't been (?:decided|selected|chosen|confirmed)|not finalized)\b/i;

/**
 * Findings are generated by a model, so they can still misdescribe the
 * document they are reviewing. Drop only the narrow case where an
 * `unsupported-assumption` finding calls a provisional, source-backed
 * proposal an approved commitment or claims the client never requested it.
 * Genuine gaps about a provisional item (for example, an undefined delivery
 * format) are classified as missing information and pass through untouched.
 */
export function filterFindingsInconsistentWithScope(
  findings: Finding[],
  scope: Pick<Scope, CommitmentSection | "openQuestions">,
  source: string | SourceCorpus,
): { findings: Finding[]; dropped: number; updated: number } {
  const corpus = toSourceCorpus(source);
  const sections: CommitmentSection[] = [
    "inScope",
    "outOfScope",
    "requirements",
    "acceptanceCriteria",
  ];
  const decisions = sections.flatMap((section) => scope[section]);
  const latestClarifications = [...corpus.clarifications].reverse().filter(
    (clarification, index, reversed) =>
      reversed.findIndex((candidate) =>
        normalizeQuote(candidate.question).toLowerCase() ===
        normalizeQuote(clarification.question).toLowerCase(),
      ) === index,
  );

  const kept: Finding[] = [];
  let dropped = 0;
  let updated = 0;

  for (const finding of findings) {
    if (CLAIMS_DECISION_UNRESOLVED_PATTERN.test(finding.description)) {
      const resolvedClarification = latestClarifications.find((clarification) => {
        if (!clarification.confirmed) return false;
        const findingAboutQuestion = Math.max(
          tokenContainment(clarification.question, finding.description),
          tokenContainment(clarification.question, finding.sourceSnippet),
        ) >= 0.34;
        const scopeHasConfirmedDecision = decisions.some((item) =>
          item.status === "confirmed" && Math.max(
            tokenContainment(item.text, clarification.question),
            tokenContainment(item.sourceQuote ?? "", clarification.question),
            tokenContainment(item.text, clarification.answer),
          ) >= 0.34,
        );
        return findingAboutQuestion && scopeHasConfirmedDecision;
      });

      if (resolvedClarification) {
        const stillOpen = scope.openQuestions.filter((question) =>
          Math.max(
            tokenContainment(question.text, finding.description),
            tokenContainment(question.text, finding.sourceSnippet),
          ) >= 0.34 &&
          tokenContainment(question.text, resolvedClarification.question) < 0.5,
        );
        if (stillOpen.length > 0) {
          kept.push({
            ...finding,
            description: `Other decisions cited in this risk remain open: ${stillOpen.map((question) => question.text).join("; ")}.`,
            whyItMatters:
              "These remaining open decisions may affect scope, dependencies, cost, or acceptance criteria.",
          });
          updated += 1;
        } else {
          dropped += 1;
        }
        continue;
      }
    }

    if (finding.type !== "unsupported-assumption") {
      kept.push(finding);
      continue;
    }

    const related = decisions.filter((item) => {
      const scores = [
        tokenSimilarity(item.text, finding.description),
        tokenSimilarity(item.text, finding.sourceSnippet),
      ];
      if (item.sourceQuote) {
        scores.push(tokenSimilarity(item.sourceQuote, finding.sourceSnippet));
      }
      return Math.max(...scores) >= 0.2;
    });
    const confirmed = related.filter((item) => item.status === "confirmed");
    const provisional = related.filter(
      (item) => item.status === "proposed" || item.status === "inferred",
    );

    const sourceBackedProposal = provisional.some((item) => {
      if (!item.sourceQuote) {
        return false;
      }
      return (
        findQuoteOrigin(item.sourceQuote, corpus) !== undefined &&
        (normalizeQuote(item.sourceQuote) ===
          normalizeQuote(finding.sourceSnippet) ||
          tokenSimilarity(item.sourceQuote, finding.sourceSnippet) >= 0.6)
      );
    });

    const misstatesStatus =
      CLAIMS_CONFIRMED_PATTERN.test(finding.description) &&
      provisional.length > 0 &&
      confirmed.length === 0;
    const deniesSourcedProposal =
      CLAIMS_UNSUPPORTED_PATTERN.test(finding.description) &&
      sourceBackedProposal &&
      confirmed.length === 0;

    if (misstatesStatus || deniesSourcedProposal) {
      dropped += 1;
      continue;
    }

    kept.push(finding);
  }

  return { findings: kept, dropped, updated };
}
