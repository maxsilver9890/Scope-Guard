import assert from "node:assert/strict";
import { test } from "node:test";

import { scopeToPdfDefinition } from "../src/lib/pdf-export.ts";
import { formatPdfPreflightSummary, getPdfExportPreflight } from "../src/lib/clarifications.ts";
import type { Scope } from "../src/lib/schema.ts";
import type { Finding } from "../src/lib/schema.ts";
import type { ScopeComparison } from "../src/lib/diff.ts";
import { FITNESS_GATEWAY_QUESTION } from "./fixtures/scope-correctness.ts";

function collectText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!value || typeof value !== "object") return [];

  return Object.values(value).flatMap(collectText);
}

test("PDF definition exports the effective scope and unresolved clarification state", () => {
  const answer = "Payments remain undecided pending a provider review.";
  const scope: Scope = {
    problemStatement: "A learning platform needs a clear project scope.",
    inScope: [
      {
        text: "The catalog includes client-provided testimonials.",
        status: "confirmed",
        sourceQuote: "We will provide testimonials.",
      },
      {
        text: "Payment options await provider review.",
        status: "proposed",
        rationale: "The answer remains tentative.",
      },
    ],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      { text: "Should payments be included?", status: "unresolved" },
    ],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [
      {
        id: "c1",
        question: "Should payments be included?",
        answer,
        confirmed: false,
      },
    ],
  };

  const definition = scopeToPdfDefinition(scope, []);
  const content = collectText(definition.content).join("\n");

  assert.match(content, /client-provided testimonials/);
  assert.match(content, /Payments remain undecided/);
  assert.match(content, /Should payments be included\?/);
  assert.match(content, /Unconfirmed note/);
  assert.match(content, /Current scope: question remains open/);
  assert.doesNotMatch(content, /payments are excluded/i);
});

test("PDF clarifications distinguish confirmed answers", () => {
  const scope: Scope = {
    problemStatement: "The team needs a project scope.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [
      {
        id: "c1",
        question: "Which course materials will be provided?",
        answer: "The client will provide course descriptions and testimonials.",
        confirmed: true,
      },
    ],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");

  assert.match(content, /Client-confirmed answer/);
  assert.match(content, /Current scope: question is no longer listed as open/);
  assert.match(content, /course descriptions and testimonials/);
});

test("warning and PDF show the same latest open clarification and its recorded answer", () => {
  const answer = "The client wants a decision after reviewing vendor options.";
  const scope: Scope = {
    problemStatement: "A catalog needs a clear launch scope.",
    inScope: [], outOfScope: [], assumptions: [],
    openQuestions: [{ text: "Which vendor should support catalog search?", status: "unresolved" }],
    requirements: [], acceptanceCriteria: [],
    clarifications: [{
      id: "c-latest", question: "Which vendor should support catalog search?",
      answer, confirmed: false,
    }],
  };
  const warningText = formatPdfPreflightSummary(getPdfExportPreflight(scope));
  const pdfText = collectText(scopeToPdfDefinition(scope, []).content).join("\n");
  const clarificationSection = pdfText.slice(pdfText.lastIndexOf("Client Clarifications"));

  assert.match(warningText, /1 scope decision remains open: 0 unanswered clarification questions; 1 decision has an answer recorded but remains unresolved/);
  assert.match(pdfText, /Which vendor should support catalog search\?/);
  assert.match(pdfText, new RegExp(answer));
  assert.match(pdfText, /Current scope: question remains open/);
  assert.doesNotMatch(clarificationSection, /None recorded\./);
});

