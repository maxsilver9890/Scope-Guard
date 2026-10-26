import { chatCompletion } from "./deepseek";
import { repairScopeProvenance } from "./provenance";
import { formatClarificationsForReview, formatScopeForReview } from "./scope-format";
import {
  rawScopeSchema,
  scopeSchema,
  type Clarification,
  type Scope,
} from "./schema";

const BASE_RULES = `You are a senior requirements analyst. Your job is to turn a messy client transcript, meeting notes, or a vague feature request into a structured scope document that never overstates what the client agreed to.

Every entry in inScope, outOfScope, assumptions, openQuestions, requirements, and acceptanceCriteria MUST be an object:
{"text": "string", "status": "confirmed" | "inferred" | "proposed" | "unresolved", "rationale": "string (optional)", "sourceQuote": "string (optional)"}

Commitment status:
- "confirmed": the source states it directly. Include a sourceQuote copied exactly from the input.
- "inferred": a reasonable interpretation. Include a rationale and a sourceQuote that supports it.
- "proposed": your recommendation or a detail the client never agreed to. Include a rationale. This requires client approval.
- "unresolved": an open decision or dependency. Use only in openQuestions.

Section rules:
- inScope and requirements: only confirmed, inferred, or proposed.
- outOfScope: confirmed only if the client explicitly excluded it; otherwise use proposed.
- assumptions: inferred only, always with a rationale.
- openQuestions: unresolved only.
- acceptanceCriteria: proposed unless the client explicitly agreed to that exact criterion; confirmed requires a sourceQuote.

Fidelity rules:
- Never invent quantitative targets, deadlines, budgets, synchronization intervals, export formats, testing percentages, SLAs, or security guarantees.
- Never turn an aspiration into a confirmed commitment. "If it's easy", "would love", "maybe", and "I think" are not agreement.
- Tentative language such as "let's say yes for now", "we can always take it out", or "maybe not in the first version" is not confirmation. Mark that item proposed.
- Client access with unresolved security concerns must be proposed or unresolved, never confirmed.
- Keep a broad requirement broad. Do not add implementation details the source does not contain.
- If the client requests a recurring report, the report itself may be confirmed, but automatic scheduling or delivery times are proposed unless stated.
- "A report for the Monday meeting" confirms only a report for that meeting. Do not record "weekly", "automatic", "8 AM", or an email delivery channel as confirmed unless the client says so.
- Do not add numeric thresholds (for example "under 3 seconds", "95%", "every 15 minutes") or export formats (PDF, Excel, CSV) anywhere. Describe the need qualitatively and put the missing threshold or format in openQuestions.
- Acceptance criteria must be observable without invented numbers: use wording such as "meets the performance target agreed with the client" and add the missing target to openQuestions. Do not add time limits such as "under five minutes".
- If the client says budget tracking is "if it's easy", classify it as proposed, not confirmed.
- Do not move an explicitly requested feature to outOfScope without marking that exclusion as proposed.
- Do not treat an unstated feature as explicitly excluded.
- sourceQuote must be a short verbatim substring of the original input or a recorded clarification (roughly 4-40 words), never a paraphrase and never text from your own summary. Omit sourceQuote for proposed items.
- problemStatement is a plain string: 1-3 sentences describing the underlying business problem without adding commitments.

Every array must be present. Use an empty array when the input genuinely has nothing for that field.`;

const CLARIFICATION_RULES = `A CLIENT CLARIFICATIONS block may be present. It is recorded separately from the original client transcript.

Clarification rules:
- An answer labelled "CONFIRMED BY CLIENT" is client-confirmed source material. You may mark an item confirmed only when its sourceQuote is copied verbatim from that answer. Never upgrade unrelated items.
- An answer labelled "UNCONFIRMED NOTE" is not client agreement. Never mark an item based on it as confirmed; use proposed or inferred with a rationale.
- Apply only what the answer actually resolves. Preserve unrelated confirmed items, exclusions, assumptions, and open questions.
- Remove the selected open question only if the clarification fully resolves it. If the answer only partly resolves it, keep the remaining uncertainty as an open question.
- A CURRENT SCOPE DOCUMENT may be supplied as context and may contain manual edits. Preserve unrelated wording and decisions; change only what the clarification requires. Do not silently upgrade unrelated requirements.
- sourceQuote may come from the original transcript or a clarification answer, but it must be a verbatim substring of that source. Never invent a quote.`;

