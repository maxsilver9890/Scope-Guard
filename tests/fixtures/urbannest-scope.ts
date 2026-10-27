import type { Finding, Scope } from "../../src/lib/schema.ts";

/**
 * Minimal faithful UrbanNest fixture for the training regression. The source
 * explicitly requests training and asks for it to be considered in the
 * proposed scope, which supports the request without approving it.
 */
export const URBANNEST_TRANSCRIPT = `UrbanNest sells home decor online. Our team relies on StockPilot to manage stock, and the new store must keep working with it so staff do not update inventory in two places.
I'd also like a training session so our team can manage products. Let's include it in the proposed scope so we can review it.
We are still comparing payment providers and have not approved a payment gateway.`;

export const TRAINING_REQUEST =
  "I'd also like a training session so our team can manage products. Let's include it in the proposed scope so we can review it.";

export function urbannestTrainingScope(): Scope {
  return {
    problemStatement: "UrbanNest needs a clearer online store scope.",
    inScope: [
      {
        text: "A staff training session for product management.",
        status: "confirmed",
        sourceQuote: TRAINING_REQUEST,
      },
    ],
    outOfScope: [],
    assumptions: [],
    openQuestions: [
      {
        text: "Should staff training be included in the proposed scope?",
        status: "unresolved",
      },
    ],
    requirements: [],
    acceptanceCriteria: [],
    clarifications: [],
  };
}

export const MISLEADING_TRAINING_FINDING: Finding = {
  type: "unsupported-assumption",
  description:
    "Staff training is unsupported because the client never requested it.",
  whyItMatters: "The report would describe a supported request as invented.",
  sourceSnippet: TRAINING_REQUEST,
};

export const GENUINE_TRAINING_GAP: Finding = {
  type: "missing-info",
  description:
    "The training session has no defined format, duration, or delivery mode.",
  whyItMatters: "The team cannot schedule or price the session.",
  sourceSnippet: "so our team can manage products",
};
