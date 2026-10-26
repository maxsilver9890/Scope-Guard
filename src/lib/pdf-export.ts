import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { questionStillOpen, type ScopeComparison } from "./diff";
import type { Clarification, CommitmentStatus, Finding, Scope, ScopeItem } from "./schema";

const statusLabels: Record<CommitmentStatus, string> = {
  confirmed: "Confirmed", inferred: "Inferred", proposed: "Proposed", unresolved: "Unresolved",
};
const statusColors: Record<CommitmentStatus, string> = {
  confirmed: "#18704f", inferred: "#286486", proposed: "#95631b", unresolved: "#566174",
};
const sectionNames: Record<string, string> = {
  inScope: "In Scope", outOfScope: "Out of Scope", assumptions: "Assumptions",
  openQuestions: "Open Questions", requirements: "Requirements", acceptanceCriteria: "Acceptance Criteria",
};
const findingNames: Record<Finding["type"], string> = {
  ambiguity: "Ambiguity", contradiction: "Contradiction", "missing-info": "Missing information",
  "unsupported-assumption": "Unsupported assumption",
};
const text = (value: string): Content => ({ text: value, fontSize: 9.5, color: "#263148", lineHeight: 1.25 });
const subhead = (value: string): Content => ({ text: value, style: "subhead", margin: [0, 10, 0, 4], keepWithNext: true });

function itemContent(item: ScopeItem, clarifications: Clarification[]): Content[] {
  const source = item.sourceKind === "clarification"
    ? clarifications.find((entry) => entry.id === item.clarificationId)
    : undefined;
  const parts: Content[] = [{
    columns: [
      { width: 66, text: statusLabels[item.status], color: statusColors[item.status], bold: true, fontSize: 8.2 },
      { width: "*", text: item.text, fontSize: 9.5, color: "#263148", lineHeight: 1.25 },
    ], columnGap: 6, margin: [0, 3, 0, 3], unbreakable: item.text.length < 800,
  }];
  if (item.rationale) parts.push({ text: [{ text: "Rationale  ", bold: true, color: "#596579" }, item.rationale], fontSize: 8.5, color: "#596579", margin: [72, 0, 0, 4], lineHeight: 1.2 });
  if (item.sourceQuote) parts.push({ text: [{ text: "Source evidence  ", bold: true }, `“${item.sourceQuote}”`], fontSize: 8.2, italics: true, color: "#596579", margin: [72, 0, 0, 4], lineHeight: 1.2 });
  if (source) parts.push({ text: source.confirmed ? "Source: client-confirmed clarification" : "Source: unconfirmed clarification", fontSize: 7.5, color: "#64748b", margin: [72, 0, 0, 4] });
  const blockLength = item.text.length + (item.rationale?.length ?? 0) + (item.sourceQuote?.length ?? 0);
  return [{ stack: parts, margin: [0, 0, 0, 5], unbreakable: blockLength < 900 }];
}

function itemSection(title: string, items: ScopeItem[], clarifications: Clarification[]): Content[] {
  const out: Content[] = [subhead(title)];
  if (items.length === 0) out.push({ text: "None recorded.", italics: true, color: "#687386", fontSize: 9, margin: [0, 2, 0, 6] });
  else for (const item of items) out.push(...itemContent(item, clarifications));
  return out;
}

function findingContent(finding: Finding, index: number, clarifications: Clarification[]): Content {
  const attribution = finding.sourceKind === "clarification"
    ? clarifications.find((entry) => entry.id === finding.clarificationId)?.confirmed
      ? "Client-confirmed clarification"
      : "Unconfirmed clarification"
    : "Original source";
  return {
    stack: [
      { text: `${index + 1}. ${findingNames[finding.type]}`, bold: true, fontSize: 9.5, color: "#1b2440", margin: [0, 0, 0, 3] },
      { text: finding.description, fontSize: 9, color: "#263148", lineHeight: 1.2 },
      { text: [{ text: "Why it matters  ", bold: true }, finding.whyItMatters], fontSize: 8.5, color: "#596579", margin: [0, 4, 0, 2], lineHeight: 1.2 },
      { text: [{ text: `${attribution}  `, bold: true }, `“${finding.sourceSnippet}”`], fontSize: 8.2, italics: true, color: "#596579", margin: [0, 3, 0, 0], lineHeight: 1.2 },
    ], margin: [0, 5, 0, 8], unbreakable: finding.description.length + finding.whyItMatters.length + finding.sourceSnippet.length < 900,
  };
}

