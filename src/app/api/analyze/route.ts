import { runAnalysisPipeline } from "@/lib/analysis-pipeline";
import { toApiFailure } from "@/lib/api-errors";
import { ScopeReconciliationError } from "@/lib/reconcile";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const { input } = body as { input?: unknown };

  if (typeof input !== "string" || input.trim().length === 0) {
    return Response.json(
      { error: "Provide a non-empty source brief to analyze." },
      { status: 400 },
    );
  }

  const source = input.trim();
  const outcome = await runAnalysisPipeline(source);

  if (outcome.ok) {
    console.info(
      `[analyze] completed modelCalls=${outcome.modelCalls} reconciled=${
        outcome.reconciled
      } total=${outcome.totalMs}ms generation=${
        outcome.stageMs.generation ?? 0
      }ms review=${outcome.stageMs.review ?? 0}ms reconciliation=${
        outcome.stageMs.reconciliation ?? 0
      }ms`,
    );
    return Response.json({ scope: outcome.scope, findings: outcome.findings });
  }

  if (outcome.error instanceof ScopeReconciliationError) {
    console.warn("[analyze] validation rejected", {
      stage: outcome.error.stage,
      category: outcome.error.category,
      totalMs: outcome.totalMs,
      completedScope: Boolean(outcome.completed.scope),
      completedFindings: outcome.completed.findings?.length ?? 0,
    });
    return Response.json(
      {
        error: outcome.error.message,
        ...(outcome.error.conflicts.length > 0
          ? { conflicts: outcome.error.conflicts }
          : {}),
      },
      { status: 422 },
    );
  }

  const message =
    outcome.error instanceof Error
      ? outcome.error.message
      : String(outcome.error);

  console.error(
    `[analyze] pipeline failed stage=${outcome.stage} total=${outcome.totalMs}ms completedScope=${Boolean(
      outcome.completed.scope,
    )} completedFindings=${outcome.completed.findings?.length ?? 0}: ${message}`,
  );

  const failure = toApiFailure(outcome.error);
  return Response.json({ error: failure.error }, { status: failure.status });
}
