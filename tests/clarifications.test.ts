import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findQuoteOrigin,
  enforceFindingProvenance,
  repairScopeProvenance,
} from "../src/lib/provenance.ts";
import {
  ResolveInputError,
  resolveRequestSchema,
  resolveScope,
  type ResolveRequest,
} from "../src/lib/resolve.ts";
import { ScopeReconciliationError } from "../src/lib/reconcile.ts";
import { formatClarificationsForReview } from "../src/lib/scope-format.ts";
import type { Clarification, Finding, Scope } from "../src/lib/schema.ts";

const TRANSCRIPT = `Dana: We need a dashboard for the team.
Dana: I need a report for the Monday meeting. Nothing fancy.`;

const QUESTION = "What is the report delivery time?";

const CONFIRMED: Clarification = {
  id: "c1",
  question: QUESTION,
  answer: "The report must be ready every Monday at 8 AM.",
  confirmed: true,
};

const UNCONFIRMED: Clarification = { ...CONFIRMED, confirmed: false };

function scope(overrides: Partial<Scope> = {}): Scope {
  return {
    problemStatement: "The team needs one place to see work.",
    inScope: [
      {
        text: "A dashboard for the team",
        status: "confirmed",
        sourceQuote: "We need a dashboard for the team",
      },
    ],
    outOfScope: [],
    assumptions: [],
    openQuestions: [{ text: QUESTION, status: "unresolved" }],
    requirements: [
      {
        text: "The report must be ready before the Monday meeting.",
        status: "proposed",
        rationale: "The client asked for a report but did not set a delivery time.",
      },
    ],
    acceptanceCriteria: [],
    clarifications: [],
    ...overrides,
  };
}

function finding(
  description: string,
  sourceSnippet = "I need a report for the Monday meeting.",
): Finding {
  return {
    type: "missing-info",
    description,
    whyItMatters: "Delivery time affects the build and the acceptance test.",
    sourceSnippet,
  };
}

function generatedScope(confirmed: boolean): Scope {
  return {
    problemStatement: "The team needs one place to see work.",
    inScope: [
      {
        text: "A dashboard for the team",
        status: "confirmed",
        sourceQuote: "We need a dashboard for the team",
      },
    ],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [
      {
        text: "The report must be ready before the Monday meeting.",
        status: "confirmed",
        sourceQuote: "every Monday at 8 AM",
      },
    ],
    acceptanceCriteria: [],
    clarifications: confirmed ? [CONFIRMED] : [UNCONFIRMED],
  };
}

function deps(
  generated: Scope,
  findings: Finding[] = [],
  capture?: (input: string) => void,
) {
  return {
    generateScope: async (input: string) => {
      capture?.(input);
      return generated;
    },
    critiqueScope: async () => findings,
    newClarificationId: () => "c1",
  };
}

function request(overrides: Partial<ResolveRequest> = {}): ResolveRequest {
  return {
    input: TRANSCRIPT,
    scope: scope(),
    findings: [finding("The report delivery time is undefined.")],
    question: QUESTION,
    answer: CONFIRMED.answer,
    confirmed: true,
    ...overrides,
  };
}

test("repeated clarification answers mark only the newest response as current", () => {
  const block = formatClarificationsForReview([
    { id: "old", question: QUESTION, answer: "Maybe Monday.", confirmed: false },
    { id: "new", question: QUESTION, answer: "Still undecided.", confirmed: true },
  ]);

  assert.match(block, /HISTORICAL RESPONSE; SUPERSEDED BY LATEST RESPONSE; UNCONFIRMED NOTE/);
  assert.match(block, /LATEST RESPONSE; CONFIRMED BY CLIENT/);
});

test("findQuoteOrigin distinguishes transcript and clarification quotes", () => {
  const corpus = { transcript: TRANSCRIPT, clarifications: [CONFIRMED] };

  assert.deepEqual(findQuoteOrigin("We need a dashboard", corpus), {
    kind: "transcript",
    confirmed: true,
  });
  assert.deepEqual(findQuoteOrigin("every Monday at 8 AM", corpus), {
    kind: "clarification",
    clarificationId: "c1",
    confirmed: true,
  });
  assert.equal(findQuoteOrigin("not in either source", corpus), undefined);
});

test("a confirmed clarification can support a confirmed requirement", () => {
  const corpus = { transcript: TRANSCRIPT, clarifications: [CONFIRMED] };
  const repaired = repairScopeProvenance(generatedScope(true), corpus);

  assert.equal(repaired.scope.requirements[0].status, "confirmed");
  assert.equal(repaired.scope.requirements[0].sourceKind, "clarification");
  assert.equal(repaired.scope.requirements[0].clarificationId, "c1");
});

