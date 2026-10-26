import { toApiFailure } from "@/lib/api-errors";
import { critiqueScope } from "@/lib/critique";
import { generateScope } from "@/lib/generate";

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

  try {
    const scope = await generateScope(source);
    const findings = await critiqueScope(source, scope);

    return Response.json({ scope, findings });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[analyze] pipeline failed:", message);

    const failure = toApiFailure(error);
    return Response.json({ error: failure.error }, { status: failure.status });
  }
}