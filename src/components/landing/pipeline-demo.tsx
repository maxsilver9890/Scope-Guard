"use client";

import { useEffect, useRef, useState } from "react";

import { LandingIcon } from "./icons";

type RunStatus = "idle" | "playing" | "paused" | "complete";
type PipelineStatus = "confirmed" | "inferred" | "proposed" | "unresolved";

const CLIENT_BRIEF =
  "We need a modern e-commerce website. Make checkout smoother, connect our inventory system, and launch before the sale.";

const STATUS_STYLES: Record<PipelineStatus, string> = {
  confirmed: "border-emerald-200 bg-mint text-emerald-800",
  inferred: "border-sky-200 bg-sky text-sky-800",
  proposed: "border-amber-200 bg-peach text-amber-800",
  unresolved: "border-slate-200 bg-slate-100 text-slate-600",
};

const STRUCTURED_ITEMS: Array<{
  text: string;
  status: PipelineStatus;
  evidence: string;
}> = [
  {
    text: "Product browsing",
    status: "confirmed",
    evidence: "Source supports an e-commerce catalogue.",
  },
  {
    text: "Inventory API feasibility",
    status: "inferred",
    evidence: "Integration requested; API availability unverified.",
  },
  {
    text: "Checkout improvement criteria",
    status: "proposed",
    evidence: "“Smoother” needs an observable definition.",
  },
  {
    text: "Analytics implementation",
    status: "proposed",
    evidence: "Not established in the brief.",
  },
  {
    text: "Sale campaign launch date",
    status: "unresolved",
    evidence: "“Before the sale” has no confirmed date.",
  },
];

function StatusPill({ status }: { status: PipelineStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.12em] ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="m5 3.4 7 4.6-7 4.6V3.4Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M3.4 8a4.6 4.6 0 1 0 1.5-3.4M3.4 3.7v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M4 3.5 10 8l-6 4.5v-9ZM12 3.5v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BriefNode({ variant }: { variant: "a" | "b" }) {
  return (
    <article className={`pipeline-node pipeline-enter ${variant}-brief`}>
      <div className="flex items-center justify-between gap-2">
        <span className="pipeline-kicker">
          <LandingIcon name="transcript" className="h-3 w-3" />
          Client brief
        </span>
        <span className="pipeline-file">brief.txt</span>
      </div>
      <p className="mt-3 font-display text-[16px] leading-[1.42] tracking-[-0.015em] text-navy">
        “{CLIENT_BRIEF}”
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="pipeline-chip">Same input</span>
        <span className="pipeline-chip pipeline-chip--warn">Ambiguity inside</span>
      </div>
    </article>
  );
}

const FRAGMENTS = [
  {
    title: "“Smoother checkout”",
    detail: "undefined success criteria",
    className: "fragment-a-1",
  },
  {
    title: "“Before the sale”",
    detail: "launch date unconfirmed",
    className: "fragment-a-2",
  },
  {
    title: "“Inventory integration”",
    detail: "API feasibility unknown",
    className: "fragment-a-3",
  },
  {
    title: "“Analytics”",
    detail: "requirements not established",
    className: "fragment-a-4",
  },
];

function AmbiguousNode() {
  return (
    <article className="pipeline-node pipeline-enter a-ambiguous">
      <div className="flex items-center justify-between gap-2">
        <span className="pipeline-kicker pipeline-kicker--warn">
          <LandingIcon name="alert" className="h-3 w-3" />
          Ambiguous requirements
        </span>
        <span className="pipeline-count">4 fragments</span>
      </div>
      <div className="relative mt-3 h-auto space-y-1.5 lg:h-[238px] lg:space-y-0" aria-hidden="true">
        {FRAGMENTS.map((fragment) => (
          <div
            key={fragment.title}
            className={`pipeline-fragment ${fragment.className}`}
          >
            <p className="text-[9px] font-semibold leading-4 text-navy/85">
              {fragment.title}
            </p>
            <p className="mt-0.5 text-[7.5px] leading-3.5 text-[#9a5635]">
              {fragment.detail}
            </p>
          </div>
        ))}
        <span className="fragment-warning fragment-warning-1">!</span>
        <span className="fragment-warning fragment-warning-2">!</span>
      </div>
    </article>
  );
}