test("an unconfirmed clarification cannot support a confirmed requirement", () => {
  const corpus = { transcript: TRANSCRIPT, clarifications: [UNCONFIRMED] };
  const repaired = repairScopeProvenance(generatedScope(false), corpus);

  assert.equal(repaired.scope.requirements[0].status, "proposed");
  assert.match(
    repaired.scope.requirements[0].rationale ?? "",
    /unconfirmed/i,
  );
});

test("clarification evidence is attributed on findings", () => {
  const corpus = { transcript: TRANSCRIPT, clarifications: [CONFIRMED] };
  const result = enforceFindingProvenance(
    [finding("The confirmation adds a delivery time.", "every Monday at 8 AM")],
    corpus,
  );

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].sourceKind, "clarification");
  assert.equal(result.findings[0].clarificationId, "c1");
});

test("fabricated clarification quotes are rejected", () => {
  const corpus = { transcript: TRANSCRIPT, clarifications: [CONFIRMED] };
  const result = enforceFindingProvenance(
    [finding("Invented evidence.", "The client agreed to weekly emails.")],
    corpus,
  );

  assert.equal(result.findings.length, 0);
  assert.equal(result.rejected, 1);
});

test("resolveScope applies a confirmed clarification and records provenance", async () => {
  let capturedInput = "";
  const result = await resolveScope(
    request(),
    deps(generatedScope(true), [], (input) => {
      capturedInput = input;
    }),
  );

  assert.equal(capturedInput, TRANSCRIPT);
  assert.equal(result.scope.requirements[0].status, "confirmed");
  assert.equal(result.scope.requirements[0].sourceKind, "clarification");
  assert.equal(result.scope.clarifications.length, 1);
  assert.equal(result.scope.clarifications[0].confirmed, true);
  assert.equal(result.scope.clarifications[0].question, QUESTION);
  assert.equal(result.scope.clarifications[0].answer, CONFIRMED.answer);
  assert.equal(result.comparison.questionResolved, true);
});

test("a confirmed answer updates the main scope and removes the stale exclusion", async () => {
  const question = "Should online payments be included?";
  const answer = "The client confirmed online payments are required.";
  const source = `${TRANSCRIPT}\nDana: Online payments are still undecided.`;
  const before = scope({
    outOfScope: [
      {
        text: "Online payments are excluded from the initial scope.",
        status: "proposed",
        rationale: "The client has not decided whether to include payments.",
      },
    ],
    openQuestions: [{ text: question, status: "unresolved" }],
  });
  const next = {
    ...scope({ openQuestions: [] }),
    inScope: [
      {
        text: "Online payments are available.",
        status: "confirmed" as const,
        sourceQuote: answer,
      },
    ],
    requirements: [
      {
        text: "Support online payments.",
        status: "confirmed" as const,
        sourceQuote: answer,
      },
    ],
  };
  let inputUsed = "";
  const result = await resolveScope(
    request({
      input: source,
      scope: before,
      question,
      answer,
      confirmed: true,
      findings: [
        finding(
          "Online payments were incorrectly classified as excluded.",
          "Online payments are still undecided.",
        ),
      ],
    }),
    deps(next, [], (input) => {
      inputUsed = input;
    }),
  );

  assert.equal(result.scope.inScope[0].status, "confirmed");
  assert.equal(result.scope.inScope[0].sourceKind, "clarification");
  assert.equal(result.scope.outOfScope.length, 0);
  assert.equal(result.scope.openQuestions.length, 0);
  assert.equal(result.scope.clarifications[0].answer, answer);
  assert.equal(result.scope.clarifications[0].confirmed, true);
  assert.equal(result.findings.length, 0);
  assert.equal(result.comparison.findings.resolved.length, 1);
  assert.equal(inputUsed, source);
});

test("a clarification does not downgrade a directly confirmed unrelated commitment", async () => {
  const item = {
    text: "The course catalog includes client-provided testimonials.",
    status: "confirmed" as const,
    sourceQuote: "We will provide testimonials.",
  };
  const input = `${TRANSCRIPT}\nDana: We will provide testimonials.`;
  const before = scope({
    inScope: [scope().inScope[0], item],
    openQuestions: [{ text: QUESTION, status: "unresolved" }],
  });
  const generated = generatedScope(true);
  generated.inScope.push({
    text: item.text,
    status: "proposed",
    rationale: "The model left this client commitment provisional.",
    sourceQuote: item.sourceQuote,
  });

  const result = await resolveScope(
    request({ input, scope: before, question: QUESTION }),
    deps(generated),
  );

  const testimonial = result.scope.inScope.find((entry) =>
    entry.text.includes("testimonials"),
  );
  assert.equal(testimonial?.status, "confirmed");
  assert.equal(testimonial?.sourceQuote, item.sourceQuote);
});

