import { chatCompletion } from "./deepseek";
import {
  enforceFindingProvenance,
  filterFindingsInconsistentWithScope,
} from "./provenance";
import {
  formatClarificationsForReview,
  formatScopeForReview,
} from "./scope-format";
import {
  extractFindings,
  findingsSchema,
  salvageFindings,
  type Clarification,
  type Finding,
  type Scope,
} from "./schema";

const SYSTEM_PROMPT = `You are a senior consultant reviewing a scoping document before a team starts building. Compare the SOURCE MATERIAL with the STRUCTURED SCOPE DOCUMENT and find the gaps that will cause rework, disputes, security failures, or an unusable deliverable.

The SOURCE MATERIAL may contain the original client transcript and separately recorded client clarifications. Quotes may come from either source, but they must be copied verbatim. Treat a clarification labelled CONFIRMED BY CLIENT as client agreement; treat an UNCONFIRMED NOTE as provisional and not agreed. If multiple clarifications repeat the same question, only the LATEST RESPONSE is current; earlier responses are historical context.

Check these relationships explicitly:
- What the client stated versus what the scope document added.
- In Scope versus Out of Scope.
- Assumptions versus confirmed commitments.
- Requirements versus acceptance criteria.
- Functional requirements versus the data sources and integrations they depend on.
- Client access requirements versus authentication and authorization boundaries.
- Budget or financial reporting versus the availability of financial data.
- For every confirmed item, whether it adds a cadence, automation, numeric threshold, export format, or security guarantee that the quoted source does not state.
- Distinguish a confirmed business need from unverified technical feasibility. Wanting a site to continue working with a named inventory system does not confirm API availability; an explicit request to avoid duplicate manual updates does support the business need.
- A general expectation of security or reliability is not a promise of zero incidents or a measurable SLA. Identify undefined controls and acceptance boundaries without describing a supported qualitative need as an unsupported guarantee unless the scope actually adds one.
- Check whether each finding's account of the scope matches the actual status-labelled items. Do not call directly quoted requests unsupported; distinguish “requested for proposed review” from “approved commitment.”

Classification — use exactly one of these:
- "ambiguity": a statement supports materially different interpretations.
- "contradiction": two explicit statements or scope sections conflict. Both sides must be explicit. A stakeholder expressing concern, a proposal, or a recommendation is not by itself a contradiction.
- Do not report a contradiction between a proposed item and a confirmed item, or between two proposals. Proposals are not commitments. Only confirmed-vs-confirmed conflicts, or conflicts between explicit client statements, qualify.
- A manually generated report does not contradict an out-of-scope statement about automatic scheduling, delivery, or recurrence.
- If the scope marks tentative language ("let's say yes for now", "maybe", "I think") as confirmed, report unsupported-assumption.
- Group findings by root cause. If one unidentified integration, missing data source, or unresolved decision produces several symptoms, report a single finding at the most consequential point. Do not split the same gap across ambiguity, missing-info, and unsupported-assumption.
- Before reporting unsupported-assumption, locate the exact scope item and check its status. A proposed or inferred item is not a commitment; do not describe it as confirmed.
- Do not report a finding solely because a proposed, inferred, or unresolved item exists, and do not merely restate an open question. A finding is warranted only when the document mishandles it: a confirmed item lacks support, a proposal contradicts a confirmed commitment, a confirmed requirement depends on an unidentified dependency, or a material decision is absent from every section.
- If the source explicitly confirms a commitment but the scope leaves that same item proposed, report an unsupported-assumption classification mismatch unless a later client-confirmed clarification changes it.
- If the source says a decision is undecided but the scope places the feature in Out of Scope as an exclusion, report an unsupported-assumption classification. Quote the source's undecided statement; do not call it a contradiction between client statements because the exclusion came from generated scope.
- A proposed acceptance criterion may add detail. It is not a contradiction unless it conflicts with a confirmed requirement and the document presents it as agreed.
- "missing-info": a necessary decision, dependency, data source, or constraint is unresolved.
- "unsupported-assumption": the scope presents something as established even though the source does not support it.

Rules:
- Report only consequential issues. Skip cosmetic wording and generic advice.
- Report each underlying problem once. Do not repackage the same gap under a different type or in multiple findings.
- Separate findings only when they produce genuinely distinct consequences.
- Prefer three to six strong findings. Do not manufacture findings to reach a number; an empty array is valid.
- description must name the specific gap, not restate its category.
- whyItMatters must state the concrete downstream consequence: what changes, breaks, costs money, or creates risk if unresolved.
- sourceSnippet must be an EXACT, character-for-character quote from the SOURCE MATERIAL. It must never quote the generated scope document, your own summary, or a paraphrase.
- Before returning, verify each sourceSnippet appears in the source material. If you cannot quote it exactly, omit that finding.

Return ONLY a JSON object with a single key "findings" whose value is an array. Each finding has exactly these keys:
{
  "type": "ambiguity" | "contradiction" | "missing-info" | "unsupported-assumption",
  "description": "string",
  "whyItMatters": "string",
  "sourceSnippet": "string"
}

No markdown fences, no commentary, no text before or after the JSON.`;