test("contents list includes every section without inaccurate page references", () => {
  const scope: Scope = {
    problemStatement: "Northstar Dental needs a premium website for its second clinic.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [{ text: "Choose the booking method after discussing availability.", status: "unresolved" }],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [{
      id: "c1",
      question: "Choose the booking method after discussing availability.",
      answer: "The receptionist remains concerned about availability.",
      confirmed: false,
    }],
  };
  const definition = scopeToPdfDefinition(scope, []);
  const content = collectText(definition.content).join("\n");

  for (const title of [
    "Executive Summary", "Problem Statement", "Scope Overview", "In Scope",
    "Out of Scope", "Assumptions", "Requirements", "Acceptance Criteria",
    "Open Questions", "Potential Delivery Risks", "Client Clarifications",
  ]) assert.match(content, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(content, /Section list \(page positions may vary with content\)/);
  assert.doesNotMatch(content, /Contents[\s\S]{0,240}\bpage\s+\d+\b/i);
  assert.match(content, /Current scope: question remains open/);
});

test("long cover titles have a bounded text column and long evidence stays in the document flow", () => {
  const longTitle = `Northstar Dental ${"second clinic website with appointment choices ".repeat(10)}`;
  const longEvidence = "The booking method remains under discussion. ".repeat(30);
  const scope: Scope = {
    problemStatement: longTitle,
    inScope: [{ text: "Booking workflow alternatives remain under discussion.", status: "proposed", rationale: "The client must choose a method.", sourceQuote: longEvidence }],
    outOfScope: [],
    assumptions: [],
    openQuestions: [{ text: "Which appointment workflow should launch?", status: "unresolved" }],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
  };
  const definition = scopeToPdfDefinition(scope, []);
  const content = collectText(definition.content).join("\n");
  const cover = JSON.stringify(definition.content[0]);
  const documentDefinition = JSON.stringify(definition.content);

  assert.match(cover, /"width":460/);
  assert.match(cover, /"fontSize":17/);
  assert.match(cover, /Northstar Dental[^\n]*\\n/);
  assert.match(documentDefinition, /"unbreakable":false/);
  assert.match(content, /Northstar Dental/);
  assert.match(content, new RegExp(longEvidence.slice(0, 80)));
  assert.match(content, /Which appointment workflow should launch/);
});

test("edited scope exports disclose that critique findings have not been revalidated", () => {
  const scope: Scope = {
    problemStatement: "The project needs a client-ready scope.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
  };
  const content = collectText(scopeToPdfDefinition(scope, [], null, new Date("2026-10-27T00:00:00Z"), true).content).join("\n");

  assert.match(content, /edited after analysis/i);
  assert.match(content, /have not been revalidated/i);
});