test("a later confirmed clarification may change an earlier commitment", async () => {
  const item = {
    text: "The course catalog includes client-provided testimonials.",
    status: "confirmed" as const,
    sourceQuote: "We will provide testimonials.",
  };
  const input = `${TRANSCRIPT}\nDana: We will provide testimonials.`;
  const question = "Should testimonials remain included?";
  const answer = "Do not include testimonials in the first launch.";
  const before = scope({
    inScope: [scope().inScope[0], item],
    openQuestions: [{ text: question, status: "unresolved" }],
  });
  const generated = generatedScope(true);
  generated.inScope = [generated.inScope[0]];
  generated.outOfScope = [
    {
      text: "Testimonials are not included in the first launch.",
      status: "confirmed",
      sourceQuote: answer,
    },
  ];

  const result = await resolveScope(
    request({ input, scope: before, question, answer, confirmed: true }),
    deps(generated),
  );

  assert.equal(result.scope.inScope.some((entry) => entry.text.includes("testimonials")), false);
  assert.equal(result.scope.outOfScope[0].status, "confirmed");
  assert.equal(result.scope.outOfScope[0].sourceKind, "clarification");
});

test("resolveScope keeps an unconfirmed clarification out of confirmed commitments", async () => {
  const result = await resolveScope(
    request({ confirmed: false }),
    deps(generatedScope(false)),
  );

  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.equal(result.scope.clarifications[0].confirmed, false);
  assert.match(
    result.scope.clarifications[0].answer,
    /every Monday/,
  );
});

test("an unconfirmed payment-provider note is recorded without promoting the provider", async () => {
  const question = "Which payment gateway has been approved?";
  const answer = "We may continue using our existing payment provider, but we want to compare its costs and capabilities before making a final selection. No payment gateway has been approved yet.";
  const previous = scope({
    inScope: [],
    requirements: [{
      text: "Payment gateway support is proposed.",
      status: "proposed",
      rationale: "The provider selection is still open.",
    }],
    openQuestions: [{ text: question, status: "unresolved" }],
  });
  const generated: Scope = {
    ...previous,
    requirements: [{
      text: "Payment gateway is the existing provider.",
      status: "confirmed",
      sourceQuote: "We may continue using our existing payment provider",
    }],
  };

  const result = await resolveScope(request({
    input: TRANSCRIPT,
    scope: previous,
    question,
    answer,
    confirmed: false,
  }), deps(generated));

  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.equal(result.scope.clarifications[0].confirmed, false);
  assert.equal(result.scope.clarifications[0].answer, answer);
  assert.equal(result.scope.openQuestions[0].status, "unresolved");
});

test("a tentative gateway answer that says no final choice was made stays unresolved", async () => {
  const question = "Which payment gateway should the store use?";
  const answer = "We may keep the current gateway, but we need to compare options. No final selection has been made.";
  const previous = scope({
    inScope: [],
    requirements: [{ text: "Payment provider selection is proposed.", status: "proposed", rationale: "Needs client approval." }],
    openQuestions: [{ text: question, status: "unresolved" }],
  });
  const generated: Scope = {
    ...previous,
    requirements: [{ text: "Payment provider selection is proposed.", status: "proposed", rationale: "The client has not selected a provider." }],
  };
  const result = await resolveScope(request({
    input: TRANSCRIPT, scope: previous, question, answer, confirmed: false,
  }), deps(generated));

  assert.equal(result.scope.openQuestions.some((entry) => entry.status === "unresolved"), true);
  assert.equal(result.scope.clarifications[0].confirmed, false);
  assert.equal(result.scope.requirements[0].status, "proposed");
});

test("resolveScope preserves existing clarifications and unrelated commitments", async () => {
  const existing: Clarification = {
    id: "old",
    question: "Who needs access?",
    answer: "Only managers.",
    confirmed: true,
  };
  const base = scope({ clarifications: [existing] });
  const generated = generatedScope(true);
  generated.clarifications = [existing, CONFIRMED];

  const result = await resolveScope(
    request({ scope: base }),
    deps(generated),
  );

  assert.equal(result.scope.clarifications.length, 2);
  assert.equal(result.scope.clarifications[0].id, "old");
  assert.equal(result.scope.inScope[0].status, "confirmed");
  assert.equal(result.scope.inScope[0].sourceKind, "transcript");
});