function AssumptionRow({ children }: { children: string }) {
  return (
    <div className="pipeline-assumption">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-peach text-[#9a5635]">
        <LandingIcon name="alert" className="h-2.5 w-2.5" />
      </span>
      <span>{children}</span>
    </div>
  );
}

function AssumptionsNode() {
  return (
    <article className="pipeline-node pipeline-enter a-assumptions">
      <span className="pipeline-kicker pipeline-kicker--warn">
        <LandingIcon name="layers" className="h-3 w-3" />
        Implementation assumptions
      </span>
      <div className="mt-3 space-y-1.5" aria-hidden="true">
        <AssumptionRow>Inventory API assumed available</AssumptionRow>
        <AssumptionRow>“Smoother” treated as UI polish</AssumptionRow>
        <AssumptionRow>Sale date treated as fixed</AssumptionRow>
        <AssumptionRow>Analytics scope left undefined</AssumptionRow>
      </div>
      <div className="mt-3 rounded-xl border border-[#ecc5ad] bg-[#fff8f3] p-2.5">
        <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-[#9a5635]">
          Decisions made by default
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {["API exists", "Date fixed", "Scope enough"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#ecc5ad] bg-white/70 px-1.5 py-0.5 text-[6.5px] font-semibold uppercase tracking-[0.08em] text-[#8a4b2d]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function BrokenStore() {
  return (
    <div
      className="mini-store mini-store--broken mt-3"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between border-b border-navy/8 px-2 py-1.5">
        <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-navy/70">
          UrbanNest
        </span>
        <span className="h-1.5 w-9 rounded-full bg-navy/10" />
      </div>
      <div className="grid grid-cols-3 gap-1 p-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded-md border border-navy/8"
          >
            <div className="h-10 bg-gradient-to-br from-peach/80 to-lav/60" />
            <div className="space-y-1 p-1">
              <div className="h-1 w-4/5 rounded-full bg-navy/12" />
              <div className="h-1 w-1/2 rounded-full bg-navy/8" />
            </div>
            {index === 1 ? (
              <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#f8ddcf] text-[6px] font-bold text-[#9a5635]">
                !
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <span className="rounded bg-navy/8 px-2 py-1 text-[6px] uppercase tracking-[0.1em] text-navy/35">
          Checkout
        </span>
        <span className="text-[6px] text-[#9a5635]">Missing state</span>
      </div>
    </div>
  );
}

function OutcomeNode({ broken }: { broken: boolean }) {
  return (
    <article
      className={`pipeline-node pipeline-enter ${broken ? "a-outcome" : "b-outcome"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="pipeline-kicker">
          <LandingIcon name={broken ? "alert" : "document"} className="h-3 w-3" />
          Product outcome
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] ${
            broken
              ? "bg-[#f8ddcf] text-[#9a5635]"
              : "bg-mint text-emerald-700"
          }`}
        >
          {broken ? "Inconsistent" : "Review-ready"}
        </span>
      </div>
      {broken ? (
        <BrokenStore />
      ) : (
        <PolishedStore />
      )}
    </article>
  );
}

function PolishedStore() {
  return (
    <div className="mini-store mini-store--polished mt-3" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-navy/8 px-2 py-1.5">
        <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-brand">
          UrbanNest
        </span>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-5 rounded-full bg-navy/10" />
          <span className="h-1.5 w-5 rounded-full bg-navy/10" />
          <span className="h-2 w-2 rounded-full bg-brand" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 p-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-md border border-navy/8">
            <div
              className={`h-10 ${
                index === 0
                  ? "bg-gradient-to-br from-lav to-sky"
                  : index === 1
                    ? "bg-gradient-to-br from-mint to-sky"
                    : "bg-gradient-to-br from-peach to-lav"
              }`}
            />
            <div className="space-y-1 p-1">
              <div className="h-1 w-4/5 rounded-full bg-navy/12" />
              <div className="h-1 w-1/2 rounded-full bg-navy/8" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <span className="rounded bg-brand px-2 py-1 text-[6px] font-semibold text-white">
          Checkout
        </span>
        <span className="text-[6px] text-emerald-700">Ready</span>
      </div>
    </div>
  );
}

function ScopeGuardNode() {
  return (
    <article className="pipeline-node pipeline-guard pipeline-enter b-guard">
      <div className="pipeline-guard-glow" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_20px_-8px_rgba(112,87,245,0.8)]">
            <LandingIcon name="shield" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-brand">
              Scope Guard
            </p>
            <p className="text-[6.5px] font-semibold uppercase tracking-[0.14em] text-brand/55">
              Structure + verify
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-semibold leading-5 text-navy">
          Evidence checked before uncertainty becomes a commitment.
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {["Source quotes", "Status-aware", "Open questions"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-brand/15 bg-white/75 px-1.5 py-0.5 text-[6.5px] font-semibold uppercase tracking-[0.08em] text-brand"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[7.5px] leading-3.5 text-slatebody">
          Ambiguity is preserved for review — not silently resolved.
        </p>
      </div>
    </article>
  );
}

function StructuredScopeNode() {
  return (
    <article className="pipeline-node pipeline-enter b-scope">
      <div className="flex items-center justify-between gap-2">
        <span className="pipeline-kicker">
          <LandingIcon name="layers" className="h-3 w-3" />
          Structured scope
        </span>
        <span className="pipeline-file">status-labelled</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {STRUCTURED_ITEMS.map((item, index) => (
          <div
            key={item.text}
            className="pipeline-scope-item"
            style={{ animationDelay: `${8.9 + index * 0.22}s` }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[8.5px] font-semibold leading-3.5 text-navy">
                {item.text}
              </p>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-1 flex items-start gap-1 text-[6.5px] leading-3 text-slatebody">
              <LandingIcon name="link" className="mt-0.5 h-2.5 w-2.5 shrink-0 text-brand" />
              {item.evidence}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function CrossMark({ good }: { good: boolean }) {
  return (
    <span
      className={`pipeline-result-icon ${
        good ? "pipeline-result-icon--good" : "pipeline-result-icon--bad"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        {good ? (
          <path
            className="pipeline-draw"
            d="m5 12.5 4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path
              className="pipeline-draw"
              d="m7 7 10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              className="pipeline-draw pipeline-draw--late"
              d="m17 7-10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </span>
  );
}

function PipelineResult({
  good,
  title,
  copy,
}: {
  good: boolean;
  title: string;
  copy: string;
}) {
  return (
    <div
      className={`pipeline-result ${good ? "b-result" : "a-result"}`}
    >
      <CrossMark good={good} />
      <div>
        <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-navy">
          {title}
        </h4>
        <p className="mt-1 text-[10px] leading-5 text-slatebody">{copy}</p>
      </div>
    </div>
  );
}

function PathParticlesA() {
  return (
    <>
      <svg
        className="pipeline-paths pipeline-paths--desktop"
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ParticlesA />
      </svg>
      <svg
        className="pipeline-paths pipeline-paths--mobile"
        viewBox="0 0 80 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ParticlesAMobile />
      </svg>
    </>
  );
}

function ParticlesA() {
  return (
    <>
      <circle className="pipeline-particle pipeline-particle--peach" r="4">
        <animateMotion
          dur="2.7s"
          begin="2.1s"
          repeatCount="indefinite"
          path="M 150 160 C 230 70, 370 250, 450 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--lav" r="2.8">
        <animateMotion
          dur="3.1s"
          begin="2.8s"
          repeatCount="indefinite"
          path="M 150 160 C 240 250, 350 60, 450 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--sky" r="3.5">
        <animateMotion
          dur="3s"
          begin="3.2s"
          repeatCount="indefinite"
          path="M 450 160 C 540 70, 660 250, 750 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--peach" r="2.5">
        <animateMotion
          dur="2.8s"
          begin="3.8s"
          repeatCount="indefinite"
          path="M 450 160 C 550 260, 650 60, 750 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--lav" r="3.8">
        <animateMotion
          dur="2.9s"
          begin="4.2s"
          repeatCount="indefinite"
          path="M 750 160 C 850 80, 970 250, 1050 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--sky" r="2.2">
        <animateMotion
          dur="3.3s"
          begin="4.7s"
          repeatCount="indefinite"
          path="M 750 160 C 860 240, 960 70, 1050 160"
        />
      </circle>
    </>
  );
}

function ParticlesAMobile() {
  return (
    <>
      <circle className="pipeline-particle pipeline-particle--peach" r="3.5">
        <animateMotion
          dur="3.4s"
          begin="1.8s"
          repeatCount="indefinite"
          path="M 24 20 C 62 170, -10 300, 24 430 C 60 560, -10 700, 24 860"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--lav" r="2.5">
        <animateMotion
          dur="3.9s"
          begin="2.4s"
          repeatCount="indefinite"
          path="M 24 20 C 62 170, -10 300, 24 430 C 60 560, -10 700, 24 860"
        />
      </circle>
    </>
  );
}

function PathParticlesB() {
  return (
    <>
      <svg
        className="pipeline-paths pipeline-paths--desktop"
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ParticlesB />
      </svg>
      <svg
        className="pipeline-paths pipeline-paths--mobile"
        viewBox="0 0 80 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ParticlesBMobile />
      </svg>
    </>
  );
}

function ParticlesB() {
  return (
    <>
      <circle className="pipeline-particle pipeline-particle--lav" r="4">
        <animateMotion
          dur="3s"
          begin="8.7s"
          repeatCount="indefinite"
          path="M 150 160 C 220 100, 360 210, 440 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--mint" r="3">
        <animateMotion
          dur="3.2s"
          begin="9.1s"
          repeatCount="indefinite"
          path="M 440 160 C 510 110, 630 210, 700 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--sky" r="3.5">
        <animateMotion
          dur="3.1s"
          begin="9.5s"
          repeatCount="indefinite"
          path="M 700 160 C 790 100, 930 220, 1040 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--brand" r="2.5">
        <animateMotion
          dur="3.4s"
          begin="10.1s"
          repeatCount="indefinite"
          path="M 150 160 C 220 100, 360 210, 440 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--mint" r="2.4">
        <animateMotion
          dur="3.2s"
          begin="10.6s"
          repeatCount="indefinite"
          path="M 440 160 C 510 110, 630 210, 700 160"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--lav" r="3.2">
        <animateMotion
          dur="3.1s"
          begin="11.1s"
          repeatCount="indefinite"
          path="M 700 160 C 790 100, 930 220, 1040 160"
        />
      </circle>
    </>
  );
}

function ParticlesBMobile() {
  return (
    <>
      <circle className="pipeline-particle pipeline-particle--lav" r="3.5">
        <animateMotion
          dur="3.8s"
          begin="8.6s"
          repeatCount="indefinite"
          path="M 24 20 C 62 170, -10 300, 24 430 C 60 560, -10 700, 24 860"
        />
      </circle>
      <circle className="pipeline-particle pipeline-particle--mint" r="2.5">
        <animateMotion
          dur="4.1s"
          begin="9.3s"
          repeatCount="indefinite"
          path="M 24 20 C 62 170, -10 300, 24 430 C 60 560, -10 700, 24 860"
        />
      </circle>
    </>
  );
}

export function PipelineDemo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const lastRunRef = useRef(-1);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [runId, setRunId] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      startedRef.current = true;
      setStatus("complete");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => {
        startedRef.current = true;
        setStatus("playing");
        setInView(true);
      });
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        setInView(visible);
        if (
          visible &&
          !startedRef.current &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          startedRef.current = true;
          setStatus("playing");
        }
      },
      { rootMargin: "18% 0px 18% 0px", threshold: 0.04 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = runnerRef.current;
    if (!root) {
      return;
    }

    const svgs = Array.from(
      root.querySelectorAll<SVGSVGElement>("svg.pipeline-paths"),
    );

    if (status === "complete") {
      for (const svg of svgs) {
        try {
          svg.setCurrentTime(20);
        } catch {
          // SVG timing is best-effort in this decorative layer.
        }
        svg.pauseAnimations();
      }
      return;
    }

    if (status === "playing" && lastRunRef.current !== runId) {
      lastRunRef.current = runId;
      for (const svg of svgs) {
        try {
          svg.setCurrentTime(0);
        } catch {
          // Ignore unsupported SVG timing APIs.
        }
      }
    }

    if (status !== "playing" || !inView) {
      for (const svg of svgs) {
        svg.pauseAnimations();
      }
      return;
    }

    for (const svg of svgs) {
      svg.unpauseAnimations();
    }
  }, [inView, runId, status]);

  const replay = () => {
    startedRef.current = true;
    setRunId((value) => value + 1);
    setStatus("playing");
  };

  const togglePause = () => {
    setStatus((current) => {
      if (current === "playing") return "paused";
      if (current === "paused") return "playing";
      return current;
    });
  };

  const skip = () => {
    startedRef.current = true;
    setStatus("complete");
  };

  const runnerClass =
    status === "paused"
      ? "is-animating is-paused"
      : status === "playing"
        ? "is-animating"
        : status === "complete"
          ? "is-complete"
          : "is-idle";

  return (
    <div ref={sectionRef} className="mt-10">
      <div className="flex flex-col gap-4 rounded-2xl border border-navy/8 bg-white/60 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/15 bg-lav text-brand">
            <LandingIcon name="compare" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand">
              Interactive comparison
            </p>
            <p className="mt-0.5 text-[10.5px] text-slatebody">
              A 16-second walkthrough. Replay it or skip to the result.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={replay}
            className="pipeline-control"
            aria-label="Replay the pipeline comparison"
          >
            <ReplayIcon />
            Replay
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="pipeline-control"
            aria-label={status === "paused" ? "Resume the pipeline animation" : "Pause the pipeline animation"}
            disabled={status === "idle" || status === "complete"}
          >
            {status === "paused" ? <PlayIcon /> : <PauseIcon />}
            {status === "paused" ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={skip}
            className="pipeline-control pipeline-control--primary"
            aria-label="Skip to the final comparison"
            disabled={status === "complete"}
          >
            <SkipIcon />
            Skip to result
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status === "complete"
          ? "Final comparison shown."
          : status === "paused"
            ? "Comparison paused."
            : status === "playing"
              ? "Comparison playing."
              : "Comparison ready."}
      </p>

      <div
        key={runId}
        ref={runnerRef}
        className={`pipeline-runner ${runnerClass} ${inView ? "" : "is-offscreen"}`}
      >
        <div className="pipeline-panel pipeline-panel--bad mt-5">
          <div className="pipeline-panel-head">
            <div className="flex items-center gap-2">
              <span className="pipeline-led pipeline-led--bad" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a5635]">
                Without Scope Guard
              </h3>
            </div>
            <span className="pipeline-result-tag pipeline-result-tag--bad">
              Ambiguity carried forward
            </span>
          </div>

          <div className="pipeline-flow">
            <PathParticlesA />
            <div className="pipeline-grid pipeline-grid--a">
              <BriefNode variant="a" />
              <AmbiguousNode />
              <AssumptionsNode />
              <OutcomeNode broken />
            </div>
          </div>

          <PipelineResult
            good={false}
            title="Built something. Not necessarily the right thing."
            copy="Unresolved questions became assumptions. Assumptions became implementation decisions."
          />
        </div>

        <div className="pipeline-divider" aria-hidden="true">
          <span className="pipeline-divider-line" />
          <span className="pipeline-divider-label">
            Same brief · different process
          </span>
          <span className="pipeline-divider-line" />
        </div>

        <div className="pipeline-panel pipeline-panel--good mt-5">
          <div className="pipeline-panel-head">
            <div className="flex items-center gap-2">
              <span className="pipeline-led pipeline-led--good" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                With Scope Guard
              </h3>
            </div>
            <span className="pipeline-result-tag pipeline-result-tag--good">
              Ambiguity made visible
            </span>
          </div>

          <div className="pipeline-flow">
            <PathParticlesB />
            <div className="pipeline-grid pipeline-grid--b">
              <BriefNode variant="b" />
              <ScopeGuardNode />
              <StructuredScopeNode />
              <OutcomeNode broken={false} />
            </div>
          </div>

          <PipelineResult
            good
            title="Build with clarity. Not guesswork."
            copy="Better-defined requirements give teams a stronger foundation for building the right product."
          />
        </div>

        <span
          className="pipeline-clock"
          aria-hidden="true"
          onAnimationEnd={() =>
            setStatus((current) => (current === "playing" ? "complete" : current))
          }
        />
      </div>
    </div>
  );
}