function changeContent(comparison: ScopeComparison): Content[] {
  const result: Content[] = [];
  if (comparison.questionResolved) result.push({ text: "Resolved", style: "subhead" }, text(`Open question resolved: ${comparison.clarification.question}`));
  else result.push({ text: "Retained", style: "subhead" }, text(`Open question remains: ${comparison.clarification.question}`));
  const changes = [
    ...comparison.findings.resolved.map((f) => ({ label: "Resolved", value: f.description })),
    ...comparison.findings.remaining.map((f) => ({ label: "Retained", value: f.description })),
    ...comparison.findings.changed.map((f) => ({ label: "Changed or reworded", value: `${f.before.description} → ${f.after.description}` })),
    ...comparison.findings.added.map((f) => ({ label: "New", value: f.description })),
    ...comparison.findings.unmatched.map((f) => ({ label: "Not re-reported", value: f.description })),
    ...comparison.items.map((item) => ({ label: item.kind === "added" ? "New" : item.kind === "removed" ? "Resolved" : "Changed or reworded", value: `${sectionNames[item.section] ?? item.section}: ${item.beforeText ?? ""}${item.beforeText && item.afterText ? " → " : ""}${item.afterText ?? ""}` })),
  ];
  if (!changes.length) result.push(text("No differences were recorded."));
  for (const entry of changes) result.push({ text: [{ text: `${entry.label}  `, bold: true, color: "#286486" }, entry.value], fontSize: 8.7, margin: [0, 3, 0, 3], lineHeight: 1.2 });
  result.push(...comparison.summary.map((line) => ({ text: line, fontSize: 8, color: "#64748b", margin: [0, 2, 0, 2] } as Content)));
  return result;
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/g, "") || "project-scope";
}

function coverTitleLayout(title: string): { text: string; fontSize: number } {
  const words = title.split(/\s+/).filter(Boolean);
  const estimatedLines = Math.max(1, Math.ceil(title.length / 36));
  const targetLineLength = title.length / estimatedLines;
  const lines: string[] = [];
  let line = "";

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const candidate = line ? `${line} ${word}` : word;
    const linesRemaining = words.length - index;
    const breaksRemaining = estimatedLines - lines.length - 1;
    if (
      line &&
      breaksRemaining > 0 &&
      linesRemaining >= breaksRemaining &&
      candidate.length > targetLineLength
    ) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const fontSize = title.length > 360 ? 17 : title.length > 240 ? 19 : title.length > 140 ? 22 : 27;
  return { text: lines.join("\n"), fontSize };
}

export function pdfFilename(scope: Scope, date = new Date()): string {
  const title = scope.problemStatement.split(/[.!?\n]/)[0].split(/\s+/).slice(0, 6).join(" ");
  return `scope-guard-${slug(title)}-${date.toISOString().slice(0, 10)}.pdf`;
}