test("resolveScope rejects a question that is not open", async () => {
  await assert.rejects(
    () =>
      resolveScope(
        request({ question: "What is the budget?" }),
        deps(generatedScope(true)),
      ),
    (error: unknown) =>
      error instanceof ResolveInputError &&
      /not open in the current scope/.test(error.message),
  );
});

test("resolveRequestSchema rejects empty and whitespace answers", () => {
  assert.equal(
    resolveRequestSchema.safeParse(request({ answer: "" })).success,
    false,
  );
  assert.equal(
    resolveRequestSchema.safeParse(request({ answer: "   " })).success,
    false,
  );
  assert.equal(
    resolveRequestSchema.safeParse(request({ input: "   " })).success,
    false,
  );
});

test("resolveScope propagates model failures without mutating the request", async () => {
  const base = request();
  const snapshot = JSON.parse(JSON.stringify(base));

  await assert.rejects(
    () =>
      resolveScope(base, {
        generateScope: async () => {
          throw new Error("provider unavailable");
        },
        critiqueScope: async () => [],
        newClarificationId: () => "c1",
      }),
    /provider unavailable/,
  );

  assert.deepEqual(base, snapshot);
});

test("a genuine transcript conflict fails without mutating the prior scope or note answer", async () => {
  const input = "The store will use PayLane for checkout. PayLane checkout is explicitly out of scope.";
  const answer = "We may continue using our existing payment provider, but we want to compare its costs and capabilities before making a final selection. No payment gateway has been approved yet.";
  const question = "Which payment gateway should checkout use?";
  const previous = scope({
    inScope: [{
      text: "PayLane checkout is confirmed.",
      status: "confirmed",
      sourceQuote: "The store will use PayLane for checkout.",
    }],
    openQuestions: [{ text: question, status: "unresolved" }],
  });
  const base = request({ input, scope: previous, question, answer, confirmed: false });
  const snapshot = JSON.parse(JSON.stringify(base));
  const contradictoryFinding: Finding = {
    type: "unsupported-assumption",
    description: "PayLane checkout is confirmed despite an explicit exclusion.",
    whyItMatters: "The scope cannot both require and exclude this gateway.",
    sourceSnippet: "PayLane checkout is explicitly out of scope.",
  };

  await assert.rejects(
    resolveScope(base, {
      generateScope: async () => previous,
      critiqueScope: async () => [contradictoryFinding],
      newClarificationId: () => "gateway-note",
    }),
    (error: unknown) => error instanceof ScopeReconciliationError &&
      error.conflicts.some((entry) => entry.commitment === "PayLane checkout is confirmed."),
  );

  assert.deepEqual(base, snapshot);
  assert.equal(base.answer, answer);
  assert.equal(base.scope.inScope[0].status, "confirmed");
});

test("resolveScope reports resolved, retained, and new findings", async () => {
  const oldFinding = finding("The report delivery time is undefined.");
  const retained = finding(
    "Client access conflicts with the security policy.",
    "We need a dashboard for the team",
  );
  const newFinding = finding(
    "The clarification did not define report contents.",
    "every Monday at 8 AM",
  );

  const generated = generatedScope(true);
  const result = await resolveScope(
    request({ findings: [oldFinding, retained] }),
    deps(generated, [retained, newFinding]),
  );

  assert.deepEqual(result.comparison.findings.resolved, [oldFinding]);
  assert.deepEqual(result.comparison.findings.remaining, [
    { ...retained, sourceKind: "transcript" },
  ]);
  assert.deepEqual(result.comparison.findings.added, [
    {
      ...newFinding,
      sourceKind: "clarification",
      clarificationId: "c1",
    },
  ]);
});

test("the original transcript string is never rewritten", () => {
  const original = "  Transcript with leading and trailing spaces.  ";
  const corpus = { transcript: original, clarifications: [CONFIRMED] };

  repairScopeProvenance(generatedScope(true), corpus);

  assert.equal(corpus.transcript, original);
});
test("resolveScope blocks unrelated promotions to confirmed", async () => {
  const unrelated = "The dashboard must also be available in French.";
  const supportedText = "The report must be ready before the Monday meeting.";

  const base = scope({
    requirements: [
      {
        text: unrelated,
        status: "proposed",
        rationale: "No language requirement was stated.",
      },
      {
        text: supportedText,
        status: "proposed",
        rationale: "No delivery time was stated.",
      },
    ],
  });

  const generated = generatedScope(true);
  generated.requirements = [
    {
      text: unrelated,
      status: "confirmed",
      sourceQuote: "We need a dashboard for the team",
    },
    ...generated.requirements,
  ];

  const result = await resolveScope(request({ scope: base }), deps(generated));

  const unrelatedItem = result.scope.requirements.find(
    (item) => item.text === unrelated,
  );
  const supportedItem = result.scope.requirements.find(
    (item) => item.text === supportedText,
  );

  assert.equal(unrelatedItem?.status, "proposed");
  assert.match(unrelatedItem?.rationale ?? "", /client-confirmed clarification/i);
  assert.equal(supportedItem?.status, "confirmed");
  assert.equal(supportedItem?.sourceKind, "clarification");
});

