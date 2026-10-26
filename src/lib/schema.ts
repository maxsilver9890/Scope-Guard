import { z } from "zod";

/**
 * How strongly the source material supports a statement.
 *
 * - confirmed:  stated directly in the client input
 * - inferred:   a reasonable interpretation, with rationale and supporting quote
 * - proposed:   introduced by Scope Guard and requiring client approval
 * - unresolved: an open decision or dependency
 */
export const commitmentStatusSchema = z.enum([
  "confirmed",
  "inferred",
  "proposed",
  "unresolved",
]);

export type CommitmentStatus = z.infer<typeof commitmentStatusSchema>;

export const scopeItemSchema = z.object({
  text: z.string().trim().min(1),
  status: commitmentStatusSchema,
  rationale: z.string().trim().min(1).optional(),
  sourceQuote: z.string().trim().min(1).optional(),
  /** Which source the quote was verified against, computed server-side. */
  sourceKind: z.enum(["transcript", "clarification"]).optional(),
  clarificationId: z.string().trim().min(1).optional(),
});

export type ScopeItem = z.infer<typeof scopeItemSchema>;

/**
 * A client answer recorded separately from the original transcript.
 * `confirmed` is true only when the user marked it as client-confirmed.
 */
export const clarificationSchema = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  confirmed: z.boolean(),
});

export type Clarification = z.infer<typeof clarificationSchema>;

const SECTION_STATUS_RULES = {
  inScope: ["confirmed", "inferred", "proposed"],
  outOfScope: ["confirmed", "proposed"],
  assumptions: ["inferred"],
  openQuestions: ["unresolved"],
  requirements: ["confirmed", "inferred", "proposed"],
  acceptanceCriteria: ["confirmed", "proposed"],
} as const satisfies Record<string, readonly CommitmentStatus[]>;

type ItemSection = keyof typeof SECTION_STATUS_RULES;

/**
 * Structural validation of raw model output, before deterministic repairs.
 * Semantic status rules are enforced by `scopeSchema` after repair.
 */
export const rawScopeSchema = z.object({
  problemStatement: z.string().trim().min(1),
  inScope: z.array(scopeItemSchema),
  outOfScope: z.array(scopeItemSchema),
  assumptions: z.array(scopeItemSchema),
  openQuestions: z.array(scopeItemSchema),
  requirements: z.array(scopeItemSchema),
  acceptanceCriteria: z.array(scopeItemSchema),
});

/**
 * Structured scope document produced by the generation pass.
 * Every item carries its commitment status so proposals never read as
 * confirmed client decisions.
 */
export const scopeSchema = rawScopeSchema
  .extend({
    clarifications: z.array(clarificationSchema).default([]),
  })
  .superRefine((scope, ctx) => {
  for (const section of Object.keys(SECTION_STATUS_RULES) as ItemSection[]) {
    const allowed: readonly CommitmentStatus[] = SECTION_STATUS_RULES[section];
    const items = scope[section];

    items.forEach((item, index) => {
      if (!allowed.includes(item.status)) {
        ctx.addIssue({
          code: "custom",
          path: [section, index, "status"],
          message: `"${item.status}" is not a valid status for ${section}.`,
        });
      }

      if (item.status === "inferred" && !item.rationale) {
        ctx.addIssue({
          code: "custom",
          path: [section, index, "rationale"],
          message: "Inferred items must include a rationale.",
        });
      }
    });
  }
});

export type Scope = z.infer<typeof scopeSchema>;

/** Sections whose items can carry confirmed/inferred/proposed status. */
export type CommitmentSection =
  | "inScope"
  | "outOfScope"
  | "requirements"
  | "acceptanceCriteria";

/**
 * One finding from the Scope Guard critique pass.
 * `sourceSnippet` must be a verbatim quote from the original input; this is
 * enforced deterministically after the model responds.
 */
export const findingSchema = z.object({
  type: z.enum([
    "ambiguity",
    "contradiction",
    "missing-info",
    "unsupported-assumption",
  ]),
  description: z.string().trim().min(1),
  whyItMatters: z.string().trim().min(1),
  sourceSnippet: z.string().trim().min(1),
  /** Which source the snippet was verified against, computed server-side. */
  sourceKind: z.enum(["transcript", "clarification"]).optional(),
  clarificationId: z.string().trim().min(1).optional(),
});

export const findingsSchema = z.array(findingSchema);

export type Finding = z.infer<typeof findingSchema>;

/**
 * Structured output may arrive as a bare array or as `{ findings: [...] }`.
 * Normalise both before validation.
 */
export function extractFindings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const findings = (value as { findings?: unknown }).findings;
    if (Array.isArray(findings)) {
      return findings;
    }
  }

  return value;
}

/**
 * Validate an array entry-by-entry so one malformed finding does not discard
 * the valid ones. Returns null when the response is not an array at all.
 */
export function salvageFindings(
  value: unknown,
): { findings: Finding[]; dropped: number } | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const findings: Finding[] = [];
  let dropped = 0;

  for (const entry of value) {
    const parsed = findingSchema.safeParse(entry);
    if (parsed.success) {
      findings.push(parsed.data);
    } else {
      dropped += 1;
    }
  }

  return { findings, dropped };
}