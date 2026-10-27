import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANALYSIS_PIPELINE_TIMEOUT_ENV,
  DEFAULT_ANALYSIS_PIPELINE_TIMEOUT_MS,
  readAnalysisPipelineTimeoutMs,
  runAnalysisPipeline,
} from "../src/lib/analysis-pipeline.ts";
import { ModelProviderError } from "../src/lib/deepseek.ts";
import type { Finding, Scope } from "../src/lib/schema.ts";

const SAMPLE_SCOPE: Scope = {
  problemStatement: "A store needs a clearer project scope.",
  inScope: [
    {
      text: "Product browsing is available.",
      status: "confirmed",
      sourceQuote: "Product browsing is available.",
    },
  ],
  outOfScope: [],
  assumptions: [],
  openQuestions: [],
  requirements: [],
  acceptanceCriteria: [],
  clarifications: [],
};

const MISSING_INFO: Finding = {
  type: "missing-info",
  description: "The launch date is undefined.",
  whyItMatters: "The delivery plan depends on it.",
  sourceSnippet: "launch before the sale",
};

const CONFLICT: Finding = {
  type: "unsupported-assumption",
  description: "The scope marks launch as confirmed despite an undecided date.",
  whyItMatters: "The team could commit to an unapproved date.",
  sourceSnippet: "launch before the sale",
};