test("resolveScope passes the current edited scope to the generator", async () => {
  const edited = scope({
    problemStatement: "A manually edited problem statement.",
  });
  let received: Scope | undefined;

  await resolveScope(request({ scope: edited }), {
    generateScope: async (_input, options) => {
      received = options?.currentScope;
      return generatedScope(true);
    },
    critiqueScope: async () => [],
    newClarificationId: () => "c1",
  });

  assert.equal(
    received?.problemStatement,
    "A manually edited problem statement.",
  );
});

test("resolveScope requires explicit acknowledgement before replacing manual edits", async () => {
  const base = scope();
  const edited = { ...base, problemStatement: "A user's manually edited statement." };
  let called = false;

  await assert.rejects(
    () =>
      resolveScope(
        request({ scope: edited, baseScope: base, acknowledgeEdits: false }),
        {
          ...deps(generatedScope(true)),
          generateScope: async () => {
            called = true;
            return generatedScope(true);
          },
        },
      ),
    /acknowledge replacing them/i,
  );

  assert.equal(called, false);
});

test("resolveScope applies clarification after explicit edit-replacement acknowledgement", async () => {
  const base = scope();
  const edited = { ...base, problemStatement: "A user's manually edited statement." };
  let received: Scope | undefined;

  await resolveScope(
    request({ scope: edited, baseScope: base, acknowledgeEdits: true }),
    {
      ...deps(generatedScope(true)),
      generateScope: async (_input, options) => {
        received = options?.currentScope;
        return generatedScope(true);
      },
    },
  );

  assert.equal(received?.problemStatement, edited.problemStatement);
});

test("resolveScope does not require edit acknowledgement when the scope is unchanged", async () => {
  const unchanged = scope();
  let called = false;

  await resolveScope(
    request({ scope: unchanged, baseScope: unchanged, acknowledgeEdits: false }),
    {
      ...deps(generatedScope(true)),
      generateScope: async () => {
        called = true;
        return generatedScope(true);
      },
    },
  );

  assert.equal(called, true);
});

test("a critique failure after generation does not mutate the request", async () => {
  const base = request();
  const snapshot = JSON.parse(JSON.stringify(base));

  await assert.rejects(
    () =>
      resolveScope(base, {
        generateScope: async () => generatedScope(true),
        critiqueScope: async () => {
          throw new Error("critique provider failed");
        },
        newClarificationId: () => "c1",
      }),
    /critique provider failed/,
  );

  assert.deepEqual(base, snapshot);
});

test("an existing unconfirmed clarification cannot promote a proposal", async () => {
  const oldUnconfirmed: Clarification = {
    id: "old",
    question: "When could the report be ready?",
    answer: "Maybe Monday morning.",
    confirmed: false,
  };

  const base = scope({ clarifications: [oldUnconfirmed] });
  const generated = generatedScope(true);
  generated.requirements = [
    {
      text: "The report must be ready before the Monday meeting.",
      status: "confirmed",
      sourceQuote: "Maybe Monday morning",
    },
  ];

  const result = await resolveScope(
    request({ scope: base, confirmed: true }),
    deps(generated),
  );

  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.match(
    result.scope.requirements[0].rationale ?? "",
    /unconfirmed/i,
  );
});

test("resolveScope passes the shared pipeline deadline to generation and review", async () => {
  const deadline = Date.now() + 60_000;
  let generationDeadline: number | undefined;
  let reviewDeadline: number | undefined;

  const result = await resolveScope(
    request(),
    {
      generateScope: async (_input, options) => {
        generationDeadline = options?.deadline;
        return generatedScope(true);
      },
      critiqueScope: async (_input, _scope, options) => {
        reviewDeadline = options?.deadline;
        return [];
      },
      newClarificationId: () => "c1",
    },
    { deadline },
  );

  assert.equal(generationDeadline, deadline);
  assert.equal(reviewDeadline, deadline);
  assert.equal(result.scope.requirements[0].status, "confirmed");
});