const FINDINGS_JSON_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "ambiguity",
              "contradiction",
              "missing-info",
              "unsupported-assumption",
            ],
          },
          description: { type: "string" },
          whyItMatters: { type: "string" },
          sourceSnippet: { type: "string" },
        },
        required: ["type", "description", "whyItMatters", "sourceSnippet"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
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
      `critiqueScope: the model did not return valid JSON. Response preview: ${preview(content)}`,
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

export type CritiqueOptions = {
  clarifications?: Clarification[];
  /** Absolute pipeline deadline shared by every model call. */
  deadline?: number;
};

function buildSourceMaterial(
  rawInput: string,
  clarifications: Clarification[],
): string {
  const parts = [`ORIGINAL CLIENT TRANSCRIPT:\n${rawInput}`];
  const clarificationBlock =
    formatClarificationsForReview(clarifications);

  if (clarificationBlock) {
    parts.push(clarificationBlock);
  }

  return parts.join("\n\n");
}

export async function critiqueScope(
  rawInput: string,
  scope: Scope,
  options: CritiqueOptions = {},
): Promise<Finding[]> {
  const clarifications =
    options.clarifications ?? scope.clarifications ?? [];
  const userMessage = `SOURCE MATERIAL:
${buildSourceMaterial(rawInput, clarifications)}

STRUCTURED SCOPE DOCUMENT (status-labelled):
${formatScopeForReview(scope)}`;

  const result = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    {
      temperature: 0.2,
      maxTokens: 3000,
      jsonSchema: { name: "scope_guard_findings", schema: FINDINGS_JSON_SCHEMA },
      deadline: options.deadline,
    },
  );

  const json = extractFindings(parseJson(result.content));
  const parsed = findingsSchema.safeParse(json);

  let findings: Finding[];

  if (parsed.success) {
    findings = parsed.data;
  } else {
    const salvaged = salvageFindings(json);

    if (!salvaged || salvaged.findings.length === 0) {
      throw new Error(
        `critiqueScope: model output did not match the findings schema (${issuesFrom(
          parsed.error,
        )}). Response preview: ${preview(result.content)}`,
      );
    }

    console.warn(
      `[critique] dropped ${salvaged.dropped} malformed finding(s)`,
    );
    findings = salvaged.findings;
  }

  const provenance = enforceFindingProvenance(findings, {
    transcript: rawInput,
    clarifications,
  });
  if (provenance.rejected > 0 || provenance.duplicates > 0) {
    console.warn(
      `[critique] dropped ${provenance.rejected} unverifiable and ${provenance.duplicates} duplicate finding(s)`,
    );
  }

  const consistent = filterFindingsInconsistentWithScope(
    provenance.findings,
    scope,
    { transcript: rawInput, clarifications },
  );
  if (consistent.dropped > 0) {
    console.warn(
      `[critique] dropped ${consistent.dropped} finding(s) that misdescribed a provisional, source-backed item`,
    );
  }

  return consistent.findings;
}
