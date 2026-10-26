import type { Finding, Scope } from "../../src/lib/schema.ts";

export type ReconciliationScenario = {
  transcript: string;
  scope: Scope;
  finding: Finding;
};

export const compatibleClaims: ReconciliationScenario = {
  transcript: "UrbanNest sells home decor online. Customers should browse product categories grouped by room in the catalog. We may add room-based product category filters to the catalog later, but that decision is not made. Product pages should include dimensions.",
  scope: {
    problemStatement: "UrbanNest needs a home decor e-commerce redesign.",
    inScope: [
      { text: "Product catalog categories will be grouped by room.", status: "confirmed", sourceQuote: "Customers should browse product categories grouped by room in the catalog." },
    ],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      { text: "Decide whether to add interactive product category filters to the catalog.", status: "unresolved" },
    ],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
  },
  finding: {
    type: "unsupported-assumption",
    description: "Interactive product category filters are treated as confirmed even though the client has not decided.",
    whyItMatters: "Filter behavior could be built without approval.",
    sourceSnippet: "We may add room-based product category filters to the catalog later, but that decision is not made.",
  },
};

export const excludedButRequired: ReconciliationScenario = {
  transcript: "Customer must receive SMS alerts for dispatch updates. Dispatch SMS alerts are explicitly excluded from the service.",
  scope: {
    problemStatement: "The dispatch service needs an operational update workflow.",
    inScope: [],
    outOfScope: [
      { text: "Dispatch SMS alerts are excluded from the service.", status: "confirmed", sourceQuote: "Dispatch SMS alerts are explicitly excluded from the service." },
    ],
    assumptions: [],
    openQuestions: [],
    requirements: [
      { text: "Dispatch SMS alerts are a required confirmed deliverable.", status: "confirmed", sourceQuote: "Customer must receive SMS alerts for dispatch updates." },
    ],
    acceptanceCriteria: [],
    clarifications: [],
  },
  finding: {
    type: "contradiction",
    description: "The confirmed dispatch SMS requirement conflicts with an explicit exclusion.",
    whyItMatters: "The service cannot meet a deliverable that is excluded from implementation.",
    sourceSnippet: "Dispatch SMS alerts are explicitly excluded from the service.",
  },
};

export const requiredButExcluded: ReconciliationScenario = {
  transcript: "The archive search must include handwritten letters from the 1920s.",
  scope: {
    problemStatement: "The historical archive needs searchable records.",
    inScope: [],
    outOfScope: [
      { text: "Handwritten letters from the 1920s are excluded from archive search.", status: "confirmed", sourceQuote: "The archive search must include handwritten letters from the 1920s." },
    ],
    assumptions: [],
    openQuestions: [],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
  },
  finding: {
    type: "unsupported-assumption",
    description: "The scope excludes handwritten letters from the 1920s although the client explicitly required them.",
    whyItMatters: "Researchers would be unable to find records they need.",
    sourceSnippet: "The archive search must include handwritten letters from the 1920s.",
  },
};

export const conditionalVendorIntegration: ReconciliationScenario = {
  transcript: "Payroll synchronization is required only after LedgerPro approves API access. Vendor access remains pending.",
  scope: {
    problemStatement: "The payroll system needs a conditional data exchange.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      { text: "Confirm whether LedgerPro will approve API access.", status: "unresolved" },
    ],
    requirements: [
      { text: "Payroll synchronization is required only after LedgerPro approves API access.", status: "confirmed", sourceQuote: "Payroll synchronization is required only after LedgerPro approves API access." },
    ],
    acceptanceCriteria: [],
    clarifications: [],
  },
  finding: {
    type: "unsupported-assumption",
    description: "Payroll synchronization is treated as guaranteed although LedgerPro API access remains unresolved.",
    whyItMatters: "Implementation depends on vendor authorization.",
    sourceSnippet: "Vendor access remains pending.",
  },
};

export const differentDomainCompatibleClaims: ReconciliationScenario = {
  transcript: "The emergency dispatch system will display crew assignments. Whether to show personal mobile numbers is still pending review.",
  scope: {
    problemStatement: "Dispatch coordinators need a clear shift handoff view.",
    inScope: [],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      { text: "Decide whether personal mobile numbers may appear in the handoff view.", status: "unresolved" },
    ],
    requirements: [
      { text: "The shift handoff view will display crew assignments.", status: "confirmed", sourceQuote: "The emergency dispatch system will display crew assignments." },
    ],
    acceptanceCriteria: [],
    clarifications: [],
  },
  finding: {
    type: "unsupported-assumption",
    description: "The report includes staff telephone details even though that disclosure remains undecided.",
    whyItMatters: "Private contact information might be exposed without approval.",
    sourceSnippet: "Whether to show personal mobile numbers is still pending review.",
  },
};