test("executive status counts count repeated requirement and acceptance representations once", () => {
  const quote = "The site must keep working with the warehouse platform.";
  const duplicate = { text: "Continue working with the warehouse platform.", status: "confirmed" as const, sourceQuote: quote };
  const scope: Scope = {
    problemStatement: "A store needs a reliable scope.",
    inScope: [duplicate], outOfScope: [], assumptions: [], openQuestions: [],
    requirements: [duplicate], acceptanceCriteria: [duplicate], clarifications: [],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");
  assert.match(content, /records 1 confirmed, 0 inferred, 0 proposed, and 0 unresolved unique decisions/i);
  assert.match(content, /Repeated representations of the same source-backed decision are counted once/i);
});

test("the same commitment in Requirements and Acceptance Criteria is counted once", () => {
  const quote = "The store must keep working with StockPilot so staff do not update inventory twice.";
  const requirement = {
    text: "Continue working with StockPilot for stock management.",
    status: "confirmed" as const,
    sourceQuote: quote,
  };
  const acceptance = {
    text: "Continue working with StockPilot for stock management in the new store.",
    status: "confirmed" as const,
    sourceQuote: quote,
  };
  const scope: Scope = {
    problemStatement: "A store needs StockPilot to stay connected.",
    inScope: [], outOfScope: [], assumptions: [], openQuestions: [],
    requirements: [requirement], acceptanceCriteria: [acceptance], clarifications: [],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");

  assert.match(content, /records 1 confirmed, 0 inferred, 0 proposed, and 0 unresolved unique decisions/i);
  assert.match(content, /Continue working with StockPilot for stock management\./);
  assert.match(content, /Continue working with StockPilot for stock management in the new store\./);
});

test("distinct commitments with similar wording remain separate in executive counts", () => {
  const quote = "The store must keep working with StockPilot so staff do not update inventory twice.";
  const scope: Scope = {
    problemStatement: "A store needs StockPilot to stay connected.",
    inScope: [], outOfScope: [], assumptions: [], openQuestions: [],
    requirements: [
      { text: "Continue working with StockPilot for stock management.", status: "confirmed", sourceQuote: quote },
      { text: "Staff must not update inventory in two places.", status: "confirmed", sourceQuote: quote },
    ],
    acceptanceCriteria: [],
    clarifications: [],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");

  assert.match(content, /records 2 confirmed, 0 inferred, 0 proposed, and 0 unresolved unique decisions/i);
});

test("different commitment statuses are not silently merged by executive counts", () => {
  const text = "Continue working with StockPilot for stock management.";
  const quote = "The store must keep working with StockPilot so staff do not update inventory twice.";
  const scope: Scope = {
    problemStatement: "A store needs StockPilot to stay connected.",
    inScope: [], outOfScope: [], assumptions: [], openQuestions: [],
    requirements: [{ text, status: "confirmed", sourceQuote: quote }],
    acceptanceCriteria: [{ text, status: "proposed", rationale: "Approval is pending." }],
    clarifications: [],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");

  assert.match(content, /records 1 confirmed, 0 inferred, 1 proposed, and 0 unresolved unique decisions/i);
  assert.match(content, /Continue working with StockPilot for stock management\./);
});

test("section contents stay complete when executive counts are deduplicated", () => {
  const quote = "The store must keep working with StockPilot so staff do not update inventory twice.";
  const duplicate = {
    text: "Continue working with StockPilot for stock management.",
    status: "confirmed" as const,
    sourceQuote: quote,
  };
  const distinct = {
    text: "Show each order's current fulfilment status.",
    status: "proposed" as const,
    rationale: "The client has not approved this view yet.",
  };
  const scope: Scope = {
    problemStatement: "A store needs a reliable scope.",
    inScope: [], outOfScope: [], assumptions: [], openQuestions: [],
    requirements: [duplicate, distinct],
    acceptanceCriteria: [duplicate],
    clarifications: [],
  };
  const content = collectText(scopeToPdfDefinition(scope, []).content).join("\n");

  assert.match(content, /2 requirements/);
  assert.match(content, /1 acceptance criteria/);
  assert.match(content, /Continue working with StockPilot for stock management\./);
  assert.match(content, /Show each order's current fulfilment status\./);
  assert.match(content, /records 1 confirmed, 0 inferred, 1 proposed, and 0 unresolved unique decisions/i);
});

test("change summary distinguishes a section move from a new or resolved scope decision", () => {
  const proposedFilter = {
    text: "Product filtering remains proposed pending client approval.",
    status: "proposed" as const,
    rationale: "Not yet approved.",
  };
  const before: Scope = {
    problemStatement: "A store needs product discovery.",
    inScope: [], outOfScope: [], assumptions: [], openQuestions: [],
    requirements: [proposedFilter], acceptanceCriteria: [], clarifications: [],
  };
  const after: Scope = {
    ...before,
    inScope: [proposedFilter],
    requirements: [],
  };
  const comparison = {
    items: [{
      section: "requirements" as const, afterSection: "inScope" as const,
      kind: "moved" as const, beforeText: proposedFilter.text, afterText: proposedFilter.text,
      beforeStatus: "proposed" as const, afterStatus: "proposed" as const,
      textChanged: false, statusChanged: false, provenanceChanged: false,
    }],
    findings: { resolved: [], remaining: [], changed: [], added: [], unmatched: [] },
    questionResolved: false,
    clarification: { question: "Which product filters are approved?", answer: "Still reviewing.", confirmed: false },
    summary: ["0 item(s) added, 0 removed, 0 changed, 1 moved between sections without changing the decision."],
  };
  const content = collectText(scopeToPdfDefinition(after, [], comparison).content).join("\n");
  assert.match(content, /Moved between sections/);
  assert.match(content, /Requirements → In Scope/);
  assert.doesNotMatch(content, /Resolved  Requirements: Product filtering/);
  assert.match(content, /remains proposed pending client approval/);
});

test("PDF output keeps explicit constraints confirmed and shows only current findings after resolution", () => {
  const oldAggregate: Finding = {
    type: "missing-info",
    description:
      "Critical decisions including the payment gateway, hosting provider, subscription plans, and dashboard metrics remain completely unresolved.",
    whyItMatters: "These decisions affect architecture and delivery.",
    sourceSnippet: "The client has not decided which provider or hosting service to use.",
  };
  const currentResidual: Finding = {
    ...oldAggregate,
    description:
      "Other decisions cited in this risk remain open: Which hosting provider will be used?; Which subscription plans and pricing will be offered?; Which metrics will appear on the progress dashboard?.",
    whyItMatters:
      "These remaining open decisions may affect scope, dependencies, cost, or acceptance criteria.",
  };
  const scope: Scope = {
    problemStatement: "The project needs a clear fitness coaching website scope.",
    inScope: [
      {
        text: "Razorpay will be used as the payment gateway for launch.",
        status: "confirmed",
        sourceQuote: "We will use Razorpay as the payment gateway for the initial launch.",
        sourceKind: "clarification",
        clarificationId: "c1",
      },
    ],
    outOfScope: [],
    assumptions: [
      {
        text: "Initial delivery is required within four weeks.",
        status: "confirmed",
        sourceQuote: "within 4 weeks",
        sourceKind: "transcript",
      },
      {
        text: "The total project budget is ₹50,000.",
        status: "confirmed",
        sourceQuote: "a total budget of ₹50,000",
        sourceKind: "transcript",
      },
      {
        text: "The client estimates approximately 10,000 users in the first month after launch.",
        status: "confirmed",
        sourceQuote: "We expect around 10,000 users in the first month after launch.",
        sourceKind: "transcript",
      },
    ],
    openQuestions: [
      { text: "Which hosting provider will be used?", status: "unresolved" },
      { text: "Which subscription plans and pricing will be offered?", status: "unresolved" },
      { text: "Which metrics will appear on the progress dashboard?", status: "unresolved" },
    ],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [
      {
        id: "c1",
        question: FITNESS_GATEWAY_QUESTION,
        answer: "Client-approved decision: use the selected payment gateway for launch.",
        confirmed: true,
      },
    ],
  };
  const comparison: ScopeComparison = {
    items: [],
    findings: {
      resolved: [oldAggregate],
      remaining: [],
      changed: [{ before: oldAggregate, after: currentResidual }],
      added: [],
      unmatched: [],
    },
    questionResolved: true,
    clarification: {
      question: FITNESS_GATEWAY_QUESTION,
      answer: "Client-approved decision: use the selected payment gateway for launch.",
      confirmed: true,
    },
    summary: [
      "The selected payment gateway is resolved; hosting, plans and metrics remain open.",
    ],
  };

  const content = collectText(
    scopeToPdfDefinition(scope, [currentResidual], comparison).content,
  ).join("\n");

  assert.match(content, /Initial delivery is required within four weeks/);
  assert.match(content, /The total project budget is ₹50,000/);
  assert.match(content, /estimates approximately 10,000 users/);
  assert.match(content, /Confirmed/);
  assert.match(content, /Current finding: Other decisions cited in this risk remain open/);
  assert.match(content, /hosting provider/);
  assert.match(content, /subscription plans and pricing/);
  assert.doesNotMatch(content, /payment gateway, hosting provider.*remain completely unresolved/i);
  assert.match(content, /A previously reported concern related to/);
});
