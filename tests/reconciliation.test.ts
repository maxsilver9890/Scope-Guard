import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { reconcileCritique } from "../src/lib/reconcile.ts";
import type { Finding, Scope } from "../src/lib/schema.ts";
import {
  compatibleClaims,
  conditionalVendorIntegration,
  differentDomainCompatibleClaims,
  excludedButRequired,
  requiredButExcluded,
} from "./fixtures/reconciliation-scenarios.ts";

async function loadTranscript(): Promise<string> {
  return readFile(new URL("../samples/northstar-dental-transcript.txt", import.meta.url), "utf8");
}

const initialScope: Scope = {
  problemStatement: "Northstar Dental needs a website for its second clinic.",
  inScope: [
    { text: "Online appointment booking will be included at launch.", status: "confirmed", sourceQuote: "Online appointment booking is preferred" },
    { text: "Patient accounts will be included.", status: "proposed", rationale: "The model added patient logins." },
    { text: "A 20% reduction in missed appointments is guaranteed.", status: "proposed", rationale: "The source provides no measured target." },
    { text: "The design will feel premium but approachable and use dark-green and cream branding.", status: "confirmed", sourceQuote: "premium but approachable and use our dark-green and cream branding" },
  ],
  outOfScope: [
    { text: "Online payments are excluded from the project.", status: "confirmed", sourceQuote: "Online payments are not a launch requirement" },
  ],
  assumptions: [],
  openQuestions: [],
  requirements: [],
  acceptanceCriteria: [],
  clarifications: [],
};

const correctedScope: Scope = {
  problemStatement: "Northstar Dental needs a website ready before its second clinic opens, with some scheduling flexibility.",
  inScope: [
    { text: "The website will include a homepage, separate pages for both clinic locations, service pages, an about page, and contact information.", status: "confirmed", sourceQuote: "a homepage, separate pages for both clinic locations, service pages, an about page, and contact information" },
    { text: "Location pages will show each clinic address, hours, phone number, and a map.", status: "confirmed", sourceQuote: "Each location page needs its address, hours, phone number, and a map" },
    { text: "The client will provide contact details and the logo.", status: "confirmed", sourceQuote: "The client will provide contact details and the logo" },
    { text: "The website will be mobile-responsive, with readable text and keyboard navigation.", status: "confirmed", sourceQuote: "The website must work on mobile. Readable text and keyboard navigation are important" },
    { text: "Page titles, meta descriptions, and local-search considerations are included as basic SEO.", status: "confirmed", sourceQuote: "basic SEO, including page titles, meta descriptions, and local-search considerations" },
  ],
  outOfScope: [
    { text: "Patient accounts and access to or storage of medical records are excluded; no medical records will be stored on the website.", status: "confirmed", sourceQuote: "Patient accounts and access to or storage of medical records are explicitly excluded.\nNo medical records should be stored on the website." },
    { text: "Online payments are not a launch requirement; payment will be at the clinic for now, and online deposits may be considered later.", status: "confirmed", sourceQuote: "Online payments are not a launch requirement. Patients will pay at the clinic for now; we may consider online deposits later." },
    { text: "Automated reminders are excluded from launch; the receptionist will handle confirmations manually.", status: "confirmed", sourceQuote: "They are not part of the launch scope. Our receptionist will handle confirmations manually at launch" },
  ],
  assumptions: [],
  openQuestions: [
    { text: "Choose between online appointment booking and an appointment request form.", status: "unresolved" },
    { text: "Confirm DentDesk vendor and API availability before deciding whether to integrate; the website must not replace DentDesk.", status: "unresolved" },
    { text: "Confirm the timing and availability of new-clinic photos.", status: "unresolved" },
    { text: "The marketing contact expects to write service descriptions, but the two-week estimate is tentative; confirm whether copywriting is separately approved.", status: "unresolved" },
    { text: "Confirm the INR 80,000-INR 100,000 budget range in writing; the owner said it sounded reasonable.", status: "unresolved" },
    { text: "Define any measurable business-outcome targets only if desired; no reduction in missed appointments or search ranking is guaranteed.", status: "unresolved" },
    { text: "Confirm whether a formal accessibility standard is required.", status: "unresolved" },
    { text: "Confirm whether ongoing SEO is desired; it has not been agreed.", status: "unresolved" },
  ],
  requirements: [
    { text: "Website readiness is targeted before the second clinic opens, with some scheduling flexibility; no fixed six-week delivery guarantee is agreed.", status: "confirmed", sourceQuote: "We want the website ready before the second clinic opens, but we have some scheduling flexibility" },
    { text: "DentDesk must not be replaced; any integration is conditional on vendor and API confirmation.", status: "confirmed", sourceQuote: "Any integration depends on vendor and API confirmation, and the website must not replace DentDesk" },
  ],
  acceptanceCriteria: [
    { text: "The location pages present the supplied address, hours, phone number, and map for each clinic.", status: "proposed", rationale: "Observable boundary based on the confirmed content requirement." },
  ],
  clarifications: [],
};

