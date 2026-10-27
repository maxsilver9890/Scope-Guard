import assert from "node:assert/strict";
import { test } from "node:test";

import { scopeToPdfDefinition } from "../src/lib/pdf-export.ts";
import { formatPdfPreflightSummary, getPdfExportPreflight } from "../src/lib/clarifications.ts";
import type { Scope } from "../src/lib/schema.ts";

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
