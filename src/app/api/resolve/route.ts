import { toApiFailure } from "@/lib/api-errors";
import {
  ResolveInputError,
  resolveRequestSchema,
  resolveScope,
} from "@/lib/resolve";
import { ScopeReconciliationError } from "@/lib/reconcile";

function validationMessage(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

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

  const parsed = resolveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: validationMessage(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await resolveScope(parsed.data);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ResolveInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ScopeReconciliationError) {
      console.warn("[resolve] validation rejected", {
        stage: error.stage,
        category: error.category,
      });
      return Response.json(
        {
          error: error.message,
          ...(error.conflicts.length > 0 ? { conflicts: error.conflicts } : {}),
        },
        { status: 422 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[resolve] pipeline failed:", message);

    const failure = toApiFailure(
      error,
      "The clarification could not be applied. Your current scope was not changed.",
    );

    return Response.json(
      { error: failure.error },
      { status: failure.status },
    );
  }
}