export function scopeToPdfDefinition(scope: Scope, findings: Finding[], comparison?: ScopeComparison | null, date = new Date(), editedAfterReview = false): TDocumentDefinitions {
  const clarifications = scope.clarifications ?? [];
  const title = scope.problemStatement.split(/[.!?\n]/)[0].trim() || "Project Scope";
  const coverTitle = coverTitleLayout(title);
  const sections: { name: string; id: string; content: Content[] }[] = [];
  const add = (name: string, id: string, content: Content[]) => sections.push({ name, id, content });
  const statusCounts = { confirmed: 0, inferred: 0, proposed: 0, unresolved: 0 };
  for (const key of ["inScope", "outOfScope", "assumptions", "openQuestions", "requirements", "acceptanceCriteria"] as const) {
    for (const item of scope[key]) statusCounts[item.status] += 1;
  }
  add("Executive Summary", "executive-summary", [
    ...(editedAfterReview ? [{ text: "Review status: this scope was edited after analysis. The potential delivery risks below refer to the earlier analyzed version and have not been revalidated against these edits.", fontSize: 8.5, bold: true, color: "#95631b", margin: [0, 0, 0, 8] } as Content] : []),
    text(`This scope specification records ${statusCounts.confirmed} confirmed, ${statusCounts.inferred} inferred, ${statusCounts.proposed} proposed, and ${statusCounts.unresolved} unresolved items across the project scope and requirements.`),
  ]);
  add("Problem Statement", "problem-statement", [text(scope.problemStatement)]);
  add("Scope Overview", "scope-overview", [text(`${scope.inScope.length} in-scope items · ${scope.outOfScope.length} exclusions · ${scope.assumptions.length} assumptions · ${scope.requirements.length} requirements · ${scope.acceptanceCriteria.length} acceptance criteria · ${scope.openQuestions.length} open questions.`)]);
  add("In Scope", "in-scope", itemSection("", scope.inScope, clarifications).slice(1));
  add("Out of Scope", "out-of-scope", itemSection("", scope.outOfScope, clarifications).slice(1));
  add("Assumptions", "assumptions", itemSection("", scope.assumptions, clarifications).slice(1));
  add("Requirements", "requirements", itemSection("", scope.requirements, clarifications).slice(1));
  add("Acceptance Criteria", "acceptance-criteria", itemSection("", scope.acceptanceCriteria, clarifications).slice(1));
  add("Open Questions", "open-questions", itemSection("", scope.openQuestions, clarifications).slice(1));
  add("Potential Delivery Risks", "delivery-risks", findings.length ? findings.map((finding, i) => findingContent(finding, i, clarifications)) : [{ text: "No findings were returned by the review.", italics: true, color: "#687386", fontSize: 9 }]);
  add("Client Clarifications", "client-clarifications", clarifications.length ? clarifications.flatMap((entry, i) => [
    { text: `${i + 1}. ${entry.question}`, bold: true, fontSize: 9.5, color: "#1b2440", margin: [0, 5, 0, 3], keepWithNext: true },
    { text: entry.confirmed ? "Client-confirmed answer" : "Unconfirmed note", color: entry.confirmed ? "#18704f" : "#95631b", bold: true, fontSize: 8, margin: [0, 0, 0, 2], keepWithNext: true },
    { text: questionStillOpen(scope, entry.question) ? "Current scope: question remains open" : "Current scope: question is no longer listed as open", color: "#64748b", fontSize: 7.5, margin: [0, 0, 0, 3], keepWithNext: true },
    { text: [{ text: "Answer  ", bold: true }, entry.answer], fontSize: 9, color: "#263148", margin: [0, 0, 0, 8], lineHeight: 1.2 },
  ] as Content[]) : [{ text: "None recorded.", italics: true, color: "#687386", fontSize: 9 }]);
  if (comparison) add("Change Summary", "change-summary", changeContent(comparison));

  const definition: TDocumentDefinitions = {
    pageSize: "A4", pageMargins: [48, 48, 48, 46],
    info: { title: `${title} — Project Scope & Requirements`, subject: "Scope Specification", creator: "Scope Guard" },
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#263148" },
    styles: {
      section: { fontSize: 16, bold: true, color: "#1b2440", margin: [0, 0, 0, 8], keepWithNext: true },
      subhead: { fontSize: 10, bold: true, color: "#1b2440", margin: [0, 8, 0, 3], keepWithNext: true },
    },
    footer: (currentPage, pageCount) => currentPage === 1 ? "" : ({ columns: [{ text: "SCOPE GUARD  ·  SCOPE SPECIFICATION", color: "#788397", fontSize: 7.5 }, { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#788397", fontSize: 7.5 }], margin: [48, 12, 48, 0] }),
    content: [
      { stack: [
        { text: "SCOPE GUARD", color: "#4f46e5", bold: true, fontSize: 10, margin: [0, 0, 0, 28] },
        { columns: [{ width: 460, text: coverTitle.text, color: "#1b2440", bold: true, fontSize: coverTitle.fontSize, lineHeight: 1.08, margin: [0, 0, 0, 8] }] },
        { text: "Project Scope & Requirements", color: "#596579", fontSize: 14, margin: [0, 0, 0, 16] },
        { text: `Prepared ${date.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}`, color: "#596579", fontSize: 9, margin: [0, 0, 0, 22] },
        { text: "COMMITMENT STATUS", color: "#1b2440", bold: true, fontSize: 8, margin: [0, 0, 0, 7] },
        { ul: [
          { text: [{ text: "Confirmed  ", color: statusColors.confirmed, bold: true }, "Directly stated in the source"] },
          { text: [{ text: "Inferred  ", color: statusColors.inferred, bold: true }, "Interpretation; rationale retained"] },
          { text: [{ text: "Proposed  ", color: statusColors.proposed, bold: true }, "Requires client approval"] },
          { text: [{ text: "Unresolved  ", color: statusColors.unresolved, bold: true }, "Open decision"] },
        ], fontSize: 8.5, color: "#596579", lineHeight: 1.35, markerColor: "#aab2c0" },
      ], pageBreak: "after" },
      {
        stack: [
          { text: "Contents", style: "section", margin: [0, 0, 0, 8] },
          { text: "Section list (page positions may vary with content)", fontSize: 8, color: "#64748b", margin: [0, 0, 0, 8] },
          ...sections.map((section) => ({ text: section.name, fontSize: 9.5, color: "#263148", margin: [0, 3, 0, 3] })),
        ],
        pageBreak: "after",
      },
      ...sections.flatMap((section) => [
        { text: section.name, style: "section", id: section.id, tocItem: "scope-sections", bookmark: { title: section.name, bold: true } },
        ...section.content,
        { text: "", margin: [0, 0, 0, 8] },
      ]),
    ],
  };
  return definition;
}

export async function downloadScopePdf(scope: Scope, findings: Finding[], comparison?: ScopeComparison | null, editedAfterReview = false): Promise<void> {
  const pdfModule = await import("pdfmake/build/pdfmake");
  const fontModule = await import("pdfmake/build/vfs_fonts");
  const pdfMake = (pdfModule as unknown as { default?: { addVirtualFileSystem: (vfs: object) => void; createPdf: (definition: TDocumentDefinitions) => { download: (filename: string) => Promise<void> } }; addVirtualFileSystem?: (vfs: object) => void; createPdf?: (definition: TDocumentDefinitions) => { download: (filename: string) => Promise<void> } }).default ?? pdfModule as unknown as { addVirtualFileSystem: (vfs: object) => void; createPdf: (definition: TDocumentDefinitions) => { download: (filename: string) => Promise<void> } };
  const vfs = (fontModule as unknown as { default?: object }).default ?? fontModule;
  pdfMake.addVirtualFileSystem(vfs);
  await pdfMake.createPdf(scopeToPdfDefinition(scope, findings, comparison, new Date(), editedAfterReview)).download(pdfFilename(scope));
}