const OUTPUT_SHAPE = `Return ONLY a single valid JSON object with exactly this shape:
{
  "problemStatement": "string",
  "inScope": [{"text": "string", "status": "confirmed", "sourceQuote": "string"}],
  "outOfScope": [{"text": "string", "status": "proposed", "rationale": "string"}],
  "assumptions": [{"text": "string", "status": "inferred", "rationale": "string", "sourceQuote": "string"}],
  "openQuestions": [{"text": "string", "status": "unresolved"}],
  "requirements": [{"text": "string", "status": "confirmed", "sourceQuote": "string"}],
  "acceptanceCriteria": [{"text": "string", "status": "proposed", "rationale": "string"}]
}

No markdown fences, no commentary, no text before or after the JSON.`;

export type GenerateOptions = {
  /** The clarification being applied in this pass. */
  clarification?: Clarification;
  /** All clarifications that should remain attached to the document. */
  clarifications?: Clarification[];
  /** The current document, including manual edits, for context. */
  currentScope?: Scope;
};

/** Strip an accidental markdown fence, then parse JSON. */
function parseJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      `generateScope: the model did not return valid JSON. Response preview: ${preview(content)}`,
    );
  }
}

function preview(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= 240 ? flat : `${flat.slice(0, 240)}…`;
}

function issuesFrom(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function mergeClarifications(
  options: GenerateOptions,
): Clarification[] {
  const existing =
    options.clarifications ?? options.currentScope?.clarifications ?? [];

  if (
    options.clarification &&
    !existing.some((entry) => entry.id === options.clarification?.id)
  ) {
    return [...existing, options.clarification];
  }

  return existing;
}

function buildUserMessage(
  rawInput: string,
  clarifications: Clarification[],
  currentScope: Scope | undefined,
): string {
  const parts = [`ORIGINAL CLIENT TRANSCRIPT:\n${rawInput}`];

  if (clarifications.length > 0) {
    parts.push(formatClarificationsForReview(clarifications));
  }

  if (currentScope) {
    parts.push(
      `CURRENT SCOPE DOCUMENT (status-labelled; may contain manual edits):\n${formatScopeForReview(
        currentScope,
      )}`,
    );
  }

  return parts.join("\n\n");
}

export async function generateScope(
  rawInput: string,
  options: GenerateOptions = {},
): Promise<Scope> {
  const clarifications = mergeClarifications(options);
  const systemPrompt =
    clarifications.length > 0
      ? `${BASE_RULES}\n\n${CLARIFICATION_RULES}\n\n${OUTPUT_SHAPE}`
      : `${BASE_RULES}\n\n${OUTPUT_SHAPE}`;

  const result = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: buildUserMessage(
          rawInput,
          clarifications,
          options.currentScope,
        ),
      },
    ],
    { temperature: 0.2, maxTokens: 5000, jsonMode: true },
  );

  const parsed = rawScopeSchema.safeParse(parseJson(result.content));
  if (!parsed.success) {
    throw new Error(
      `generateScope: model output did not match the scope schema (${issuesFrom(
        parsed.error,
      )}). Response preview: ${preview(result.content)}`,
    );
  }

  // Deterministically verify quoted support. Unsupported commitments are
  // downgraded to proposals; invalid quotes are stripped.
  const repaired = repairScopeProvenance(parsed.data, {
    transcript: rawInput,
    clarifications,
  });
  if (repaired.downgraded > 0) {
    console.warn(
      `[generate] downgraded ${repaired.downgraded} unsupported commitment(s) to proposed`,
    );
  }

  const verified = scopeSchema.safeParse({
    ...repaired.scope,
    clarifications,
  });
  if (!verified.success) {
    throw new Error(
      `generateScope: repaired scope failed validation (${issuesFrom(
        verified.error,
      )}).`,
    );
  }

  return verified.data;
}