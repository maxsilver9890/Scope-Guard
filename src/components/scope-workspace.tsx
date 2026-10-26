"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { downloadScopePdf } from "@/lib/pdf-export";
import { ScopeInput } from "@/components/scope-input";
import {
  isScopeComparison,
  SECTION_LABELS,
  type ItemChange,
  type ScopeComparison,
} from "@/lib/diff";
import {
  scrollToSection,
  ScopeNav,
  useActiveSection,
  type NavItem,
} from "@/components/scope-nav";
import type {
  Clarification,
  Finding,
  Scope,
  ScopeItem,
} from "@/lib/schema";

type AnalysisStatus = "idle" | "loading" | "success" | "error";
type ExportStatus = "idle" | "loading" | "success" | "error";
type ScopeItemSection =
  | "inScope"
  | "outOfScope"
  | "assumptions"
  | "openQuestions"
  | "requirements"
  | "acceptanceCriteria";

const FINDING_STYLES: Record<
  string,
  { label: string; badge: string; rail: string }
> = {
  ambiguity: {
    label: "Ambiguity",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    rail: "border-l-amber-300",
  },
  contradiction: {
    label: "Contradiction",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    rail: "border-l-rose-300",
  },
  "missing-info": {
    label: "Missing information",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    rail: "border-l-sky-300",
  },
  "unsupported-assumption": {
    label: "Unsupported assumption",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    rail: "border-l-orange-300",
  },
};

const STATUS_STYLES: Record<
  string,
  {
    label: string;
    badge: string;
    description: string;
    dot: string;
  }
> = {
  confirmed: {
    label: "Confirmed",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description: "Stated in the source",
    dot: "bg-emerald-500",
  },
  inferred: {
    label: "Inferred",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    description: "Interpretation, rationale shown",
    dot: "bg-sky-500",
  },
  proposed: {
    label: "Proposed",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    description: "Needs client approval",
    dot: "bg-amber-500",
  },
  unresolved: {
    label: "Unresolved",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    description: "Open decision",
    dot: "bg-slate-400",
  },
};

const FALLBACK_BADGE = "border-line bg-canvas text-muted";

const ITEM_SECTIONS = [
  "inScope",
  "outOfScope",
  "assumptions",
  "openQuestions",
  "requirements",
  "acceptanceCriteria",
] as const;

function countStatuses(scope: Scope) {
  const counts = {
    confirmed: 0,
    inferred: 0,
    proposed: 0,
    unresolved: 0,
  };

  for (const section of ITEM_SECTIONS) {
    for (const item of scope[section]) {
      counts[item.status] += 1;
    }
  }

  return counts;
}