test("informational findings return the two-call analysis without reconciliation", async () => {
  let reconciliationCalls = 0;
  let seenDeadline: number | undefined;

  const outcome = await runAnalysisPipeline("A source brief.", {
    deadline: Date.now() + 20_000,
    generateScope: async (_source, options) => {
      seenDeadline = options?.deadline;
      return SAMPLE_SCOPE;
    },
    critiqueScope: async (_source, _scope, options) => {
      assert.equal(options?.deadline, seenDeadline);
      return [MISSING_INFO];
    },
    reconcileCritique: async () => {
      reconciliationCalls += 1;
      return {
        scope: SAMPLE_SCOPE,
        findings: [MISSING_INFO],
        reconciled: true,
      };
    },
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.reconciled, false);
  assert.equal(outcome.modelCalls, 2);
  assert.equal(reconciliationCalls, 0);
  assert.equal(outcome.findings.length, 1);
  assert.ok((outcome.stageMs.generation ?? 0) >= 0);
  assert.ok((outcome.stageMs.review ?? 0) >= 0);
});

test("a contradiction or unsupported assumption triggers the bounded reconciliation pass", async () => {
  let reconciliationCalls = 0;

  const outcome = await runAnalysisPipeline("A source brief.", {
    generateScope: async () => SAMPLE_SCOPE,
    critiqueScope: async () => [CONFLICT],
    reconcileCritique: async (_source, scope, findings) => {
      reconciliationCalls += 1;
      assert.equal(scope, SAMPLE_SCOPE);
      assert.deepEqual(findings, [CONFLICT]);
      return {
        scope: SAMPLE_SCOPE,
        findings: [],
        reconciled: true,
      };
    },
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.reconciled, true);
  assert.equal(outcome.modelCalls, 4);
  assert.equal(reconciliationCalls, 1);
  assert.ok((outcome.stageMs.reconciliation ?? 0) >= 0);
});

test("the pipeline deadline stops work before the first stage", async () => {
  let generationCalls = 0;

  const outcome = await runAnalysisPipeline("A source brief.", {
    deadline: Date.now() - 1,
    generateScope: async () => {
      generationCalls += 1;
      return SAMPLE_SCOPE;
    },
    critiqueScope: async () => [],
    reconcileCritique: async () => ({
      scope: SAMPLE_SCOPE,
      findings: [],
      reconciled: true,
    }),
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "generation");
  assert.equal(generationCalls, 0);
  assert.ok(outcome.error instanceof ModelProviderError);
  assert.equal((outcome.error as ModelProviderError).kind, "timeout");
  assert.match((outcome.error as Error).message, /pipeline budget/i);
});

test("a review timeout preserves the validated generation result for diagnostics only", async () => {
  const outcome = await runAnalysisPipeline("A source brief.", {
    generateScope: async () => SAMPLE_SCOPE,
    critiqueScope: async () => {
      throw new ModelProviderError("timeout", "review timed out");
    },
    reconcileCritique: async () => ({
      scope: SAMPLE_SCOPE,
      findings: [],
      reconciled: true,
    }),
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "review");
  assert.equal(outcome.completed.scope, SAMPLE_SCOPE);
  assert.equal(outcome.completed.findings, undefined);
  assert.equal(outcome.stageMs.generation !== undefined, true);
  assert.equal(outcome.stageMs.review, undefined);
});

test("a reconciliation timeout preserves the initial valid scope and findings", async () => {
  const outcome = await runAnalysisPipeline("A source brief.", {
    generateScope: async () => SAMPLE_SCOPE,
    critiqueScope: async () => [CONFLICT],
    reconcileCritique: async () => {
      throw new ModelProviderError("timeout", "reconciliation timed out");
    },
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "reconciliation");
  assert.equal(outcome.completed.scope, SAMPLE_SCOPE);
  assert.deepEqual(outcome.completed.findings, [CONFLICT]);
});

test("the pipeline budget is configurable and has a safe default", () => {
  assert.equal(
    readAnalysisPipelineTimeoutMs({} as unknown as NodeJS.ProcessEnv),
    DEFAULT_ANALYSIS_PIPELINE_TIMEOUT_MS,
  );
  assert.equal(
    readAnalysisPipelineTimeoutMs({
      [ANALYSIS_PIPELINE_TIMEOUT_ENV]: "120000",
    } as unknown as NodeJS.ProcessEnv),
    120_000,
  );
  assert.equal(
    readAnalysisPipelineTimeoutMs({
      [ANALYSIS_PIPELINE_TIMEOUT_ENV]: "1",
    } as unknown as NodeJS.ProcessEnv),
    15_000,
  );
});

test("a generation failure is reported at the generation stage", async () => {
  const outcome = await runAnalysisPipeline("A source brief.", {
    generateScope: async () => {
      throw new ModelProviderError("timeout", "generation timed out");
    },
    critiqueScope: async () => [],
    reconcileCritique: async () => ({
      scope: SAMPLE_SCOPE,
      findings: [],
      reconciled: true,
    }),
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "generation");
  assert.equal(outcome.completed.scope, undefined);
  assert.equal(outcome.completed.findings, undefined);
});

test("the deadline is re-checked after generation finishes", async () => {
  let currentTime = 0;
  let reviewCalls = 0;

  const outcome = await runAnalysisPipeline("A source brief.", {
    now: () => currentTime,
    deadline: 100,
    generateScope: async () => {
      currentTime = 101;
      return SAMPLE_SCOPE;
    },
    critiqueScope: async () => {
      reviewCalls += 1;
      return [MISSING_INFO];
    },
    reconcileCritique: async () => ({
      scope: SAMPLE_SCOPE,
      findings: [],
      reconciled: true,
    }),
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "review");
  assert.equal(reviewCalls, 0);
  assert.equal(outcome.completed.scope, SAMPLE_SCOPE);
  assert.ok(outcome.error instanceof ModelProviderError);
  assert.equal((outcome.error as ModelProviderError).kind, "timeout");
});

test("the deadline is re-checked after review before returning a two-call success", async () => {
  let currentTime = 0;

  const outcome = await runAnalysisPipeline("A source brief.", {
    now: () => currentTime,
    deadline: 100,
    generateScope: async () => {
      currentTime = 10;
      return SAMPLE_SCOPE;
    },
    critiqueScope: async () => {
      currentTime = 101;
      return [MISSING_INFO];
    },
    reconcileCritique: async () => {
      throw new Error("reconciliation should not run");
    },
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "review");
  assert.equal(outcome.completed.scope, SAMPLE_SCOPE);
  assert.deepEqual(outcome.completed.findings, [MISSING_INFO]);
});

test("the deadline is re-checked after reconciliation finishes", async () => {
  let currentTime = 0;

  const outcome = await runAnalysisPipeline("A source brief.", {
    now: () => currentTime,
    deadline: 100,
    generateScope: async () => {
      currentTime = 10;
      return SAMPLE_SCOPE;
    },
    critiqueScope: async () => {
      currentTime = 20;
      return [CONFLICT];
    },
    reconcileCritique: async () => {
      currentTime = 101;
      return {
        scope: SAMPLE_SCOPE,
        findings: [],
        reconciled: true,
      };
    },
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "reconciliation");
  assert.equal(outcome.completed.scope, SAMPLE_SCOPE);
  assert.deepEqual(outcome.completed.findings, [CONFLICT]);
});
