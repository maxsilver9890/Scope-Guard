import { critiqueScope } from "./critique";
import { ModelProviderError } from "./deepseek";
import { generateScope } from "./generate";
import { reconcileCritique, requiresReconciliation } from "./reconcile";
import type { Finding, Scope } from "./schema";

export const DEFAULT_ANALYSIS_PIPELINE_TIMEOUT_MS = 75_000;
export const ANALYSIS_PIPELINE_TIMEOUT_ENV =
  "SCOPE_GUARD_PIPELINE_TIMEOUT_MS";
export const ANALYSIS_MODEL_ENV = "SCOPE_GUARD_MODEL";

const MIN_ANALYSIS_PIPELINE_TIMEOUT_MS = 15_000;
const MAX_ANALYSIS_PIPELINE_TIMEOUT_MS = 300_000;

export type AnalysisStage = "generation" | "review" | "reconciliation";

export type AnalysisStageTimings = Partial<Record<AnalysisStage, number>>;

export type AnalysisCompletedStages = {
  scope?: Scope;
  findings?: Finding[];
};

export type AnalysisPipelineDependencies = {
  generateScope: typeof generateScope;
  critiqueScope: typeof critiqueScope;
  reconcileCritique: typeof reconcileCritique;
};

export type AnalysisPipelineOptions = Partial<AnalysisPipelineDependencies> & {
  /** Absolute deadline in epoch milliseconds. Defaults to the env budget. */
  deadline?: number;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
};

export type AnalysisPipelineSuccess = {
  ok: true;
  scope: Scope;
  findings: Finding[];
  reconciled: boolean;
  stageMs: AnalysisStageTimings;
  modelCalls: number;
  totalMs: number;
};

export type AnalysisPipelineFailure = {
  ok: false;
  stage: AnalysisStage;
  error: unknown;
  /**
   * Valid results from completed stages. They are intentionally not returned
   * to the client as success; callers may log/use them for diagnostics only.
   */
  completed: AnalysisCompletedStages;
  stageMs: AnalysisStageTimings;
  totalMs: number;
};

export type AnalysisPipelineOutcome =
  | AnalysisPipelineSuccess
  | AnalysisPipelineFailure;

export function readAnalysisPipelineTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(env[ANALYSIS_PIPELINE_TIMEOUT_ENV]);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_ANALYSIS_PIPELINE_TIMEOUT_MS;
  }
  return Math.min(
    Math.max(configured, MIN_ANALYSIS_PIPELINE_TIMEOUT_MS),
    MAX_ANALYSIS_PIPELINE_TIMEOUT_MS,
  );
}

function pipelineTimeoutError(budgetMs: number, stage: AnalysisStage): Error {
  return new ModelProviderError(
    "timeout",
    `The analysis exceeded its ${budgetMs}ms pipeline budget at the ${stage} stage. Set ${ANALYSIS_MODEL_ENV} to a faster model or raise ${ANALYSIS_PIPELINE_TIMEOUT_ENV} if the deployment supports a longer request.`,
  );
}

/**
 * Run the two-call analysis path. A repair pass is only added when the first
 * review contains a contradiction or unsupported assumption that can require
 * changing the scope. This avoids repeating generation and review for purely
 * informational findings.
 */
export async function runAnalysisPipeline(
  source: string,
  options: AnalysisPipelineOptions = {},
): Promise<AnalysisPipelineOutcome> {
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env;
  const deps: AnalysisPipelineDependencies = {
    generateScope,
    critiqueScope,
    reconcileCritique,
    ...options,
  };
  const startedAt = now();
  const budgetMs = readAnalysisPipelineTimeoutMs(env);
  const deadline = options.deadline ?? startedAt + budgetMs;
  const stageMs: AnalysisStageTimings = {};
  let stage: AnalysisStage = "generation";
  let scope: Scope | undefined;
  let findings: Finding[] | undefined;

  const assertBudget = () => {
    if (now() >= deadline) {
      throw pipelineTimeoutError(budgetMs, stage);
    }
  };

  try {
    assertBudget();
    const generationStarted = now();
    scope = await deps.generateScope(source, { deadline });
    stageMs.generation = now() - generationStarted;

    stage = "review";
    assertBudget();
    const reviewStarted = now();
    findings = await deps.critiqueScope(source, scope, { deadline });
    stageMs.review = now() - reviewStarted;

    if (!requiresReconciliation(findings)) {
      assertBudget();
      return {
        ok: true,
        scope,
        findings,
        reconciled: false,
        stageMs,
        modelCalls: 2,
        totalMs: now() - startedAt,
      };
    }

    stage = "reconciliation";
    assertBudget();
    const reconciliationStarted = now();
    const reconciled = await deps.reconcileCritique(source, scope, findings, {
      deadline,
    });
    stageMs.reconciliation = now() - reconciliationStarted;
    assertBudget();

    return {
      ok: true,
      scope: reconciled.scope,
      findings: reconciled.findings,
      reconciled: reconciled.reconciled,
      stageMs,
      modelCalls: 4,
      totalMs: now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      stage,
      error,
      completed: { ...(scope ? { scope } : {}), ...(findings ? { findings } : {}) },
      stageMs,
      totalMs: now() - startedAt,
    };
  }
}