const contradictoryFindings: Finding[] = [
  { type: "unsupported-assumption", description: "Booking is marked confirmed although the source leaves the method undecided.", whyItMatters: "The wrong booking build could be delivered.", sourceSnippet: "We have not decided which booking method to use." },
  { type: "unsupported-assumption", description: "The scope contradicts explicit patient-account and medical-record exclusions.", whyItMatters: "This could create privacy and compliance risk.", sourceSnippet: "Patient accounts and access to or storage of medical records are explicitly excluded." },
  { type: "unsupported-assumption", description: "Online payments are incorrectly treated as excluded despite the launch nuance.", whyItMatters: "Payment expectations could be misunderstood.", sourceSnippet: "Online payments are not a launch requirement." },
];

test("Northstar critique is reconciled into the effective scope and then re-reviewed", async () => {
  const transcript = await loadTranscript();
  let critiqueCalls = 0;
  let reconciliationPrompted = false;
  let reviewedScope: Scope | undefined;
  const result = await reconcileCritique(
    transcript,
    initialScope,
    contradictoryFindings,
    {},
    {
      generateScope: async (input, options) => {
        assert.equal(input, transcript);
        reconciliationPrompted = Boolean(options?.reconciliationFindings?.length);
        assert.equal(options?.currentScope, initialScope);
        return correctedScope;
      },
      critiqueScope: async (_input, scope) => {
        critiqueCalls += 1;
        reviewedScope = scope;
        return [];
      },
    },
  );

  assert.equal(result.reconciled, true);
  assert.equal(reconciliationPrompted, true);
  assert.equal(critiqueCalls, 1);
  assert.deepEqual(reviewedScope, result.scope);
  assert.deepEqual(result.findings, []);

  const allItems = [
    ...result.scope.inScope,
    ...result.scope.outOfScope,
    ...result.scope.assumptions,
    ...result.scope.openQuestions,
    ...result.scope.requirements,
    ...result.scope.acceptanceCriteria,
  ];
  const reportText = [result.scope.problemStatement, ...allItems.map((item) => item.text)].join("\n");

  assert.equal(result.scope.outOfScope.some((item) => /patient accounts.*medical records/i.test(item.text) && item.status === "confirmed" && item.sourceQuote), true);
  assert.equal(result.scope.openQuestions.some((item) => /booking.*request form/i.test(item.text)), true);
  assert.equal(result.scope.requirements.some((item) => /before the second clinic opens.*scheduling flexibility/i.test(item.text)), true);
  assert.equal(result.scope.requirements.some((item) => /dentdesk.*conditional|dentdesk.*depends/i.test(item.text) && item.status === "confirmed"), true);
  assert.equal(result.scope.inScope.some((item) => /page titles.*meta descriptions.*local-search/i.test(item.text) && item.status === "confirmed"), true);
  assert.equal(result.scope.inScope.some((item) => /premium but approachable.*dark-green and cream branding/i.test(item.text) && item.status === "confirmed"), true);
  assert.equal(result.scope.openQuestions.some((item) => /budget.*writing/i.test(item.text)), true);
  assert.equal(result.scope.openQuestions.some((item) => /photos/i.test(item.text)), true);
  assert.equal(result.scope.openQuestions.some((item) => /copywriting/i.test(item.text)), true);
  assert.equal(result.scope.inScope.some((item) => /client will provide contact details and the logo/i.test(item.text) && item.status === "confirmed"), true);
  assert.equal(result.scope.outOfScope.some((item) => /online payments.*launch requirement/i.test(item.text) && item.status === "confirmed"), true);
  assert.equal(result.scope.outOfScope.some((item) => /automated reminders.*launch.*receptionist/i.test(item.text) && item.status === "confirmed"), true);
  assert.equal(result.scope.inScope.some((item) => /patient accounts|medical records/i.test(item.text)), false);
  assert.equal(result.scope.acceptanceCriteria.some((item) => /patient accounts|medical records/i.test(item.text)), false);
  assert.equal(result.scope.openQuestions.some((item) => /DentDesk vendor and API/i.test(item.text)), true);
  assert.equal(result.scope.openQuestions.some((item) => /ongoing SEO/i.test(item.text)), true);
  assert.equal(result.scope.inScope.some((item) => /online payments/i.test(item.text)), false);
  assert.doesNotMatch(reportText, /20% reduction|guaranteed higher rankings|automated reminders.*launch requirement/i);
  assert.equal(result.scope.inScope.some((item) => /online appointment booking will be included/i.test(item.text)), false);
});

