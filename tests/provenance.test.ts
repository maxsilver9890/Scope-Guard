import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enforceFindingProvenance,
  findUnsupportedDetail,
  isQuoteInSource,
normalizeQuote,
  quoteContextIsTentative,
  repairScopeProvenance,
} from "../src/lib/provenance.ts";
import type {
  CommitmentStatus,
  Finding,
  Scope,
  ScopeItem,
} from "../src/lib/schema.ts";

const SOURCE = `We need a dashboard for the sales team.
Budget too, if it's easy. The team keeps asking for one place to look.`;

function item(
  text: string,
  status: CommitmentStatus,
  extra: Partial<ScopeItem> = {},
): ScopeItem {
  return { text, status, ...extra };
}

function scopeWith(items: Partial<Scope> = {}): Scope {
  return {
    problemStatement: "The sales team has no single view of performance.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
    ...items,
  };
}

function finding(snippet: string): Finding {
  return {
    type: "ambiguity",
    description: "A consequential ambiguity.",
    whyItMatters: "It changes what gets built.",
    sourceSnippet: snippet,
  };
}

test("normalizeQuote collapses whitespace only", () => {
  assert.equal(normalizeQuote("  one\n\ttwo  "), "one two");
  assert.equal(normalizeQuote("one — two"), "one — two");
});

test("isQuoteInSource accepts quotes spanning line breaks", () => {
  assert.equal(
    isQuoteInSource("dashboard for the sales team. Budget too", SOURCE),
    true,
  );
  assert.equal(isQuoteInSource("single view of performance", SOURCE), false);
});

test("enforceFindingProvenance keeps verified findings and drops fabricated ones", () => {
  const findings = [
    finding("Budget too, if it's easy."),
    finding("automatic 8 AM delivery"),
    finding("one place to look"),
  ];

  const result = enforceFindingProvenance(findings, SOURCE);

  assert.equal(result.findings.length, 2);
  assert.equal(result.rejected, 1);
  assert.deepEqual(
    result.findings.map((entry) => entry.sourceSnippet),
    ["Budget too, if it's easy.", "one place to look"],
  );
});