const TOOLBAR_BUTTON =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-line/80 bg-white/70 px-3 text-[11px] font-medium text-forest transition-all duration-200 hover:border-accent/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const TOOLBAR_PRIMARY =
  "inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-3.5 text-[11px] font-medium text-white shadow-[0_1px_2px_rgba(79,70,229,0.28),0_8px_20px_-12px_rgba(79,70,229,0.6)] transition-all duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`animate-spin motion-reduce:animate-none ${className}`}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AnalyzeArrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
    >
      <path
        d="M2.5 8h10M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M3 13h2.5L13 5.5 10.5 3 3 10.5V13Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="m9.5 4 2.5 2.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="m3 8.5 3.5 3.5L13 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M8 2v7m0 0 2.75-2.75M8 9 5.25 6.25M3 11.5v1.25A1.25 1.25 0 0 0 4.25 14h7.5A1.25 1.25 0 0 0 13 12.75V11.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyMotif() {
  return (
    <svg
      width="92"
      height="92"
      viewBox="0 0 92 92"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="12.5"
        y="12.5"
        width="67"
        height="67"
        rx="2"
        stroke="#1B2440"
        strokeOpacity="0.16"
      />
      <rect
        x="26.5"
        y="26.5"
        width="39"
        height="39"
        rx="1"
        stroke="#1B2440"
        strokeOpacity="0.24"
        strokeDasharray="2 4"
      />
      <path
        d="M12.5 46h12M67.5 46h12M46 12.5v12M46 67.5v12"
        stroke="#1B2440"
        strokeOpacity="0.22"
      />
      <circle cx="46" cy="46" r="3" fill="#4F46E5" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9.5px] font-semibold uppercase leading-none tracking-[0.08em] ${
        style?.badge ?? FALLBACK_BADGE
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${style?.dot ?? "bg-muted/50"}`}
      />
      {style?.label ?? status}
    </span>
  );
}

function StatusLegend() {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 border-b border-line/60 bg-slate-50/40 px-5 py-4 sm:grid-cols-2 sm:px-7 lg:px-9">
      {(["confirmed", "inferred", "proposed", "unresolved"] as const).map(
        (status) => (
          <div key={status} className="flex items-start gap-2">
            <dt className="shrink-0">
              <StatusBadge status={status} />
            </dt>
            <dd className="text-[10.5px] leading-4 text-muted">
              {STATUS_STYLES[status].description}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}

function DocumentSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 border-t border-line/60 py-7 first:border-t-0 first:pt-6 last:pb-8 lg:scroll-mt-24"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px w-5 shrink-0 bg-accent/60" />
        <h3 className="text-[10.5px] font-semibold uppercase leading-5 tracking-[0.2em] text-forest/75">
          {title}
        </h3>
      </div>
      <div className="mt-3.5 sm:pl-8">{children}</div>
    </section>
  );
}

function EmptyNote() {
  return (
    <p className="text-[12.5px] italic leading-6 text-muted/90">
      None recorded in the source material.
    </p>
  );
}

function ClarificationStateBadge({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${
        confirmed
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          confirmed ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {confirmed ? "Client confirmed" : "Unconfirmed note"}
    </span>
  );
}

function ScopeItemList({
  items,
  clarifications = [],
  onResolveQuestion,
  activeQuestion,
  resolveForm,
}: {
  items: ScopeItem[];
  clarifications?: Clarification[];
  onResolveQuestion?: (question: string) => void;
  activeQuestion?: string | null;
  resolveForm?: ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyNote />;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const clarification = item.clarificationId
          ? clarifications.find((entry) => entry.id === item.clarificationId)
          : undefined;

        return (
          <li
            key={`${index}-${item.text.slice(0, 28)}`}
            className="grid gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-3"
          >
            <div>
              <StatusBadge status={item.status} />
            </div>
            <div className="max-w-[68ch]">
              <p className="text-[13.5px] leading-6 text-ink/85">{item.text}</p>
              {item.rationale && item.status !== "confirmed" ? (
                <p className="mt-1 text-[11.5px] leading-5 text-muted">
                  <span className="font-medium text-forest/70">Rationale:</span>{" "}
                  {item.rationale}
                </p>
              ) : null}
              {clarification ? (
                <p className="mt-1 text-[10.5px] leading-5 text-muted">
                  {clarification.confirmed
                    ? "From a client-confirmed clarification"
                    : "From an unconfirmed note"}
                </p>
              ) : null}
              {item.status === "unresolved" && onResolveQuestion ? (
                activeQuestion === item.text ? (
                  <div className="mt-3">{resolveForm}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onResolveQuestion(item.text)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-surface px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-forest transition-colors hover:border-forest/30 hover:bg-sage/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Resolve question
                    <AnalyzeArrow />
                  </button>
                )
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ScopeItemEditor({
  items,
  label,
  onChange,
}: {
  items: ScopeItem[];
  label: string;
  onChange: (index: number, text: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyNote />;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li
          key={`${index}-${item.text.slice(0, 28)}`}
          className="grid gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-3"
        >
          <div>
            <StatusBadge status={item.status} />
          </div>
          <div>
            <textarea
              value={item.text}
              onChange={(event) => onChange(index, event.target.value)}
              rows={2}
              aria-label={`${label} item ${index + 1}`}
              className="block w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-[13px] leading-6 text-ink/90 outline-none transition-colors focus:border-accent/70 focus:ring-4 focus:ring-accent-soft"
            />
            {item.rationale && item.status !== "confirmed" ? (
              <p className="mt-1 text-[11.5px] leading-5 text-muted">
                <span className="font-medium text-forest/70">Rationale:</span>{" "}
                {item.rationale}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

type ResolveSubmission = {
  answer: string;
  confirmed: boolean;
  acknowledgeEdits: boolean;
};

function ResolveQuestionForm({
  question,
  isEdited,
  sourceChanged,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  question: string;
  isEdited: boolean;
  sourceChanged: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (submission: ResolveSubmission) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledgeEdits, setAcknowledgeEdits] = useState(false);

  const canSubmit =
    answer.trim().length > 0 &&
    !pending &&
    (!isEdited || acknowledgeEdits);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) {
          return;
        }
        onSubmit({
          answer: answer.trim(),
          confirmed,
          acknowledgeEdits,
        });
      }}
      className="rounded-lg border border-line bg-canvas/60 p-4"
    >
      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-brass">
        Resolve question
      </p>
      <p className="mt-1.5 text-[12.5px] font-medium leading-5 text-ink">
        {question}
      </p>

      <label
        htmlFor="clarification-answer"
        className="mt-3 block text-[10px] font-medium uppercase tracking-[0.14em] text-forest/70"
      >
        Client answer
      </label>
      <textarea
        id="clarification-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={3}
        placeholder="Record the answer the client actually gave…"
        className="mt-1.5 block w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-[12.5px] leading-5 text-ink/90 outline-none transition-colors placeholder:text-muted/60 focus:border-accent/70 focus:ring-4 focus:ring-accent-soft"
      />

      <label className="mt-3 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#4f46e5]"
        />
        <span className="text-[11px] leading-5 text-muted">
          <span className="font-medium text-ink">
            The client confirmed this answer.
          </span>{" "}
          Confirmed answers can promote supported items to confirmed. An
          unchecked answer is stored as an unconfirmed note and cannot create a
          confirmed commitment.
        </span>
      </label>

      {isEdited ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] leading-5 text-amber-800">
            This document has manual edits. Regenerating the scope will replace
            them.
          </p>
          <label className="mt-2 flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={acknowledgeEdits}
              onChange={(event) => setAcknowledgeEdits(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#4f46e5]"
            />
            <span className="text-[11px] leading-5 text-amber-800">
              I understand these edits will be replaced.
            </span>
          </label>
        </div>
      ) : null}

      {sourceChanged ? (
        <p className="mt-2 text-[10.5px] leading-5 text-muted">
          Resolution uses the transcript from the last analysis. Re-analyze if
          you changed the source.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[11px] leading-5 text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-[11px] font-medium text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:bg-accent/45"
        >
          {pending ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              Applying…
            </>
          ) : (
            "Apply clarification"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-[11px] font-medium text-forest transition-colors hover:border-forest/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ClarificationList({
  clarifications,
}: {
  clarifications: Clarification[];
}) {
  return (
    <ul className="space-y-3">
      {clarifications.map((clarification) => (
        <li
          key={clarification.id}
          className={`rounded-xl border border-line/70 border-l-2 bg-white px-4 py-3 ${
            clarification.confirmed
              ? "border-l-emerald-300"
              : "border-l-slate-300"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="max-w-[60ch] text-[12.5px] font-medium leading-5 text-ink">
              {clarification.question}
            </p>
            <ClarificationStateBadge confirmed={clarification.confirmed} />
          </div>
          <p className="mt-2 max-w-[68ch] text-[12px] leading-5 text-muted">
            <span className="font-medium text-forest/70">Answer:</span>{" "}
            {clarification.answer}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ComparisonFindingRow({
  finding,
  label,
}: {
  finding: Finding;
  label: string;
}) {
  const style =
    FINDING_STYLES[finding.type.trim().toLowerCase()] ?? {
      label: finding.type,
      badge: FALLBACK_BADGE,
    };

  return (
    <li className="rounded-md border border-line bg-surface px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[8.5px] font-semibold uppercase leading-none tracking-[0.1em] ${style.badge}`}
        >
          {style.label}
        </span>
        <span className="text-[9px] uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-ink/85">
        {finding.description}
      </p>
      <p className="mt-1 text-[10.5px] italic leading-5 text-muted/80">
        &ldquo;{finding.sourceSnippet}&rdquo;
      </p>
    </li>
  );
}

function ComparisonItemRow({ change }: { change: ItemChange }) {
  const section = SECTION_LABELS[change.section];
  const kindLabel =
    change.kind === "added"
      ? "Added"
      : change.kind === "removed"
        ? "Removed"
        : "Changed";

  return (
    <li className="rounded-md border border-line bg-surface px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
        <span className="text-muted">{section}</span>
        <span className="text-muted/50" aria-hidden="true">
          ·
        </span>
        <span
          className={
            change.kind === "added"
              ? "text-amber-800"
              : change.kind === "removed"
                ? "text-[#843B2F]"
                : "text-forest"
          }
        >
          {kindLabel}
        </span>
        {change.statusChanged && change.beforeStatus && change.afterStatus ? (
          <span className="flex items-center gap-1.5">
            <StatusBadge status={change.beforeStatus} />
            <span className="text-muted" aria-hidden="true">
              →
            </span>
            <StatusBadge status={change.afterStatus} />
          </span>
        ) : null}
      </div>

      {change.kind === "changed" ? (
        <div className="mt-2 space-y-2">
          {change.textChanged ? (
            <>
              <p className="text-[11.5px] leading-5 text-muted">
                <span className="font-medium">Before:</span>{" "}
                {change.beforeText}
              </p>
              <p className="text-[12.5px] leading-5 text-ink/85">
                <span className="font-medium text-forest/80">After:</span>{" "}
                {change.afterText}
              </p>
            </>
          ) : (
            <p className="text-[11.5px] leading-5 text-muted">
              {change.statusChanged
                ? "Commitment status updated."
                : "Source attribution changed."}
            </p>
          )}
          {change.afterRationale ? (
            <p className="text-[10.5px] leading-5 text-muted">
              <span className="font-medium text-forest/70">Rationale:</span>{" "}
              {change.afterRationale}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-[12.5px] leading-5 text-ink/85">
            {change.kind === "added" ? change.afterText : change.beforeText}
          </p>
          {change.kind === "added" && change.afterStatus ? (
            <div className="mt-1.5">
              <StatusBadge status={change.afterStatus} />
            </div>
          ) : null}
          {change.kind === "removed" && change.beforeStatus ? (
            <div className="mt-1.5">
              <StatusBadge status={change.beforeStatus} />
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ComparisonPanel({ comparison }: { comparison: ScopeComparison }) {
  const { findings, items } = comparison;
  const hasFindings =
    findings.resolved.length +
      findings.remaining.length +
      findings.changed.length +
      findings.added.length +
      findings.unmatched.length >
    0;

  return (
    <section
      id="changes"
      aria-labelledby="comparison-heading"
      className="scroll-mt-32 rounded-2xl border border-accent-line/80 bg-accent-soft/60 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl lg:scroll-mt-24 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-brass">
            Clarification applied
          </p>
          <h2
            id="comparison-heading"
            className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-forest"
          >
            What changed
          </h2>
        </div>
        <ClarificationStateBadge confirmed={comparison.clarification.confirmed} />
      </div>

      <div className="mt-4 rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-[9px] uppercase tracking-[0.18em] text-muted">
          Question
        </p>
        <p className="mt-1 text-[12.5px] font-medium leading-5 text-ink">
          {comparison.clarification.question}
        </p>
        <p className="mt-3 text-[9px] uppercase tracking-[0.18em] text-muted">
          Recorded answer
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-ink/85">
          {comparison.clarification.answer}
        </p>
        <p
          className={`mt-2 text-[11px] leading-5 ${
            comparison.questionResolved ? "text-forest" : "text-amber-800"
          }`}
        >
          {comparison.questionResolved
            ? "This question is no longer open in the updated scope."
            : "This question remains open; the answer did not fully resolve it."}
        </p>
      </div>

      <ul className="mt-4 space-y-1.5">
        {comparison.summary.map((line) => (
          <li
            key={line}
            className="flex gap-2 text-[11px] leading-5 text-muted"
          >
            <span
              aria-hidden="true"
              className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-brass/70"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-forest/70">
          Scope changes
        </h3>
        {items.length === 0 ? (
          <p className="mt-2 text-[11.5px] leading-5 text-muted">
            No scope items changed.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map((change, index) => (
              <ComparisonItemRow
                key={`${change.section}-${change.kind}-${index}`}
                change={change}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-forest/70">
          Findings
        </h3>
        {!hasFindings ? (
          <p className="mt-2 text-[11.5px] leading-5 text-muted">
            No findings were available for comparison.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {findings.resolved.length > 0 ? (
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-forest/70">
                  Resolved
                </p>
                <ul className="mt-1.5 space-y-2">
                  {findings.resolved.map((finding, index) => (
                    <ComparisonFindingRow
                      key={`resolved-${index}`}
                      finding={finding}
                      label="Resolved"
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {findings.remaining.length > 0 ? (
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-forest/70">
                  Retained
                </p>
                <ul className="mt-1.5 space-y-2">
                  {findings.remaining.map((finding, index) => (
                    <ComparisonFindingRow
                      key={`remaining-${index}`}
                      finding={finding}
                      label="Retained"
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {findings.changed.length > 0 ? (
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-forest/70">
                  Reworded
                </p>
                <ul className="mt-1.5 space-y-2">
                  {findings.changed.map((change, index) => (
                    <li
                      key={`changed-${index}`}
                      className="rounded-md border border-line bg-surface px-3.5 py-3"
                    >
                      <p className="text-[9px] uppercase tracking-[0.14em] text-muted">
                        Before
                      </p>
                      <p className="mt-1 text-[11.5px] leading-5 text-muted">
                        {change.before.description}
                      </p>
                      <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-forest/70">
                        After
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-ink/85">
                        {change.after.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {findings.added.length > 0 ? (
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-amber-800">
                  New
                </p>
                <ul className="mt-1.5 space-y-2">
                  {findings.added.map((finding, index) => (
                    <ComparisonFindingRow
                      key={`added-${index}`}
                      finding={finding}
                      label="New"
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {findings.unmatched.length > 0 ? (
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-muted">
                  Not re-reported
                </p>
                <ul className="mt-1.5 space-y-2">
                  {findings.unmatched.map((finding, index) => (
                    <ComparisonFindingRow
                      key={`unmatched-${index}`}
                      finding={finding}
                      label="Unmatched"
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function FindingCard({
  finding,
  index,
  clarifications = [],
}: {
  finding: Finding;
  index: number;
  clarifications?: Clarification[];
}) {
  const key = finding.type.trim().toLowerCase();
  const style = FINDING_STYLES[key];
  const label = style?.label ?? finding.type;
  const badge = style?.badge ?? FALLBACK_BADGE;
  const snippet =
    typeof finding.sourceSnippet === "string" ? finding.sourceSnippet.trim() : "";
  const clarification = finding.clarificationId
    ? clarifications.find((entry) => entry.id === finding.clarificationId)
    : undefined;

  return (
    <article
      className={`rounded-xl border border-line/70 border-l-2 ${
        style?.rail ?? "border-l-line"
      } bg-white p-4 transition-colors duration-200 hover:border-accent/30 sm:p-5`}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`inline-flex items-center rounded-[3px] border px-2 py-1 text-[9.5px] font-semibold uppercase leading-none tracking-[0.12em] ${badge}`}
        >
          {label}
        </span>
        <span className="font-mono text-[9.5px] tabular-nums tracking-[0.1em] text-muted/60">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <p className="mt-3.5 text-[14.5px] font-medium leading-6 text-ink">
        {finding.description}
      </p>

      <div className="mt-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
          Why it matters
        </p>
        <p className="mt-1 text-[12.5px] leading-6 text-muted">
          {finding.whyItMatters}
        </p>
      </div>

      {snippet ? (
        <blockquote className="mt-3.5 whitespace-pre-line border-l-2 border-accent/40 bg-accent-soft/60 px-3.5 py-2.5 text-[12px] italic leading-6 text-forest/80">
          {finding.sourceKind === "clarification" ? (
            <span className="mb-1 block text-[9px] font-medium uppercase not-italic tracking-[0.14em] text-muted">
              {clarification?.confirmed === false
                ? "Source: unconfirmed clarification"
                : "Source: client clarification"}
            </span>
          ) : null}
          &ldquo;{snippet}&rdquo;
        </blockquote>
      ) : null}
    </article>
  );
}

export function ScopeWorkspace({ initialInput }: { initialInput: string }) {
  const [input, setInput] = useState(initialInput);
  const [scope, setScope] = useState<Scope | null>(null);
  const [editedScope, setEditedScope] = useState<Scope | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [analyzedInput, setAnalyzedInput] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ScopeComparison | null>(null);

  const isAnalyzing = status === "loading";
  const hasResults =
    scope !== null && editedScope !== null && findings !== null;
  const statusCounts =
    hasResults && editedScope ? countStatuses(editedScope) : null;

  const navItems: NavItem[] =
    hasResults && editedScope
      ? [
          { id: "overview", label: "Overview", icon: "overview" },
          { id: "in-scope", label: "In Scope", icon: "in-scope" },
          { id: "out-of-scope", label: "Out of Scope", icon: "out-of-scope" },
          { id: "assumptions", label: "Assumptions", icon: "assumptions" },
          { id: "open-questions", label: "Open Questions", icon: "questions" },
          { id: "requirements", label: "Requirements", icon: "requirements" },
          {
            id: "acceptance-criteria",
            label: "Acceptance Criteria",
            icon: "acceptance",
          },
          { id: "risks", label: "Delivery Risks", icon: "risks" },
          ...(editedScope.clarifications.length > 0
            ? [
                {
                  id: "clarifications",
                  label: "Clarifications",
                  icon: "clarifications" as const,
                },
              ]
            : []),
          ...(comparison
            ? [
                {
                  id: "changes",
                  label: "What Changed",
                  icon: "changes" as const,
                },
              ]
            : []),
        ]
      : [];

  const hasSidebar = hasResults && navItems.length > 0;
  const activeSection = useActiveSection(navItems.map((item) => item.id));
  const comparisonKey = comparison
    ? `${comparison.clarification.question}|${comparison.clarification.answer}`
    : "";

  useEffect(() => {
    if (!comparisonKey) {
      return;
    }
    scrollToSection("changes");
  }, [comparisonKey]);

  const sourceStatus =
    status === "loading"
      ? "Analyzing"
      : status === "success"
        ? "Analysis complete"
        : status === "error"
          ? "Analysis failed"
          : "Ready to analyze";

  const statusDot =
    status === "loading"
      ? "bg-amber-400"
      : status === "success"
        ? "bg-emerald-500"
        : status === "error"
          ? "bg-rose-500"
          : "bg-accent";

  const announcement =
    status === "loading"
      ? hasResults
        ? "Updating analysis. Previous results remain visible."
        : "Analyzing source material."
      : status === "success"
        ? "Analysis complete."
        : status === "error"
          ? "Analysis failed."
          : "";

  async function runAnalysis() {
    const source = input.trim();
    if (!source || isAnalyzing || isResolving) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: source }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : null;
        throw new Error(
          serverMessage ??
            "The analysis could not be completed. Please try again.",
        );
      }

      if (
        !isRecord(payload) ||
        !("scope" in payload) ||
        !Array.isArray(payload.findings)
      ) {
        throw new Error(
          "The analysis returned an unexpected response. Please try again.",
        );
      }

      const nextScope = payload.scope as Scope;
      const nextFindings = payload.findings as Finding[];

      setScope(nextScope);
      setEditedScope(nextScope);
      setFindings(nextFindings);
      setAnalyzedInput(source);
      setComparison(null);
      setResolveTarget(null);
      setResolveError(null);
      setIsEdited(false);
      setIsEditing(false);
      setExportStatus("idle");
      setStatus("success");
    } catch (caught) {
      const message =
        caught instanceof TypeError
          ? "Could not reach the analysis service. Check your connection and try again."
          : caught instanceof Error && caught.message
            ? caught.message
            : "The analysis could not be completed. Please try again.";
      setError(message);
      setStatus("error");
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (status === "success" || status === "error") {
      setStatus("idle");
    }
    if (error) {
      setError(null);
    }
  }

  function applyScopeEdit(next: Scope) {
    setEditedScope(next);
    setIsEdited(scope ? JSON.stringify(next) !== JSON.stringify(scope) : true);
    setExportStatus("idle");
  }

  function updateProblemStatement(text: string) {
    if (!editedScope) {
      return;
    }
    applyScopeEdit({ ...editedScope, problemStatement: text });
  }

  function updateItem(section: ScopeItemSection, index: number, text: string) {
    if (!editedScope) {
      return;
    }
    const next: Scope = { ...editedScope };
    next[section] = editedScope[section].map((item, itemIndex) =>
      itemIndex === index ? { ...item, text } : item,
    );
    applyScopeEdit(next);
  }

  async function handleExport() {
    if (!editedScope || !findings || exportStatus === "loading") {
      return;
    }

    setExportStatus("loading");
    try {
      await downloadScopePdf(editedScope, findings, comparison);
      setExportStatus("success");
    } catch {
      setExportStatus("error");
    }
  }

  async function handleResolve(submission: ResolveSubmission) {
    if (!editedScope || !findings || !resolveTarget || isResolving) {
      return;
    }

    if (!analyzedInput) {
      setResolveError(
        "Re-analyze the source before resolving a question.",
      );
      return;
    }

    setIsResolving(true);
    setResolveError(null);

    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: analyzedInput,
          scope: editedScope,
          findings,
          question: resolveTarget,
          answer: submission.answer,
          confirmed: submission.confirmed,
          acknowledgeEdits: submission.acknowledgeEdits,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : null;
        throw new Error(
          serverMessage ??
            "The clarification could not be applied. Your current scope was not changed.",
        );
      }

      if (
        !isRecord(payload) ||
        !("scope" in payload) ||
        !Array.isArray(payload.findings) ||
        !isScopeComparison(payload.comparison)
      ) {
        throw new Error(
          "The clarification returned an unexpected response. Your current scope was not changed.",
        );
      }

      const nextScope = payload.scope as Scope;
      setScope(nextScope);
      setEditedScope(nextScope);
      setFindings(payload.findings as Finding[]);
      setComparison(payload.comparison);
      setIsEdited(false);
      setIsEditing(false);
      setResolveTarget(null);
      setResolveError(null);
      setExportStatus("idle");
      setStatus("success");
    } catch (caught) {
      const message =
        caught instanceof TypeError
          ? "Could not reach the analysis service. Your current scope was not changed."
          : caught instanceof Error && caught.message
            ? caught.message
            : "The clarification could not be applied. Your current scope was not changed.";
      setResolveError(message);
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <section aria-label="Scoping analysis workspace" className="mt-6 lg:mt-8">
      {hasSidebar ? (
        <ScopeNav
          variant="bar"
          items={navItems}
          activeId={activeSection}
          onNavigate={scrollToSection}
        />
      ) : null}

      <div
        className={
          hasSidebar
            ? "lg:grid lg:grid-cols-[228px_minmax(0,1fr)] lg:gap-10 xl:gap-12"
            : undefined
        }
      >
        {hasSidebar ? (
          <ScopeNav
            variant="rail"
            items={navItems}
            activeId={activeSection}
            onNavigate={scrollToSection}
          />
        ) : null}

        <div className="min-w-0">
          <div
            className={
              hasSidebar
                ? "grid gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-10"
                : "grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10"
            }
          >
      <aside aria-labelledby="brief-heading" className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-32px_rgba(15,23,42,0.3)] backdrop-blur-xl">
          <div className="border-b border-line/80 px-5 py-5 sm:px-6">
            <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-brass">
              01 / Source material
            </p>
            <h2
              id="brief-heading"
              className="mt-2.5 font-serif text-[26px] leading-tight tracking-[-0.01em] text-forest"
            >
              Project brief
            </h2>
            <p className="mt-2 max-w-[44ch] text-[12.5px] leading-6 text-muted">
              Paste a client conversation, meeting transcript, or rough project
              description. Scope Guard will separate what was confirmed from
              what still needs a decision.
            </p>
          </div>

          <ScopeInput
            input={input}
            onInputChange={handleInputChange}
            onAnalyze={() => void runAnalysis()}
            analysisError={error}
            isAnalyzing={isAnalyzing}
            isResolving={isResolving}
            statusDot={statusDot}
            sourceStatus={sourceStatus}
          />
        </div>
      </aside>

      <div className="min-w-0" aria-busy={isAnalyzing || isResolving}>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {!hasResults ? (
          isAnalyzing ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-xl border border-line bg-surface px-8 py-16 text-center lg:min-h-[620px]">
              <Spinner className="h-7 w-7 text-forest/60" />
              <p className="mt-6 text-[9.5px] font-medium uppercase tracking-[0.24em] text-brass">
                Running analysis
              </p>
              <p className="mt-3 font-serif text-[22px] text-forest">
                Reading the source material
              </p>
              <p className="mt-2 max-w-xs text-[12.5px] leading-6 text-muted">
                Extracting only supported commitments, then reviewing the
                document for gaps and unsupported assumptions.
              </p>
            </div>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-xl border border-line bg-surface px-8 py-16 text-center lg:min-h-[620px]">
              <EmptyMotif />
              <p className="mt-7 text-[9.5px] font-medium uppercase tracking-[0.24em] text-brass">
                Your analysis will appear here
              </p>
              <p className="mt-3 max-w-sm text-[13px] leading-6 text-muted">
                A structured scope document that separates confirmed
                commitments from proposals, plus a focused review of delivery
                risks.
              </p>
              <div className="mt-8 flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.18em] text-muted/70">
                <span>Scope document</span>
                <span aria-hidden="true" className="h-px w-5 bg-line" />
                <span>Scope Guard review</span>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-7">
            {isAnalyzing ? (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3.5 py-2.5 text-[11px] text-muted"
              >
                <Spinner className="h-3.5 w-3.5 text-forest/70" />
                <span>Updating analysis… previous results remain visible.</span>
              </div>
            ) : null}

            <article
              aria-labelledby="scope-doc-heading"
              className="overflow-hidden rounded-2xl border border-line/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-32px_rgba(15,23,42,0.3)] backdrop-blur-xl"
            >
              <header className="border-b border-line/60 px-5 py-6 sm:px-7 lg:px-9">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0">
                  <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-brass">
                    Scope document
                  </p>
                  <h2
                    id="scope-doc-heading"
                    className="mt-2 font-serif text-[32px] leading-none tracking-[-0.018em] text-forest sm:text-[36px]"
                  >
                    Project Scope
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
                    <span>Structured requirements brief</span>
                    <span aria-hidden="true" className="h-3 w-px bg-line" />
                    <span>Source: pasted brief</span>
                    {isEdited ? (
                      <span className="rounded-[3px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8.5px] tracking-[0.1em] text-amber-800">
                        Edited
                      </span>
                    ) : null}
                  </p>


                </div>

                  <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing((current) => !current);
                        setResolveTarget(null);
                        setResolveError(null);
                        setExportStatus("idle");
                      }}
                      className={TOOLBAR_BUTTON}
                    >
                      {isEditing ? <CheckIcon /> : <PencilIcon />}
                      {isEditing ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExport()}
                      disabled={exportStatus === "loading"}
                      aria-busy={exportStatus === "loading"}
                      className={TOOLBAR_PRIMARY}
                    >
                      {exportStatus === "loading" ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <DownloadIcon />
                      )}
                      {exportStatus === "loading" ? "Preparing PDF…" : "Download PDF"}
                    </button>
                  </div>
                  <p
                    role={exportStatus === "error" ? "alert" : "status"}
                    aria-live="polite"
                    className={`min-h-4 text-[10px] ${
                      exportStatus === "error"
                        ? "text-rose-800"
                        : "text-muted"
                    }`}
                  >
                    {exportStatus === "loading"
                      ? "Preparing your PDF. Please wait for the download to start…"
                      : exportStatus === "success"
                        ? "PDF download started. Please wait for it to finish in your browser."
                        : exportStatus === "error"
                          ? "Export failed. Try again."
                          : ""}
                  </p>
                </div>
                </div>

                {statusCounts ? (
                  <ul className="mt-4 flex flex-wrap items-center gap-2">
                    {(
                      [
                        "confirmed",
                        "inferred",
                        "proposed",
                        "unresolved",
                      ] as const
                    ).map((status) => (
                      <li
                        key={status}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/70 px-2.5 py-1 text-[10.5px] font-medium text-muted"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[status].dot}`}
                        />
                        <span className="font-mono tabular-nums text-ink">
                          {statusCounts[status]}
                        </span>
                        <span>{STATUS_STYLES[status].label.toLowerCase()}</span>
                      </li>
                    ))}
                    <li className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/70 px-2.5 py-1 text-[10.5px] font-medium text-muted">
                      <span className="font-mono tabular-nums text-ink">
                        {findings?.length ?? 0}
                      </span>
                      <span>findings</span>
                    </li>
                  </ul>
                ) : null}
              </header>

              <StatusLegend />

              <div className="px-5 pb-2 sm:px-7 lg:px-9">
                <DocumentSection id="overview" title="Problem Statement">
                  {isEditing ? (
                    <textarea
                      value={editedScope.problemStatement}
                      onChange={(event) =>
                        updateProblemStatement(event.target.value)
                      }
                      rows={4}
                      aria-label="Problem statement"
                      className="block w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-[13.5px] leading-6 text-ink/90 outline-none transition-colors focus:border-accent/70 focus:ring-4 focus:ring-accent-soft"
                    />
                  ) : (
                    <p className="max-w-[68ch] text-[14.5px] leading-7 text-ink/85">
                      {editedScope.problemStatement}
                    </p>
                  )}
                </DocumentSection>

                <DocumentSection id="in-scope" title="In Scope">
                  {isEditing ? (
                    <ScopeItemEditor
                      items={editedScope.inScope}
                      label="In scope"
                      onChange={(index, text) =>
                        updateItem("inScope", index, text)
                      }
                    />
                  ) : (
                    <ScopeItemList
                      items={editedScope.inScope}
                      clarifications={editedScope.clarifications}
                    />
                  )}
                </DocumentSection>

                <DocumentSection id="out-of-scope" title="Out of Scope">
                  {isEditing ? (
                    <ScopeItemEditor
                      items={editedScope.outOfScope}
                      label="Out of scope"
                      onChange={(index, text) =>
                        updateItem("outOfScope", index, text)
                      }
                    />
                  ) : (
                    <ScopeItemList
                      items={editedScope.outOfScope}
                      clarifications={editedScope.clarifications}
                    />
                  )}
                </DocumentSection>

                <DocumentSection id="assumptions" title="Assumptions">
                  {isEditing ? (
                    <ScopeItemEditor
                      items={editedScope.assumptions}
                      label="Assumption"
                      onChange={(index, text) =>
                        updateItem("assumptions", index, text)
                      }
                    />
                  ) : (
                    <ScopeItemList
                      items={editedScope.assumptions}
                      clarifications={editedScope.clarifications}
                    />
                  )}
                </DocumentSection>

                <DocumentSection id="open-questions" title="Open Questions">
                  {isEditing ? (
                    <ScopeItemEditor
                      items={editedScope.openQuestions}
                      label="Open question"
                      onChange={(index, text) =>
                        updateItem("openQuestions", index, text)
                      }
                    />
                  ) : (
                    <ScopeItemList
                      items={editedScope.openQuestions}
                      clarifications={editedScope.clarifications}
                      activeQuestion={resolveTarget}
                      onResolveQuestion={(question) => {
                        setResolveTarget(question);
                        setResolveError(null);
                      }}
                      resolveForm={
                        resolveTarget ? (
                          <ResolveQuestionForm
                            key={resolveTarget}
                            question={resolveTarget}
                            isEdited={isEdited}
                            sourceChanged={Boolean(
                              analyzedInput && input.trim() !== analyzedInput,
                            )}
                            pending={isResolving}
                            error={resolveError}
                            onCancel={() => {
                              setResolveTarget(null);
                              setResolveError(null);
                            }}
                            onSubmit={(submission) => {
                              void handleResolve(submission);
                            }}
                          />
                        ) : null
                      }
                    />
                  )}
                </DocumentSection>

                <DocumentSection id="requirements" title="Requirements">
                  {isEditing ? (
                    <ScopeItemEditor
                      items={editedScope.requirements}
                      label="Requirement"
                      onChange={(index, text) =>
                        updateItem("requirements", index, text)
                      }
                    />
                  ) : (
                    <ScopeItemList
                      items={editedScope.requirements}
                      clarifications={editedScope.clarifications}
                    />
                  )}
                </DocumentSection>

                <DocumentSection id="acceptance-criteria" title="Acceptance Criteria">
                  {isEditing ? (
                    <ScopeItemEditor
                      items={editedScope.acceptanceCriteria}
                      label="Acceptance criterion"
                      onChange={(index, text) =>
                        updateItem("acceptanceCriteria", index, text)
                      }
                    />
                  ) : (
                    <ScopeItemList
                      items={editedScope.acceptanceCriteria}
                      clarifications={editedScope.clarifications}
                    />
                  )}
                </DocumentSection>
              </div>
            </article>

            <section
              id="risks"
              aria-labelledby="findings-heading"
              className="scroll-mt-32 rounded-2xl border border-line/70 bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl lg:scroll-mt-24 sm:p-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4 px-1">
                <div>
                  <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-brass">
                    02 / Scope Guard
                  </p>
                  <h2
                    id="findings-heading"
                    className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-forest"
                  >
                    Potential delivery risks
                  </h2>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-muted">
                    Issues to resolve before committing to the scope.
                  </p>
                  {isEdited ? (
                    <p className="mt-2 text-[11px] leading-5 text-amber-800">
                      Document edited after analysis — findings refer to the
                      analyzed version.
                    </p>
                  ) : null}
                </div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest/60">
                  <span className="font-mono tabular-nums">
                    {findings.length}
                  </span>{" "}
                  {findings.length === 1 ? "finding" : "findings"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {findings.length === 0 ? (
                  <div className="rounded-lg border border-line bg-surface px-5 py-8 text-center">
                    <p className="text-[13px] leading-6 text-muted">
                      No verifiable findings were returned by this review.
                    </p>
                  </div>
                ) : (
                  findings.map((finding, index) => (
                    <FindingCard
                      key={`${index}-${finding.type}-${finding.description.slice(0, 40)}`}
                      finding={finding}
                      index={index}
                      clarifications={editedScope.clarifications}
                    />
                  ))
                )}
              </div>
            </section>

            {editedScope.clarifications.length > 0 ? (
              <section
                id="clarifications"
                aria-labelledby="clarifications-heading"
                className="scroll-mt-32 rounded-2xl border border-line/70 bg-white/80 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl lg:scroll-mt-24 sm:p-6"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-accent">
                      03 / Client clarifications
                    </p>
                    <h2
                      id="clarifications-heading"
                      className="mt-2 font-serif text-[24px] leading-tight tracking-[-0.01em] text-forest"
                    >
                      Recorded clarifications
                    </h2>
                    <p className="mt-1.5 max-w-[60ch] text-[12.5px] leading-5 text-muted">
                      Client answers captured during review, kept separate from
                      the original transcript.
                    </p>
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
                    <span className="font-mono tabular-nums">
                      {editedScope.clarifications.length}
                    </span>{" "}
                    {editedScope.clarifications.length === 1
                      ? "entry"
                      : "entries"}
                  </p>
                </div>

                <div className="mt-4">
                  <ClarificationList
                    clarifications={editedScope.clarifications}
                  />
                </div>
              </section>
            ) : null}

            {comparison ? <ComparisonPanel comparison={comparison} /> : null}
          </div>
        )}
        </div>
        </div>
      </div>
      </div>
    </section>
  );
}
