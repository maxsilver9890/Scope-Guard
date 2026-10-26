import type {
  Clarification,
  CommitmentStatus,
  Finding,
  Scope,
  ScopeItem,
} from "./schema";

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  confirmed: "Confirmed",
  inferred: "Inferred",
  proposed: "Proposed",
  unresolved: "Unresolved",
};

const FINDING_LABEL: Record<Finding["type"], string> = {
  ambiguity: "Ambiguity",
  contradiction: "Contradiction",
  "missing-info": "Missing information",
  "unsupported-assumption": "Unsupported assumption",
};

export type MarkdownExport = {
  filename: string;
  content: string;
};

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Collapse whitespace and neutralise leading Markdown block syntax. */
export function markdownText(value: string): string {
  const flat = escapeMarkdown(value.replace(/\s+/g, " ").trim());
  return flat.replace(/^([#>*+-]|\d+\.)\s/, "\\$1 ");
}

function quoteLines(snippet: string): string {
  return snippet
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${escapeMarkdown(line.trim())}`)
    .join("\n");
}

function clarificationFor(
  item: { clarificationId?: string },
  clarifications: Clarification[],
): Clarification | undefined {
  return item.clarificationId
    ? clarifications.find((entry) => entry.id === item.clarificationId)
    : undefined;
}

function itemSourceNote(
  item: ScopeItem,
  clarifications: Clarification[],
): string {
  if (item.sourceKind !== "clarification") {
    return "";
  }

  const clarification = clarificationFor(item, clarifications);
  if (!clarification) {
    return " _(from a client clarification)_";
  }

  return clarification.confirmed
    ? " _(from a client-confirmed clarification)_"
    : " _(from an unconfirmed note)_";
}

function renderItems(
  items: ScopeItem[],
  clarifications: Clarification[],
): string {
  if (items.length === 0) {
    return "_None recorded._";
  }

  return items
    .map((item) => {
      const label = STATUS_LABEL[item.status] ?? item.status;
      const lines = [
        `- **${label}** — ${markdownText(item.text)}${itemSourceNote(
          item,
          clarifications,
        )}`,
      ];

      if (item.rationale) {
        lines.push(`  - Rationale: ${markdownText(item.rationale)}`);
      }

      return lines.join("\n");
    })
    .join("\n");
}

function renderClarifications(clarifications: Clarification[]): string {
  return clarifications
    .map((clarification, index) => {
      const state = clarification.confirmed
        ? "Confirmed by client"
        : "Unconfirmed note";
      return [
        `### ${index + 1}. ${markdownText(clarification.question)}`,
        "",
        `**Status:** ${state}`,
        "",
        `**Answer:** ${markdownText(clarification.answer)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function renderFindings(
  findings: Finding[],
  clarifications: Clarification[],
): string {
  if (findings.length === 0) {
    return "_No findings were returned by the review._";
  }

  return findings
    .map((finding, index) => {
      const label = FINDING_LABEL[finding.type] ?? finding.type;
      const clarification = clarificationFor(finding, clarifications);
      const sourceLabel =
        finding.sourceKind === "clarification"
          ? clarification?.confirmed === false
            ? "Source evidence (unconfirmed clarification):"
            : "Source evidence (client clarification):"
          : "Source evidence:";

      return [
        `### ${index + 1}. ${label}`,
        "",
        `**Description:** ${markdownText(finding.description)}`,
        "",
        `**Why it matters:** ${markdownText(finding.whyItMatters)}`,
        "",
        `**${sourceLabel}**`,
        "",
        quoteLines(finding.sourceSnippet),
      ].join("\n");
    })
    .join("\n\n");
}

export function markdownFilename(scope: Scope): string {
  const slug = scope.problemStatement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return `scope-guard-${slug || "project-scope"}.md`;
}

export function scopeToMarkdown(
  scope: Scope,
  findings: Finding[],
  options: { edited?: boolean } = {},
): MarkdownExport {
  const clarifications = scope.clarifications ?? [];
  const editedNote = options.edited
    ? "\n_Edited after analysis. Findings below refer to the analyzed version._\n"
    : "";

  const content = [
    "# Project Scope",
    "",
    "_Structured requirements brief_",
    editedNote,
    "_Status labels: Confirmed = stated in the source; Inferred = interpretation with stated rationale; Proposed = needs client approval; Unresolved = open decision. Client clarifications are recorded separately from the original transcript._",
    "",
    "## Problem Statement",
    "",
    markdownText(scope.problemStatement),
    "",
    "## In Scope",
    "",
    renderItems(scope.inScope, clarifications),
    "",
    "## Out of Scope",
    "",
    renderItems(scope.outOfScope, clarifications),
    "",
    "## Assumptions",
    "",
    renderItems(scope.assumptions, clarifications),
    "",
    "## Open Questions",
    "",
    renderItems(scope.openQuestions, clarifications),
    "",
    "## Client Clarifications",
    "",
    clarifications.length > 0
      ? renderClarifications(clarifications)
      : "_None recorded._",
    "",
    "## Requirements",
    "",
    renderItems(scope.requirements, clarifications),
    "",
    "## Acceptance Criteria",
    "",
    renderItems(scope.acceptanceCriteria, clarifications),
    "",
    "## Scope Guard Findings",
    "",
    renderFindings(findings, clarifications),
    "",
  ].join("\n");

  return {
    filename: markdownFilename(scope),
    content,
  };
}