test("repairScopeProvenance keeps verified commitments", () => {
  const scope = scopeWith({
    inScope: [
      item("A dashboard", "confirmed", {
        sourceQuote: "dashboard for the sales team",
      }),
    ],
    requirements: [
      item("Show one place to look", "inferred", {
        rationale: "The client asks for one place.",
        sourceQuote: "one place to look",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.downgraded, 0);
  assert.equal(result.scope.inScope[0].status, "confirmed");
  assert.equal(result.scope.requirements[0].status, "inferred");
});

test("repairScopeProvenance downgrades unsupported commitments to proposed", () => {
  const scope = scopeWith({
    requirements: [
      item("Automatically email the report at 8 AM", "confirmed", {
        sourceQuote: "email the report at 8 AM",
      }),
    ],
    inScope: [
      item("Budget tracking", "confirmed", {
        sourceQuote: "Budget too, if it's easy",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, SOURCE);

assert.equal(result.downgraded, 2);
  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.equal(result.scope.requirements[0].sourceQuote, undefined);
  assert.match(result.scope.requirements[0].rationale ?? "", /needs client confirmation/i);
  assert.equal(result.scope.inScope[0].status, "proposed");
  assert.match(result.scope.inScope[0].rationale ?? "", /tentative/i);
});

test("suggestions phrased as useful or explicitly proposed are not confirmed commitments", () => {
  const source = `A better filter would be useful to shoppers.\nI'd also like a staff training session so our team can manage the store.`;
  const scope = scopeWith({
    requirements: [
      item("Add a better filter for shoppers", "confirmed", {
        sourceQuote: "A better filter would be useful to shoppers.",
      }),
      item("Provide staff training", "confirmed", {
        sourceQuote: "I'd also like a staff training session so our team can manage the store.",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, source);
  assert.equal(result.downgraded, 2);
  assert.deepEqual(result.scope.requirements.map((entry) => entry.status), ["proposed", "proposed"]);
  assert.ok(result.scope.requirements.every((entry) => /tentative, not a confirmed commitment/i.test(entry.rationale ?? "")));
});

test("a firm directly requested feature remains confirmed", () => {
  const source = "The team needs a searchable catalog for customers.";
  const scope = scopeWith({
    requirements: [item("Provide a searchable catalog", "confirmed", {
      sourceQuote: source,
    })],
  });

  const result = repairScopeProvenance(scope, source);
  assert.equal(result.downgraded, 0);
  assert.equal(result.scope.requirements[0].status, "confirmed");
});

test("repairScopeProvenance marks unsupported exclusions as proposed", () => {
  const scope = scopeWith({
    outOfScope: [
      item("Client access", "confirmed", { sourceQuote: "no client access" }),
    ],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.downgraded, 1);
  assert.equal(result.scope.outOfScope[0].status, "proposed");
  assert.match(result.scope.outOfScope[0].rationale ?? "", /proposed exclusion/i);
});

test("repairScopeProvenance strips invalid evidence from assumptions", () => {
  const scope = scopeWith({
    assumptions: [
      item("Data is available in an API", "inferred", {
        rationale: "An integration is implied.",
        sourceQuote: "an existing API",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.scope.assumptions[0].status, "inferred");
  assert.equal(result.scope.assumptions[0].sourceQuote, undefined);
});

test("repairScopeProvenance does not mutate the input scope", () => {
  const original = scopeWith({
    requirements: [
      item("Automatic report", "confirmed", { sourceQuote: "not in the source" }),
    ],
  });
  const snapshot = JSON.parse(JSON.stringify(original));

  repairScopeProvenance(original, SOURCE);

  assert.deepEqual(original, snapshot);
});
test("repairScopeProvenance downgrades inferred items without a rationale", () => {
  const scope = scopeWith({
    requirements: [
      item("Keep the dashboard simple", "inferred", {
        sourceQuote: "dashboard for the sales team",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.downgraded, 1);
  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.match(result.scope.requirements[0].rationale ?? "", /no rationale/i);
});

test("repairScopeProvenance supplies a rationale for assumptions without one", () => {
  const scope = scopeWith({
    assumptions: [item("Data already exists", "inferred")],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.scope.assumptions[0].status, "inferred");
  assert.match(result.scope.assumptions[0].rationale ?? "", /provisional/i);
});

test("findUnsupportedDetail detects invented cadence, thresholds, and formats", () => {
  assert.equal(findUnsupportedDetail("Generate a weekly report", SOURCE), "weekly");
  assert.equal(findUnsupportedDetail("Pages load in under 3 seconds", SOURCE), "3 seconds");
  assert.equal(findUnsupportedDetail("Export the report as PDF", SOURCE), "PDF");
  assert.equal(findUnsupportedDetail("A report for the Monday meeting", SOURCE), undefined);
});

test("repairScopeProvenance downgrades confirmed items with invented cadence", () => {
  const scope = scopeWith({
    requirements: [
      item("Generate a weekly report for the Monday meeting", "confirmed", {
        sourceQuote: "I need a report for the Monday meeting",
      }),
    ],
});

  const result = repairScopeProvenance(
    scope,
    "I need a report for the Monday meeting.",
  );

  assert.equal(result.downgraded, 1);
  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.match(result.scope.requirements[0].rationale ?? "", /weekly/i);
});

import { extractFindings, salvageFindings } from "../src/lib/schema.ts";

test("salvageFindings keeps valid findings and drops malformed entries", () => {
  const valid = {
    type: "ambiguity",
    description: "A vague target.",
    whyItMatters: "It changes the build.",
    sourceSnippet: "some source words",
  };
  const malformed = { ...valid, whyItMatters: undefined };

  const result = salvageFindings([valid, malformed]);

  assert.ok(result);
  assert.equal(result.findings.length, 1);
  assert.equal(result.dropped, 1);
});

test("salvageFindings returns null for a non-array response", () => {
  assert.equal(salvageFindings({ findings: [] }), null);
});

test("enforceFindingProvenance collapses duplicate evidence", () => {
  const result = enforceFindingProvenance(
    [finding("one place to look"), finding("one place to look")],
    SOURCE,
  );

  assert.equal(result.findings.length, 1);
  assert.equal(result.duplicates, 1);
});

test("repairScopeProvenance downgrades confirmed tentative language", () => {
  const scope = scopeWith({
    inScope: [
      item("Budget tracking", "confirmed", {
        sourceQuote: "Budget too, if it's easy",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.downgraded, 1);
  assert.equal(result.scope.inScope[0].status, "proposed");
  assert.match(result.scope.inScope[0].rationale ?? "", /tentative/i);
});

test("repairScopeProvenance keeps confirmed non-tentative language", () => {
  const scope = scopeWith({
    inScope: [
      item("A report for the Monday meeting", "confirmed", {
        sourceQuote: "I need a report for the Monday meeting",
      }),
    ],
  });

  const result = repairScopeProvenance(
    scope,
    "I need a report for the Monday meeting.",
  );

  assert.equal(result.downgraded, 0);
  assert.equal(result.scope.inScope[0].status, "confirmed");
});

import { rawScopeSchema, scopeSchema } from "../src/lib/schema.ts";

test("raw scope validation allows repair before semantic validation", () => {
  const candidate = {
    problemStatement: "A problem.",
    inScope: [{ text: "An interpretation", status: "inferred" }],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
  };

  assert.equal(rawScopeSchema.safeParse(candidate).success, true);
  assert.equal(scopeSchema.safeParse(candidate).success, false);
});

test("extractFindings unwraps the structured-output envelope", () => {
  const findings = [{ type: "ambiguity" }];
  assert.deepEqual(extractFindings({ findings }), findings);
  assert.deepEqual(extractFindings(findings), findings);
  assert.deepEqual(extractFindings({ nope: true }), { nope: true });
});

test("quoteContextIsTentative sees caveats elsewhere in the same client turn", () => {
  const turn = "And it should talk to our accounting system — well, our bookkeeper uses something, I'd have to ask her the name.";
  assert.equal(
    quoteContextIsTentative(turn, "And it should talk to our accounting system"),
    true,
  );
  assert.equal(
    quoteContextIsTentative(
      "I need a report for the Monday meeting. Nothing fancy.",
      "I need a report for the Monday meeting",
    ),
    false,
  );
});

test("repairScopeProvenance downgrades a cherry-picked confirmed quote", () => {
  const source =
    "And it should talk to our accounting system — well, our bookkeeper uses something, I'd have to ask her the name.";
  const scope = scopeWith({
    requirements: [
      item("Integrate with the accounting system", "confirmed", {
        sourceQuote: "And it should talk to our accounting system",
      }),
    ],
  });

  const result = repairScopeProvenance(scope, source);

  assert.equal(result.downgraded, 1);
  assert.equal(result.scope.requirements[0].status, "proposed");
});

test("a confirmed item without source evidence is downgraded", () => {
  const scope = scopeWith({
    requirements: [item("A report is required", "confirmed")],
  });

  const result = repairScopeProvenance(scope, SOURCE);

  assert.equal(result.downgraded, 1);
  assert.equal(result.scope.requirements[0].status, "proposed");
  assert.match(
    result.scope.requirements[0].rationale ?? "",
    /needs client confirmation/i,
  );
});