test("unsupported reconciliation claims are downgraded by provenance validation", async () => {
  const transcript = await loadTranscript();
  const unsupported = {
    ...correctedScope,
    inScope: [{ text: "A guaranteed ranking increase.", status: "confirmed" as const, sourceQuote: "This phrase is absent." }],
  };
  const result = await reconcileCritique(
    transcript,
    initialScope,
    [contradictoryFindings[0]],
    {},
    {
      generateScope: async () => unsupported,
      critiqueScope: async () => [],
    },
  );

  assert.equal(result.scope.inScope[0].status, "proposed");
  assert.equal(result.scope.inScope[0].sourceQuote, undefined);
});

test("invalid reconciled scope fails closed instead of returning a validated report", async () => {
  const transcript = await loadTranscript();
  const invalid = { ...correctedScope, assumptions: [{ text: "No status", status: "broken" }] } as unknown as Scope;

  await assert.rejects(
    reconcileCritique(transcript, initialScope, [contradictoryFindings[0]], {}, {
      generateScope: async () => invalid,
      critiqueScope: async () => [],
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "ScopeReconciliationError" &&
      error.message.includes("could not be validated"),
  );
});

test("a remaining finding cannot validate a still-confirmed conflicting decision", async () => {
  const transcript = await loadTranscript();
  const badScope = {
    ...correctedScope,
    inScope: [
      ...correctedScope.inScope,
      { text: "Online appointment booking is the approved launch method.", status: "confirmed" as const, sourceQuote: "Online appointment booking is preferred" },
    ],
  };
  const remainingFinding: Finding = {
    type: "unsupported-assumption",
    description: "The scope still treats online booking as approved despite the undecided method.",
    whyItMatters: "The implementation could select the wrong booking workflow.",
    sourceSnippet: "We have not decided which booking method to use.",
  };

  await assert.rejects(
    reconcileCritique(transcript, initialScope, [contradictoryFindings[0]], {}, {
      generateScope: async () => badScope,
      critiqueScope: async () => [remainingFinding],
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "ScopeReconciliationError");
      assert.match(error.message, /marks a decision as confirmed/i);
      assert.match(error.message, /previous results are unchanged/i);
      assert.doesNotMatch(error.message, /change your source/i);
      return true;
    },
  );
});

test("UrbanNest room categories are not confused with undecided product filters", async () => {
  const result = await reconcileCritique(compatibleClaims.transcript, compatibleClaims.scope, [compatibleClaims.finding], {}, {
    generateScope: async () => compatibleClaims.scope,
    critiqueScope: async () => [compatibleClaims.finding],
  });

  assert.equal(result.reconciled, true);
  assert.equal(result.scope.openQuestions[0].status, "unresolved");
  assert.equal(result.scope.inScope[0].status, "confirmed");
});

test("an explicit exclusion conflicts with the same feature as a required deliverable", async () => {
  await assert.rejects(
    reconcileCritique(excludedButRequired.transcript, excludedButRequired.scope, [excludedButRequired.finding], {}, {
      generateScope: async () => excludedButRequired.scope,
      critiqueScope: async () => [excludedButRequired.finding],
    }),
    (error: unknown) => error instanceof Error && error.name === "ScopeReconciliationError",
  );
});

test("a required archive feature cannot remain marked excluded", async () => {
  await assert.rejects(
    reconcileCritique(requiredButExcluded.transcript, requiredButExcluded.scope, [requiredButExcluded.finding], {}, {
      generateScope: async () => requiredButExcluded.scope,
      critiqueScope: async () => [requiredButExcluded.finding],
    }),
    (error: unknown) => error instanceof Error && error.name === "ScopeReconciliationError",
  );
});

test("a conditional vendor integration is not treated as guaranteed or contradictory", async () => {
  const conditionalFinding: Finding = {
    ...conditionalVendorIntegration.finding,
    description: "Payroll synchronization is marked confirmed despite unresolved LedgerPro API access.",
  };
  const result = await reconcileCritique(
    conditionalVendorIntegration.transcript,
    conditionalVendorIntegration.scope,
    [conditionalFinding],
    {},
    {
      generateScope: async () => conditionalVendorIntegration.scope,
      critiqueScope: async () => [conditionalFinding],
    },
  );

  assert.equal(result.reconciled, true);
  assert.match(result.scope.requirements[0].text, /only after/i);
  assert.equal(result.scope.requirements[0].status, "confirmed");
  assert.equal(result.scope.openQuestions[0].status, "unresolved");
});

test("different-domain adjacent decisions remain separate", async () => {
  const result = await reconcileCritique(
    differentDomainCompatibleClaims.transcript,
    differentDomainCompatibleClaims.scope,
    [differentDomainCompatibleClaims.finding],
    {},
    {
      generateScope: async () => differentDomainCompatibleClaims.scope,
      critiqueScope: async () => [differentDomainCompatibleClaims.finding],
    },
  );

  assert.equal(result.reconciled, true);
  assert.match(result.scope.requirements[0].text, /crew assignments/i);
  assert.match(result.scope.openQuestions[0].text, /mobile numbers/i);
});

test("a cited explicit exclusion is not mistaken for a confirmed included feature", async () => {
  const transcript = await loadTranscript();
  const exclusionFinding: Finding = {
    type: "unsupported-assumption",
    description: "The scope includes patient accounts even though the source explicitly excludes them.",
    whyItMatters: "Patient account handling would expand privacy obligations.",
    sourceSnippet: "Patient accounts and access to or storage of medical records are explicitly excluded.",
  };
  const scopeWithExclusion = {
    ...correctedScope,
    inScope: correctedScope.inScope.filter((item) => !/patient accounts/i.test(item.text)),
    outOfScope: [
      { text: "Patient accounts and medical records are excluded.", status: "confirmed" as const, sourceQuote: "Patient accounts and access to or storage of medical records are explicitly excluded." },
    ],
  };

  const result = await reconcileCritique(transcript, scopeWithExclusion, [exclusionFinding], {}, {
    generateScope: async () => scopeWithExclusion,
    critiqueScope: async () => [exclusionFinding],
  });

  assert.equal(result.scope.outOfScope[0].status, "confirmed");
  assert.equal(result.scope.inScope.some((item) => /patient accounts/i.test(item.text)), false);
});

test("a confirmed feature still cannot remain falsely excluded", async () => {
  const transcript = "The UrbanNest launch must include online appointment booking.";
  const excludedBooking: Scope = {
    ...correctedScope,
    inScope: [],
    outOfScope: [
      { text: "Online appointment booking is excluded from launch.", status: "confirmed", sourceQuote: "The UrbanNest launch must include online appointment booking." },
    ],
  };
  const finding: Finding = {
    type: "unsupported-assumption",
    description: "The scope excludes online appointment booking even though the client explicitly required it.",
    whyItMatters: "The launch scope would omit a required feature.",
    sourceSnippet: "The UrbanNest launch must include online appointment booking.",
  };

  await assert.rejects(
    reconcileCritique(transcript, excludedBooking, [finding], {}, {
      generateScope: async () => excludedBooking,
      critiqueScope: async () => [finding],
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "ScopeReconciliationError" &&
      error.message.includes("marks a decision as confirmed"),
  );
});
