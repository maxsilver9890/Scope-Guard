import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark";
import { LandingIcon, type LandingIconName } from "./icons";
import { LandingNav } from "./landing-nav";
import {
  HeroAura,
  KineticHeadline,
  ScrollProgress,
  SplitText,
  TiltCard,
} from "./motion";
import { PipelineDemo } from "./pipeline-demo";
import { Reveal } from "./reveal";

const GITHUB_URL = "https://github.com/maxsilver9890/Scope-Guard";

type StatusKind = "confirmed" | "inferred" | "proposed" | "unresolved";

const STATUS_STYLES: Record<StatusKind, string> = {
  confirmed: "border-emerald-200 bg-mint text-emerald-800",
  inferred: "border-sky-200 bg-sky text-sky-800",
  proposed: "border-amber-200 bg-peach text-amber-800",
  unresolved: "border-slate-200 bg-slate-100 text-slate-600",
};

const STATUS_DETAILS: Array<{
  status: StatusKind;
  description: string;
}> = [
  {
    status: "confirmed",
    description: "Supported as a commitment by the available evidence.",
  },
  {
    status: "inferred",
    description: "A reasonable interpretation, never an explicit agreement.",
  },
  {
    status: "proposed",
    description: "An idea or option that has not been approved yet.",
  },
  {
    status: "unresolved",
    description: "A decision that still needs a client answer.",
  },
];

function StatusBadge({
  status,
  className = "",
}: {
  status: StatusKind;
  className?: string;
}) {
  return (
    <span
      className={`landing-badge-pop inline-flex items-center rounded-full border px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.14em] ${STATUS_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}

function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`${className} transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none`}
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

function SectionLabel({
  number,
  children,
  tone = "brand",
}: {
  number: string;
  children: ReactNode;
  tone?: "brand" | "navy";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`font-mono text-[10px] font-semibold tracking-[0.16em] ${
          tone === "brand" ? "text-brand" : "text-navy/55"
        }`}
      >
        {number}
      </span>
      <span
        className={`h-px w-7 ${
          tone === "brand" ? "bg-brand/45" : "bg-navy/20"
        }`}
        aria-hidden="true"
      />
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.26em] ${
          tone === "brand" ? "text-brand" : "text-navy/60"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function SectionIntro({
  number,
  eyebrow,
  title,
  description,
  align = "left",
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : ""}>
      <div
        className={
          align === "center"
            ? "flex justify-center"
            : "flex justify-start"
        }
      >
        <SectionLabel number={number}>{eyebrow}</SectionLabel>
      </div>
      <SplitText
        as="h2"
        text={title}
        className="mt-5 max-w-[19ch] font-display text-[clamp(2.2rem,4.4vw,3.9rem)] font-normal leading-[1.02] tracking-[-0.035em] text-navy"
      />
      <p
        className={`mt-5 max-w-[58ch] text-[15px] leading-7 text-slatebody sm:text-[16px] ${
          align === "center" ? "mx-auto" : ""
        }`}
      >
        {description}
      </p>
    </div>
  );
}

function PrimaryCta({
  href,
  children,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = `group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-[12.5px] font-semibold text-white shadow-[0_16px_35px_-18px_rgba(112,87,245,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-[0_20px_40px_-18px_rgba(112,87,245,0.95)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transform-none ${className}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
        <ArrowRight />
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
      <ArrowRight />
    </Link>
  );
}

function SecondaryCta({
  href,
  children,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = `group inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-navy/10 bg-white/75 px-6 py-3.5 text-[12.5px] font-semibold text-navy shadow-[0_1px_2px_rgba(23,32,51,0.04)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-navy/20 hover:bg-white active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transform-none ${className}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function SourceCard() {
  return (
    <div className="landing-float relative z-20 rounded-[1.6rem] border border-navy/10 bg-white/95 p-4 shadow-[0_28px_60px_-34px_rgba(23,32,51,0.45)] backdrop-blur-sm lg:absolute lg:left-0 lg:top-1 lg:w-[59%]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-slatebody">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f06b4f]" />
          Source input
        </span>
        <span className="font-mono text-[8.5px] text-slatebody/70">
          discovery-call.txt
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-navy/8 bg-cream/80 p-3">
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slatebody/70">
          Client said
        </p>
        <p className="mt-1.5 font-display text-[18px] leading-[1.28] tracking-[-0.015em] text-navy">
          “We should{" "}
          <span className="landing-glitch-word inline-block rounded-md bg-peach/80 px-1 py-0.5 text-[#8a4b2d]">
            probably
          </span>{" "}
          launch before the sale.”
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-navy/8 bg-white px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slatebody">
          Verbatim source
        </span>
        <span className="rounded-full border border-[#ecc5ad] bg-peach/60 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8a4b2d]">
          Ambiguous timing
        </span>
      </div>
    </div>
  );
}

function CommitmentCard() {
  return (
    <div className="landing-float-delayed relative z-30 rounded-[1.6rem] border border-brand/25 bg-white p-4 shadow-[0_32px_70px_-34px_rgba(112,87,245,0.55)] lg:absolute lg:right-0 lg:top-[8.4rem] lg:w-[57%]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-brand">
          Scope commitment
        </span>
        <StatusBadge status="unresolved" />
      </div>
      <p className="mt-3 text-[8px] font-semibold uppercase tracking-[0.15em] text-slatebody/70">
        Launch date
      </p>
      <p className="mt-1 text-[16px] font-semibold leading-6 text-navy">
        Launch timing remains an open decision.
      </p>
      <p className="mt-2 text-[11.5px] leading-5 text-slatebody">
        The campaign date has not been finalized, so the scope cannot treat it
        as a delivery commitment yet.
      </p>
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand/10 bg-lav/45 p-2.5">
        <LandingIcon name="link" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        <p className="text-[9.5px] leading-4 text-navy/70">
          <span className="font-semibold text-navy">Source evidence</span> · “before
          the sale” is referenced, but no final date is agreed.
        </p>
      </div>
    </div>
  );
}

function ReviewCard() {
  return (
    <div className="landing-float-slow relative z-40 rounded-[1.6rem] border border-[#e7b39d] bg-[#fffaf6] p-4 shadow-[0_30px_70px_-36px_rgba(138,75,45,0.45)] lg:absolute lg:bottom-0 lg:left-[8%] lg:w-[62%]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#9a5635]">
          Scope review
        </span>
        <span className="rounded-full bg-[#f8ddcf] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#8a4b2d]">
          1 open question
        </span>
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#ecc5ad] bg-peach/80 text-[#9a5635]">
          <LandingIcon name="alert" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-navy">
            Missing decision detected
          </p>
          <p className="mt-1 text-[10.5px] leading-[1.55] text-slatebody">
            The launch date needs client clarification before it becomes a
            delivery commitment.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-navy/8 bg-white/80 px-3 py-2">
        <span className="text-[9.5px] font-semibold text-navy">Review question</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-[8.5px] font-semibold text-white">
          Open
          <LandingIcon name="arrow-right" className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:h-[560px]">
      <div
        className="absolute left-[8%] top-[6%] h-56 w-56 rounded-full bg-lav blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[4%] right-[2%] h-52 w-52 rounded-full bg-peach/80 blur-3xl"
        aria-hidden="true"
      />
      <div className="space-y-4 lg:contents">
        <SourceCard />
        <CommitmentCard />
        <ReviewCard />
      </div>
      <svg
        viewBox="0 0 600 560"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      >
        <path
          d="M220 128c72 2 60 60 144 74"
          stroke="#7057F5"
          strokeOpacity="0.32"
          strokeWidth="1.4"
          strokeDasharray="5 8"
          className="landing-dash"
        />
        <path
          d="M426 300c-42 30-104 24-146 66"
          stroke="#7057F5"
          strokeOpacity="0.26"
          strokeWidth="1.4"
          strokeDasharray="5 8"
          className="landing-dash"
        />
        <circle cx="366" cy="204" r="4" fill="#7057F5" fillOpacity="0.65" />
        <circle cx="274" cy="368" r="3.5" fill="#7057F5" fillOpacity="0.5" />
      </svg>
      <div className="absolute right-0 top-0 hidden rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-700 shadow-sm xl:inline-flex">
        Evidence linked
      </div>
      <div className="absolute bottom-[30%] left-0 hidden rounded-full border border-brand/15 bg-white px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-brand shadow-sm xl:inline-flex">
        Human review required
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden border-b border-navy/8"
    >
      <div
        className="absolute inset-0 -z-20 bg-[radial-gradient(900px_500px_at_18%_-8%,rgba(233,229,255,0.9),transparent_62%),radial-gradient(780px_480px_at_96%_14%,rgba(255,230,213,0.7),transparent_58%),linear-gradient(180deg,#fafaf7_0%,#fafaf7_74%,#f5f4ff_100%)]"
        aria-hidden="true"
      />
      <div className="landing-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="scroll-drift absolute -left-24 top-10 -z-10 h-80 w-80 rounded-full bg-lav/80 blur-3xl"
        aria-hidden="true"
      />
      <HeroAura />
      <div className="relative z-10 mx-auto w-full max-w-[1220px] px-5 pb-20 pt-14 sm:px-8 sm:pt-16 lg:pb-28 lg:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-10">
          <Reveal variant="blur">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/75 px-3 py-1.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] backdrop-blur-sm">
              <span className="landing-pulse h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand">
                AI-powered project scoping
              </span>
            </div>

            <KineticHeadline
              before={["Your", "project", "scope", "shouldn’t", "be", "a"]}
              phrase="guessing game."
              className="mt-6 max-w-[12ch] font-display text-[clamp(2.85rem,6.5vw,5.35rem)] font-normal leading-[0.96] tracking-[-0.05em] text-navy"
            />

            <p className="mt-7 max-w-[56ch] text-[15.5px] leading-7 text-slatebody sm:text-[16.5px] sm:leading-8">
              Turn discovery conversations into structured project scopes.
              Catch unsupported assumptions, conflicting requirements, and
              unanswered questions before they become expensive rework.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <PrimaryCta href="/workspace">Try Scope Guard</PrimaryCta>
              <SecondaryCta href="#how-it-works">
                Explore the workflow
                <LandingIcon name="arrow-down" className="h-3.5 w-3.5" />
              </SecondaryCta>
            </div>

            <div className="mt-7 flex items-center gap-3 text-[10.5px] text-slatebody">
              <span className="h-px w-7 bg-navy/20" aria-hidden="true" />
              From discovery transcript to evidence-backed scope.
            </div>

            <div className="mt-9 grid gap-2.5 border-t border-navy/10 pt-6 sm:grid-cols-3 sm:gap-4">
              {[
                "Grounded in the source",
                "Uncertainty stays visible",
                "Built for human review",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-[10px] font-medium text-navy/65"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-mint text-emerald-700">
                    <LandingIcon name="check" className="h-2.5 w-2.5" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:pl-2">
            <HeroVisual />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Problem                                                                    */
/* -------------------------------------------------------------------------- */

type ProblemCardData = {
  icon: LandingIconName;
  index: string;
  title: string;
  example: ReactNode;
  questions: string[];
  indicator: string;
  tone: string;
  iconTone: string;
  span: string;
  delay: number;
  variant: "left" | "right" | "scale" | "up";
};

const PROBLEM_CARDS: ProblemCardData[] = [
  {
    icon: "question",
    index: "01",
    title: "Vague requirements",
    example: (
      <>
        “Make the checkout experience{" "}
        <span className="landing-glitch-word inline-block">smoother</span>.”
      </>
    ),
    questions: [
      "What does “smoother” mean?",
      "Which checkout problems matter most?",
      "How will success be evaluated?",
    ],
    indicator: "Unclear boundary",
    tone: "border-navy/8 bg-white",
    iconTone: "bg-lav text-brand",
    span: "lg:col-span-7",
    delay: 0,
    variant: "left",
  },
  {
    icon: "assumption",
    index: "02",
    title: "Hidden assumptions",
    example: "“The existing inventory system should integrate easily.”",
    questions: [
      "Is an API available?",
      "What data can be synchronized?",
      "Has technical feasibility been verified?",
    ],
    indicator: "Unverified dependency",
    tone: "border-brand/10 bg-lav/60",
    iconTone: "bg-white text-brand",
    span: "lg:col-span-5",
    delay: 80,
    variant: "right",
  },
  {
    icon: "conflict",
    index: "03",
    title: "Conflicting expectations",
    example: "“The launch date is fixed, but the campaign date is undecided.”",
    questions: [
      "Which date determines the deadline?",
      "Who confirms the final schedule?",
    ],
    indicator: "Conflicting signals",
    tone: "border-sky-200/70 bg-sky/65",
    iconTone: "bg-white text-sky-700",
    span: "lg:col-span-5",
    delay: 120,
    variant: "scale",
  },
  {
    icon: "status",
    index: "04",
    title: "Decisions nobody owns",
    example: "“We’ll figure out the payment provider later.”",
    questions: [
      "Who selects the provider?",
      "Which payment methods are required?",
      "What needs approval before implementation?",
    ],
    indicator: "Unowned decision",
    tone: "border-emerald-200/70 bg-mint/60",
    iconTone: "bg-white text-emerald-700",
    span: "lg:col-span-7",
    delay: 160,
    variant: "right",
  },
];

function ProblemCard({ card }: { card: ProblemCardData }) {
  return (
    <Reveal delay={card.delay} variant={card.variant} className={card.span}>
      <article
        className={`group h-full rounded-[1.75rem] border p-5 shadow-[0_18px_50px_-38px_rgba(23,32,51,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-36px_rgba(23,32,51,0.4)] motion-reduce:transform-none sm:p-6 ${card.tone}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 ${card.iconTone}`}
          >
            <LandingIcon name={card.icon} className="h-5 w-5" />
          </span>
          <span className="font-mono text-[9px] font-semibold tracking-[0.12em] text-navy/35">
            {card.index}
          </span>
        </div>
        <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em] text-navy">
          {card.title}
        </h3>
        <p className="mt-2 rounded-xl border border-navy/8 bg-white/55 px-3 py-2.5 font-display text-[15px] leading-6 text-navy/85">
          {card.example}
        </p>
        <div className="mt-4">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-navy/45">
            What remains unclear?
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {card.questions.map((question) => (
              <li
                key={question}
                className="flex items-start gap-2 text-[11px] leading-5 text-slatebody"
              >
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand/70"
                  aria-hidden="true"
                />
                {question}
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-warning mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#ecc5ad] bg-white/70 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.13em] text-[#8a4b2d]">
          <LandingIcon name="alert" className="h-3 w-3" />
          {card.indicator}
        </div>
      </article>
    </Reveal>
  );
}

function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative scroll-mt-24 overflow-hidden border-b border-[#ebd7c8] bg-[linear-gradient(180deg,#fafaf7_0%,#fff4ec_18%,#ffe8d9_100%)] py-20 sm:py-24 lg:py-28"
    >
      <div
        className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-white/50 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] lg:items-end">
            <SectionIntro
              number="01"
              eyebrow="The problem"
              title="Small ambiguities become expensive surprises."
              description="Projects rarely go off track because of one dramatic decision. More often, the trouble starts with assumptions, vague requests, and unanswered questions that quietly become commitments."
            />
            <div className="rounded-2xl border border-[#ebd7c8] bg-white/55 p-4 backdrop-blur-sm">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#9a5635]">
                The hidden cost
              </p>
              <p className="mt-2 text-[12px] leading-5 text-navy/70">
                Every vague phrase that survives discovery becomes a
                conversation during delivery — or a change request.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {PROBLEM_CARDS.map((card) => (
            <ProblemCard key={card.title} card={card} />
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-3 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e7c7b4] bg-white/70 text-[#9a5635]">
              <LandingIcon name="arrow-down" className="h-4 w-4" />
            </span>
            <p className="font-display text-[22px] leading-8 tracking-[-0.02em] text-navy sm:text-[26px]">
              If the scope is unclear, the team inherits the uncertainty.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Solution                                                                   */
/* -------------------------------------------------------------------------- */

function StatusLegend() {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {STATUS_DETAILS.map((entry, index) => (
        <Reveal key={entry.status} delay={index * 60}>
          <div className="h-full rounded-2xl border border-navy/8 bg-white/75 p-4">
            <StatusBadge status={entry.status} />
            <p className="mt-2.5 text-[11px] leading-5 text-slatebody">
              {entry.description}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function SolutionSection() {
  return (
    <section
      id="solution"
      className="relative scroll-mt-24 overflow-hidden bg-[linear-gradient(180deg,#f5f4ff_0%,#ffffff_42%,#fbfaff_100%)] py-20 sm:py-24 lg:py-28"
    >
      <div
        className="scroll-drift absolute right-[-8%] top-14 h-80 w-80 rounded-full bg-lav/80 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <SectionIntro
            number="02"
            eyebrow="The solution"
            title="Turn conversations into commitments you can inspect."
            description="Scope Guard structures the brief, checks the generated scope against the original source, and surfaces the decisions that still need clarification."
          />
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-10 rounded-[2rem] border border-navy/10 bg-white/80 p-3 shadow-[0_30px_80px_-50px_rgba(23,32,51,0.5)] backdrop-blur-sm sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.1fr)] lg:items-center">
              <div className="solution-from-left rounded-[1.4rem] border border-navy/8 bg-cream/80 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-slatebody">
                    <LandingIcon name="transcript" className="h-3.5 w-3.5" />
                    Messy brief
                  </span>
                  <span className="font-mono text-[8.5px] text-slatebody/60">
                    source.txt
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    "“We want the site to feel more premium.”",
                    "“Launch before the sale, probably in Q3.”",
                    "“Payments? We’ll sort that out later.”",
                    "“It should connect to the stock system.”",
                  ].map((line, index) => (
                    <p
                      key={line}
                      className={`rounded-lg px-3 py-2 text-[10.5px] leading-5 ${
                        index === 1
                          ? "border border-[#ecc5ad] bg-peach/55 text-[#7c4a31]"
                          : "border border-navy/6 bg-white/65 text-slatebody"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-slatebody">
                    Ambiguous
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-slatebody">
                    Undecided
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-slatebody">
                    Unverified
                  </span>
                </div>
              </div>

              <div className="solution-pop flex flex-col items-center gap-2 py-1">
                <span className="hidden h-12 w-px border-l border-dashed border-brand/35 lg:block" />
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/20 bg-white text-brand lg:hidden">
                  <LandingIcon name="arrow-down" className="h-4 w-4" />
                </span>
                <div className="rounded-2xl border border-brand/20 bg-brand px-4 py-3 text-center text-white shadow-[0_14px_30px_-18px_rgba(112,87,245,0.9)]">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/75">
                    Two passes
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold tracking-[0.04em]">
                    STRUCTURE + VERIFY
                  </p>
                </div>
                <span className="hidden h-12 w-px border-l border-dashed border-brand/35 lg:block" />
                <span className="hidden text-brand lg:block">
                  <LandingIcon name="arrow-right" className="h-4 w-4" />
                </span>
              </div>

              <div className="solution-from-right rounded-[1.4rem] border border-navy/8 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-brand">
                    <LandingIcon name="layers" className="h-3.5 w-3.5" />
                    Reviewable scope
                  </span>
                  <span className="landing-flicker rounded-full bg-mint px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    Evidence attached
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-navy/8 bg-cream/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10.5px] font-semibold text-navy">
                        Launch timing
                      </p>
                      <StatusBadge status="unresolved" />
                    </div>
                    <p className="mt-1.5 text-[9px] leading-4 text-slatebody">
                      Source: “Launch before the sale, probably in Q3.”
                    </p>
                  </div>
                  <div className="rounded-xl border border-navy/8 bg-cream/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10.5px] font-semibold text-navy">
                        Stock system connection
                      </p>
                      <StatusBadge status="inferred" />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 text-[9px] leading-4 text-slatebody">
                      <LandingIcon name="link" className="h-3 w-3 text-brand" />
                      Reasonable interpretation; API access unverified.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#ecc5ad] bg-[#fffaf6] p-2.5">
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#9a5635]">
                      Open clarification
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-navy/75">
                      Which date determines launch, and who confirms it?
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-peach/45 p-2.5">
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-amber-800">
                      Review finding
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-navy/75">
                      Launch date is presented as fixed without a confirmed
                      source.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <StatusLegend />

        <Reveal delay={100}>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand/15 bg-lav/55 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand">
                <LandingIcon name="shield" className="h-5 w-5" />
              </span>
              <p className="font-display text-[20px] leading-7 tracking-[-0.02em] text-navy">
                Not just a generated scope. A scope you can challenge.
              </p>
            </div>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-brand/70">
              Human decisions stay human
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

function TranscriptVisual() {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white/80 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[7.5px] font-bold uppercase tracking-[0.16em] text-slatebody">
          <LandingIcon name="transcript" className="h-3 w-3" />
          Discovery call
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-[#f06b4f]" />
      </div>
      <div className="mt-2.5 space-y-1.5">
        {[
          "“The dashboard is the main thing.”",
          "“Reporting would be useful, if it’s easy.”",
          "“Client access? Let’s say yes for now.”",
        ].map((line, index) => (
          <p
            key={line}
            className={`rounded-md px-2 py-1.5 text-[9px] leading-4 ${
              index === 2
                ? "bg-peach/70 text-[#7c4a31]"
                : "bg-cream/80 text-slatebody"
            }`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function StructureVisual() {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white/80 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.16em] text-slatebody">
          Structured scope
        </span>
        <span className="rounded-full bg-lav px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-brand">
          Draft
        </span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {[
          { label: "Team dashboard", status: "confirmed" as const },
          { label: "Monday report", status: "inferred" as const },
          { label: "Client access", status: "proposed" as const },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-2 rounded-md border border-navy/6 bg-cream/70 px-2 py-1.5"
          >
            <span className="text-[9px] text-navy/75">{row.label}</span>
            <StatusBadge status={row.status} className="px-1.5 py-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function VerifyVisual() {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white/80 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.16em] text-[#9a5635]">
          Review
        </span>
        <span className="rounded-full bg-peach px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-[#8a4b2d]">
          2 findings
        </span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <div className="rounded-md border border-amber-200 bg-peach/55 p-2">
          <p className="text-[8.5px] font-semibold text-navy">
            Client access is not confirmed
          </p>
          <p className="mt-0.5 text-[8px] leading-3.5 text-slatebody">
            “Let’s say yes for now” is tentative.
          </p>
        </div>
        <div className="rounded-md border border-navy/8 bg-white p-2">
          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-brand">
            Open question
          </p>
          <p className="mt-0.5 text-[8px] leading-3.5 text-slatebody">
            Who approves client access in v1?
          </p>
        </div>
      </div>
    </div>
  );
}

const WORKFLOW = [
  {
    step: "01",
    label: "Input",
    icon: "transcript" as const,
    title: "Bring the conversation",
    copy: "Start with what the client actually said. Paste a discovery transcript, meeting notes, or a rough project brief as the source material.",
    visual: <TranscriptVisual />,
    tone: "border-brand/10 bg-lav/45",
    iconTone: "bg-white text-brand",
  },
  {
    step: "02",
    label: "Structure",
    icon: "layers" as const,
    title: "Generate the scope",
    copy: "Scope Guard organises the available information into scope sections and separates confirmed commitments from inferences, proposals, and open decisions.",
    visual: <StructureVisual />,
    tone: "border-sky-200/70 bg-sky/55",
    iconTone: "bg-white text-sky-700",
  },
  {
    step: "03",
    label: "Verify",
    icon: "review" as const,
    title: "Review the gaps",
    copy: "The critique checks the scope against the source, surfaces potential contradictions and missing information, and highlights questions that need client input.",
    visual: <VerifyVisual />,
    tone: "border-amber-200/70 bg-peach/55",
    iconTone: "bg-white text-[#9a5635]",
  },
];

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden border-y border-navy/8 bg-cream py-20 sm:py-24 lg:py-28"
    >
      <div
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(112,87,245,0.22),transparent)]"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <SectionIntro
            number="03"
            eyebrow="How it works"
            title="Three steps from messy brief to clearer scope."
            description="A focused workflow: preserve the source, structure what is known, then review what the scope cannot yet prove."
          />
        </Reveal>

        <div className="relative mt-10 grid gap-4 lg:grid-cols-3 lg:gap-5">
          <Reveal
            variant="scale"
            className="absolute left-[16%] right-[16%] top-9 hidden lg:block"
          >
            <div className="workflow-track" aria-hidden="true">
              <span className="workflow-traveler" />
            </div>
          </Reveal>
          {WORKFLOW.map((item, index) => (
            <Reveal key={item.step} delay={index * 90} className="relative">
              <article
                className={`workflow-card h-full rounded-[1.75rem] border p-5 shadow-[0_18px_50px_-38px_rgba(23,32,51,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-36px_rgba(23,32,51,0.4)] motion-reduce:transform-none sm:p-6 ${item.tone}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 ${item.iconTone}`}
                    >
                      <LandingIcon name={item.icon} className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-navy/8 bg-white/65 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-navy/60">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-display text-[34px] leading-none text-navy/20">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.015em] text-navy">
                  {item.title}
                </h3>
                <p className="mt-2 text-[11.5px] leading-5 text-slatebody">
                  {item.copy}
                </p>
                <div className="mt-5">{item.visual}</div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="relative mt-10 overflow-hidden rounded-[2rem] bg-[linear-gradient(115deg,#172033_0%,#342b74_52%,#7057f5_100%)] px-6 py-7 text-white shadow-[0_30px_70px_-40px_rgba(23,32,51,0.7)] sm:px-8 sm:py-8">
            <div
              className="absolute -right-10 -top-16 h-52 w-52 rounded-full border border-white/15"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-24 right-24 h-44 w-44 rounded-full border border-white/10"
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-white/55">
                  Ready when the conversation is
                </p>
                <h3 className="mt-2 font-display text-[26px] leading-tight tracking-[-0.025em] sm:text-[31px]">
                  Clearer decisions before development begins.
                </h3>
              </div>
              <Link
                href="/workspace"
                className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[12px] font-semibold text-navy transition-all duration-200 hover:-translate-y-0.5 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#342b74] motion-reduce:transform-none"
              >
                Explore Scope Guard
                <ArrowRight />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pipeline comparison                                                        */
/* -------------------------------------------------------------------------- */

function PipelineSection() {
  return (
    <section
      id="pipeline"
      className="relative scroll-mt-24 overflow-hidden border-y border-navy/8 bg-[radial-gradient(760px_420px_at_6%_8%,rgba(233,229,255,0.78),transparent_62%),radial-gradient(720px_420px_at_96%_78%,rgba(221,247,232,0.72),transparent_60%),#fafaf7] py-20 sm:py-24 lg:py-28"
    >
      <div
        className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-lav/70 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <SectionIntro
            number="04"
            eyebrow="See the difference"
            title="One vague brief. Two very different outcomes."
            description="The same request can lead to two very different products. See what happens when ambiguity goes unchecked—and what changes when scope is made explicit."
          />
        </Reveal>
        <PipelineDemo />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

function EvidenceVisual() {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-navy">
          Staff training requested
        </span>
        <StatusBadge status="proposed" className="px-1.5 py-0.5" />
      </div>
      <div className="mt-2 rounded-lg border border-brand/10 bg-lav/45 p-2">
        <p className="flex items-start gap-1.5 text-[8.5px] leading-4 text-navy/70">
          <LandingIcon name="link" className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
          <span className="landing-highlight">
            “I’d also like a training session… Let’s include it in the proposed
            scope so we can review it.”
          </span>
        </p>
      </div>
      <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
        Source-backed proposal · not a confirmed commitment
      </p>
    </div>
  );
}

function ContradictionVisual() {
  return (
    <div className="rounded-2xl border border-[#ecc5ad] bg-white/75 p-3">
      <div className="space-y-1.5">
        <p className="rounded-md bg-peach/60 px-2 py-1.5 text-[8.5px] leading-4 text-[#7c4a31]">
          “The site must support online booking at launch.”
        </p>
        <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#9a5635]">
          <LandingIcon name="conflict" className="h-3 w-3" />
          Potential conflict
        </div>
        <p className="rounded-md bg-cream px-2 py-1.5 text-[8.5px] leading-4 text-slatebody">
          “We have not decided which booking method to use.”
        </p>
      </div>
    </div>
  );
}

function UncertaintyVisual() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STATUS_DETAILS.map((entry) => (
        <div
          key={entry.status}
          className="rounded-xl border border-navy/8 bg-white/70 p-2.5"
        >
          <StatusBadge status={entry.status} className="px-1.5 py-0.5" />
          <p className="mt-1.5 text-[8px] leading-3.5 text-slatebody">
            {entry.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function ClarificationVisual() {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white/75 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-brand">
            Open question
          </p>
          <p className="mt-1 text-[9.5px] font-semibold text-navy">
            Which payment gateway should be selected?
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-peach px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-amber-800">
          Unconfirmed note
        </span>
      </div>
      <p className="mt-2 rounded-lg border border-navy/8 bg-cream/80 px-2 py-1.5 text-[8.5px] leading-4 text-slatebody">
        “We may compare provider costs, but no gateway has been approved yet.”
      </p>
      <p className="mt-2 text-[8px] text-slatebody">
        Recorded without promoting the proposal to confirmed.
      </p>
    </div>
  );
}

function ChangeVisual() {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="rounded-xl border border-navy/8 bg-white/70 p-2.5">
        <p className="text-[7.5px] font-bold uppercase tracking-[0.12em] text-slatebody">
          Before
        </p>
        <p className="mt-1 text-[8.5px] leading-4 text-navy/75">
          Launch timing is fixed.
        </p>
        <StatusBadge status="unresolved" className="mt-1.5 px-1.5 py-0.5" />
      </div>
      <span className="text-brand">
        <LandingIcon name="arrow-right" className="h-4 w-4" />
      </span>
      <div className="rounded-xl border border-navy/8 bg-white/70 p-2.5">
        <p className="text-[7.5px] font-bold uppercase tracking-[0.12em] text-slatebody">
          After review
        </p>
        <p className="mt-1 text-[8.5px] leading-4 text-navy/75">
          Launch date remains open after clarification.
        </p>
        <StatusBadge status="unresolved" className="mt-1.5 px-1.5 py-0.5" />
      </div>
    </div>
  );
}

function PdfVisual() {
  return (
    <div className="relative mx-auto max-w-[260px] rounded-xl border border-navy/10 bg-white p-3 shadow-[0_14px_30px_-22px_rgba(23,32,51,0.4)]">
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-bold uppercase tracking-[0.16em] text-brand">
          Scope Guard
        </span>
        <LandingIcon name="document" className="h-3.5 w-3.5 text-brand" />
      </div>
      <p className="mt-2 font-display text-[13px] leading-tight text-navy">
        Project scope &amp; requirements
      </p>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {[
          ["1", "confirmed"],
          ["3", "inferred"],
          ["6", "proposed"],
          ["3", "open"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-md bg-cream p-1 text-center">
            <p className="text-[9px] font-semibold text-navy">{value}</p>
            <p className="text-[5.5px] uppercase tracking-[0.06em] text-slatebody">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        <div className="h-1 w-full rounded-full bg-navy/10" />
        <div className="h-1 w-[82%] rounded-full bg-navy/8" />
        <div className="h-1 w-[68%] rounded-full bg-navy/8" />
      </div>
      <p className="mt-2 text-[6.5px] leading-3 text-slatebody">
        Findings, clarifications, and open questions included.
      </p>
    </div>
  );
}

function FeatureCard({
  icon,
  eyebrow,
  title,
  description,
  visual,
  className = "",
  tone = "bg-white",
}: {
  icon: LandingIconName;
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
  className?: string;
  tone?: string;
}) {
  return (
    <article
      className={`group flex h-full flex-col rounded-[1.75rem] border border-navy/8 p-5 shadow-[0_18px_50px_-40px_rgba(23,32,51,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-38px_rgba(23,32,51,0.42)] motion-reduce:transform-none sm:p-6 ${tone} ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/70 text-brand">
          <LandingIcon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-navy/45">
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-navy">
        {title}
      </h3>
      <p className="mt-1.5 text-[11px] leading-5 text-slatebody">{description}</p>
      <div className="mt-auto pt-4">{visual}</div>
    </article>
  );
}

function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative scroll-mt-24 overflow-hidden bg-[linear-gradient(180deg,#fbfaff_0%,#f5f4ff_44%,#fdfcf9_100%)] py-20 sm:py-24 lg:py-28"
    >
      <div
        className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-sky/70 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <SectionIntro
            number="05"
            eyebrow="Built for clarity"
            title="More than a document generator."
            description="Every feature is designed around one idea: a scope is only useful when you can see what supports it, what remains uncertain, and what still needs a decision."
          />
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          <Reveal className="h-full lg:col-span-7" delay={0}>
            <TiltCard strength={2.6}>
              <FeatureCard
                icon="evidence"
                eyebrow="Evidence-backed"
                title="Commitments you can trace"
                description="Trace scope decisions back to the conversation that supports them, including the exact source quotation."
                visual={<EvidenceVisual />}
              />
            </TiltCard>
          </Reveal>
          <Reveal className="h-full lg:col-span-5" delay={60}>
            <TiltCard strength={3.2}>
              <FeatureCard
                icon="conflict"
                eyebrow="Contradiction detection"
                title="Conflicts surface early"
                description="Surface conflicts between the original brief and the generated scope before they turn into delivery surprises."
                visual={<ContradictionVisual />}
                tone="bg-peach/55"
              />
            </TiltCard>
          </Reveal>
          <Reveal className="h-full lg:col-span-5" delay={100}>
            <TiltCard strength={3.2}>
              <FeatureCard
                icon="status"
                eyebrow="Explicit uncertainty"
                title="Four states, never blurred"
                description="Keep assumptions and open decisions separate from confirmed commitments."
                visual={<UncertaintyVisual />}
                tone="bg-lav/55"
              />
            </TiltCard>
          </Reveal>
          <Reveal className="h-full lg:col-span-7" delay={140}>
            <TiltCard strength={2.6}>
              <FeatureCard
                icon="clarification"
                eyebrow="Client clarifications"
                title="Tentative answers stay tentative"
                description="Record client input without automatically turning a tentative answer into a confirmed decision."
                visual={<ClarificationVisual />}
                tone="bg-sky/55"
              />
            </TiltCard>
          </Reveal>
          <Reveal className="h-full lg:col-span-6" delay={180}>
            <TiltCard strength={2.4}>
              <FeatureCard
                icon="compare"
                eyebrow="Change awareness"
                title="See how the scope moved"
                description="Review how scope items and findings change as the analysis evolves."
                visual={<ChangeVisual />}
              />
            </TiltCard>
          </Reveal>
          <Reveal className="h-full lg:col-span-6" delay={220}>
            <TiltCard strength={2.4}>
              <FeatureCard
                icon="document"
                eyebrow="Shareable output"
                title="A report built for review"
                description="Export a structured PDF report that makes commitments, findings, and unresolved decisions easier to discuss."
                visual={<PdfVisual />}
                tone="bg-mint/50"
              />
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Trust                                                                      */
/* -------------------------------------------------------------------------- */

const TRUST_PANELS = [
  {
    icon: "link" as const,
    title: "Grounded in the source",
    copy: "Generated commitments should be traceable to the original brief, not to a confident-sounding summary.",
    tone: "bg-lav/55 text-brand",
  },
  {
    icon: "status" as const,
    title: "Honest about uncertainty",
    copy: "Inferred, proposed, and unresolved items stay distinguishable from what the client actually agreed.",
    tone: "bg-peach/65 text-[#9a5635]",
  },
  {
    icon: "review" as const,
    title: "Designed for review",
    copy: "Potential conflicts and missing decisions are surfaced for human evaluation, not silently resolved.",
    tone: "bg-mint/70 text-emerald-700",
  },
];

const COMPARISON_ROWS = [
  "Assumptions blend into requirements",
  "Ambiguities stay buried in conversation",
  "Scope and source are difficult to compare",
];

const WITH_ROWS = [
  "Commitment statuses remain visible",
  "Open questions are surfaced",
  "Findings can be checked against source evidence",
];

function TrustSection() {
  return (
    <section
      id="trust"
      className="relative scroll-mt-24 overflow-hidden border-y border-navy/8 bg-[linear-gradient(120deg,#e9f7ff_0%,#f2fbf7_48%,#fafaf7_100%)] py-20 sm:py-24 lg:py-28"
    >
      <div
        className="absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-mint/80 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <SectionIntro
            number="06"
            eyebrow="The trust layer"
            title="AI can generate the scope. Evidence keeps it accountable."
            description="Scope Guard is useful because it does not pretend every sentence is equally certain. It keeps the source, the interpretation, and the open decision in view."
          />
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TRUST_PANELS.map((panel, index) => (
            <Reveal key={panel.title} delay={index * 70}>
              <article className="h-full rounded-2xl border border-navy/8 bg-white/75 p-5 shadow-[0_16px_45px_-38px_rgba(23,32,51,0.35)]">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${panel.tone}`}
                >
                  <LandingIcon name={panel.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[14px] font-semibold text-navy">
                  {panel.title}
                </h3>
                <p className="mt-1.5 text-[11px] leading-5 text-slatebody">
                  {panel.copy}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-navy/10 bg-white/80 shadow-[0_24px_60px_-46px_rgba(23,32,51,0.4)]">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-navy/8 bg-[#fff7f1] p-5 sm:p-6 md:border-b-0 md:border-r">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#9a5635]">
                  Without structured review
                </p>
                <ul className="mt-4 space-y-3">
                  {COMPARISON_ROWS.map((row) => (
                    <li
                      key={row}
                      className="flex items-start gap-2.5 text-[11.5px] leading-5 text-navy/70"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f8ddcf] text-[#9a5635]">
                        <LandingIcon name="x" className="h-2.5 w-2.5" />
                      </span>
                      {row}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#f3fbf7] p-5 sm:p-6">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  With Scope Guard
                </p>
                <ul className="mt-4 space-y-3">
                  {WITH_ROWS.map((row) => (
                    <li
                      key={row}
                      className="flex items-start gap-2.5 text-[11.5px] leading-5 text-navy/75"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint text-emerald-700">
                        <LandingIcon name="check" className="h-2.5 w-2.5" />
                      </span>
                      {row}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <p className="mt-4 max-w-3xl text-[10px] leading-5 text-slatebody/80">
            Scope Guard keeps uncertainty visible; final decisions remain with
            your team and client. It does not guarantee perfect requirements or
            eliminate every scope risk.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Tech stack                                                                 */
/* -------------------------------------------------------------------------- */

type TechIconName =
  | "next"
  | "react"
  | "typescript"
  | "tailwind"
  | "zod"
  | "openrouter"
  | "pdfmake"
  | "node";

function TechIcon({
  name,
  className = "h-5 w-5",
}: {
  name: TechIconName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
    className,
  } as const;

  switch (name) {
    case "next":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path
            d="M8 17V7h1.8l6.4 8.3V7H18v10h-1.8L9.8 8.8V17H8Z"
            fill="#ffffff"
          />
        </svg>
      );
    case "react":
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.35">
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <ellipse cx="12" cy="12" rx="9" ry="3.8" />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="3.8"
            transform="rotate(60 12 12)"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="3.8"
            transform="rotate(120 12 12)"
          />
        </svg>
      );
    case "typescript":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" />
          <text
            x="12"
            y="15.8"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="ui-monospace, monospace"
            fontSize="7.5"
            fontWeight="700"
          >
            TS
          </text>
        </svg>
      );
    case "tailwind":
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3.5 11.5c2.4-4.7 5.2-5.4 7.6-2.2 1.4 1.9 2.8 2.5 5 .6" />
          <path d="M8 17.5c2.4-4.7 5.2-5.4 7.6-2.2 1.4 1.9 2.8 2.5 5 .6" />
        </svg>
      );
    case "zod":
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M6.5 5.5h11L6.5 18.5h11" />
          <circle cx="19" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "openrouter":
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="5.5" cy="6" r="2" />
          <circle cx="18.5" cy="18" r="2" />
          <path d="M7.5 6h3.7a4.3 4.3 0 0 1 4.3 4.3v.2a4.3 4.3 0 0 0 1.3 3.1l.5.5" />
          <path d="m15.5 12.3 2.3-.2-.2 2.3" />
        </svg>
      );
    case "pdfmake":
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3.5h7l4 4V20H6V3.5Z" />
          <path d="M13 3.5V8h4M8.5 16.5h3M8.5 13.5h5" />
          <text
            x="8.6"
            y="11.8"
            fill="currentColor"
            stroke="none"
            fontFamily="ui-monospace, monospace"
            fontSize="4.5"
            fontWeight="700"
          >
            PDF
          </text>
        </svg>
      );
    case "node":
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <path d="m12 3 8 4.6v8.8L12 21l-8-4.6V7.6L12 3Z" />
          <text
            x="12"
            y="14.6"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontFamily="ui-monospace, monospace"
            fontSize="5.5"
            fontWeight="700"
          >
            JS
          </text>
        </svg>
      );
  }
}

const TECH = [
  {
    icon: "next" as const,
    name: "Next.js",
    role: "App Router framework, server routes, and page rendering.",
    tone: "bg-white text-navy",
    accent: "border-navy/10 bg-white",
  },
  {
    icon: "react" as const,
    name: "React",
    role: "Interactive workspace, editing, review, and export flows.",
    tone: "bg-sky/70 text-sky-700",
    accent: "border-sky-200/70 bg-white",
  },
  {
    icon: "typescript" as const,
    name: "TypeScript",
    role: "Type-safe analysis, reconciliation, and UI logic.",
    tone: "bg-[#3178c6] text-white",
    accent: "border-sky-200/60 bg-white",
  },
  {
    icon: "tailwind" as const,
    name: "Tailwind CSS",
    role: "Responsive layouts, visual system, and interaction states.",
    tone: "bg-[#e8f7fb] text-[#0284c7]",
    accent: "border-cyan-200/60 bg-white",
  },
  {
    icon: "zod" as const,
    name: "Zod",
    role: "Runtime validation for structured scope and findings.",
    tone: "bg-lav text-brand",
    accent: "border-brand/10 bg-white",
  },
  {
    icon: "openrouter" as const,
    name: "OpenRouter",
    role: "Model API access through an OpenAI-compatible client.",
    tone: "bg-peach text-[#9a5635]",
    accent: "border-amber-200/60 bg-white",
  },
  {
    icon: "pdfmake" as const,
    name: "pdfmake",
    role: "Client-side generation of review-ready scope reports.",
    tone: "bg-mint text-emerald-700",
    accent: "border-emerald-200/60 bg-white",
  },
  {
    icon: "node" as const,
    name: "Node test runner",
    role: "Deterministic regression tests via tsx and node:test.",
    tone: "bg-[#eef7e7] text-[#4b8b3b]",
    accent: "border-slate-200 bg-white",
  },
];

function TechCard({ tech }: { tech: (typeof TECH)[number] }) {
  return (
    <article
      className={`group h-full rounded-2xl border p-5 shadow-[0_14px_40px_-34px_rgba(23,32,51,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_-34px_rgba(23,32,51,0.35)] motion-reduce:transform-none ${tech.accent}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${tech.tone}`}
        >
          <TechIcon name={tech.icon} className="h-6 w-6" />
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>
      <h3 className="mt-4 text-[15.5px] font-semibold tracking-[-0.01em] text-navy">
        {tech.name}
      </h3>
      <p className="mt-2 text-[12.5px] leading-[1.65] text-slatebody">
        {tech.role}
      </p>
    </article>
  );
}

function TechSection() {
  return (
    <section
      id="tech-stack"
      className="relative scroll-mt-24 overflow-hidden bg-cream py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <SectionIntro
            number="07"
            eyebrow="Under the hood"
            title="Built with a modern web stack."
            description="A focused implementation combining a modern web interface, schema validation, and AI-powered scope analysis."
          />
        </Reveal>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {TECH.map((tech, index) => (
            <Reveal key={tech.name} delay={index * 45}>
              <TechCard tech={tech} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* GitHub / project                                                           */
/* -------------------------------------------------------------------------- */

function GitHubSection() {
  return (
    <section
      id="github"
      className="scroll-mt-24 border-y border-navy/8 bg-[linear-gradient(180deg,#ffffff_0%,#fbfaff_100%)] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <div className="overflow-hidden rounded-[2rem] border border-navy/10 bg-white shadow-[0_28px_70px_-50px_rgba(23,32,51,0.45)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:p-10">
              <div>
                <SectionLabel number="08">Open source</SectionLabel>
                <SplitText
                  as="h2"
                  text="Built to make project scoping more trustworthy."
                  className="mt-5 max-w-[18ch] font-display text-[clamp(2rem,3.8vw,3.3rem)] leading-[1.05] tracking-[-0.035em] text-navy"
                />
                <p className="mt-4 max-w-[54ch] text-[14px] leading-7 text-slatebody">
                  Explore the implementation, inspect the code, and follow the
                  project as it evolves. Built for the OpenFire Hackathon.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <PrimaryCta href={GITHUB_URL} external>
                    View Source on GitHub
                  </PrimaryCta>
                  <SecondaryCta href="/workspace">
                    Try Scope Guard
                    <ArrowRight />
                  </SecondaryCta>
                </div>
                <p className="mt-4 text-[10px] text-slatebody/80">
                  No invented stars, releases, or activity metrics — just the
                  repository.
                </p>
              </div>

              <div className="relative">
                <div
                  className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_70%_30%,rgba(233,229,255,0.9),transparent_65%)]"
                  aria-hidden="true"
                />
                <div className="relative overflow-hidden rounded-2xl border border-navy/10 bg-[#172033] p-4 shadow-[0_24px_50px_-30px_rgba(23,32,51,0.6)]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#ff7b72]" />
                    <span className="h-2 w-2 rounded-full bg-[#f2cc60]" />
                    <span className="h-2 w-2 rounded-full bg-[#7ee787]" />
                    <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                      Pipeline shape
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 font-mono text-[10px] leading-5">
                    <p className="text-[#c4b5fd]">
                      generateScope<span className="text-white/45">()</span>
                    </p>
                    <p className="pl-4 text-white/35">↓</p>
                    <p className="text-[#86efac]">
                      repairScopeProvenance<span className="text-white/45">()</span>
                    </p>
                    <p className="pl-4 text-white/35">↓</p>
                    <p className="text-[#93c5fd]">
                      critiqueScope<span className="text-white/45">()</span>
                    </p>
                    <p className="pl-4 text-white/35">↓</p>
                    <p className="text-[#fdba74]">
                      compareScopes<span className="text-white/45">()</span>
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                    {["Zod contracts", "Source evidence", "PDF report"].map(
                      (tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[7.5px] font-semibold uppercase tracking-[0.12em] text-white/55"
                        >
                          {tag}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA + footer                                                         */
/* -------------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section id="start" className="scroll-mt-24 bg-cream py-20 sm:py-24 lg:py-28">
      <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8">
        <Reveal variant="blur">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-brand/15 bg-[linear-gradient(125deg,#e9e5ff_0%,#f4f1ff_38%,#e7f4ff_100%)] px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
            <div
              className="landing-grid absolute inset-0 opacity-40"
              aria-hidden="true"
            />
            <div
              className="scroll-drift absolute -right-16 -top-20 h-72 w-72 rounded-full border border-brand/15"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-white/50 blur-2xl"
              aria-hidden="true"
            />

            <div className="relative mx-auto max-w-[760px] text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-brand">
                Start with the conversation you already have
              </p>
              <SplitText
                as="h2"
                text="Before you build, make sure you're building the right thing."
                className="mt-4 font-display text-[clamp(2.3rem,5vw,4.25rem)] leading-[1.02] tracking-[-0.04em] text-navy"
                delay={80}
                step={52}
              />
              <p className="mx-auto mt-5 max-w-[54ch] text-[14px] leading-7 text-slatebody sm:text-[15px]">
                Turn the next discovery conversation into a clearer, more
                reviewable project scope.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <PrimaryCta href="/workspace">Try Scope Guard</PrimaryCta>
                <SecondaryCta href={GITHUB_URL} external>
                  Explore the GitHub Repository
                </SecondaryCta>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
              <div className="landing-float absolute left-[5%] top-[18%] -rotate-6 rounded-xl border border-brand/15 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-brand">
                  Confirmed
                </p>
                <p className="mt-0.5 text-[8px] text-slatebody">Team dashboard</p>
              </div>
              <div className="landing-float-delayed absolute right-[5%] top-[16%] rotate-6 rounded-xl border border-amber-200 bg-[#fffaf6]/90 px-3 py-2 shadow-sm">
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#9a5635]">
                  Open question
                </p>
                <p className="mt-0.5 text-[8px] text-slatebody">Launch date</p>
              </div>
              <div className="landing-float-slow absolute bottom-[15%] left-[10%] rotate-3 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 shadow-sm">
                <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                  <LandingIcon name="check" className="h-2.5 w-2.5" />
                  Evidence linked
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-navy/8 bg-white/70">
      <div className="mx-auto w-full max-w-[1220px] px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size={32} />
              <span className="font-display text-[20px] tracking-[-0.02em] text-navy">
                Scope Guard
              </span>
            </div>
            <p className="mt-3 max-w-[34ch] text-[11px] leading-5 text-slatebody">
              Evidence-backed project scoping. Turn discovery conversations
              into commitments you can inspect.
            </p>
            <p className="mt-4 inline-flex items-center rounded-full border border-navy/8 bg-cream px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-navy/50">
              Built for the OpenFire Hackathon
            </p>
          </div>

          <nav aria-label="Footer sections">
            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-navy/40">
              Explore
            </p>
            <ul className="mt-3 grid gap-2">
              {[
                ["The Problem", "#problem"],
                ["The Solution", "#solution"],
                ["How It Works", "#how-it-works"],
                ["Live Comparison", "#pipeline"],
                ["Features", "#features"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-[11px] text-slatebody transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-navy/40">
              Project
            </p>
            <ul className="mt-3 grid gap-2">
              <li>
                <a
                  href="#tech-stack"
                  className="text-[11px] text-slatebody transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Tech Stack
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-slatebody transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  GitHub Repository ↗
                </a>
              </li>
              <li>
                <Link
                  href="/workspace"
                  className="text-[11px] text-slatebody transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Open the workspace
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-navy/8 pt-5 text-[9px] text-slatebody/75 sm:flex-row sm:items-center sm:justify-between">
          <p>Scope Guard — evidence-backed project scoping.</p>
          <p>Human review stays in the loop.</p>
        </div>
      </div>
    </footer>
  );
}

function AttributionFooter() {
  return (
    <footer aria-label="Project attribution" className="border-t border-navy/8 bg-white/45">
      <div className="mx-auto w-full max-w-[1220px] px-5 py-5 sm:px-8">
        <p className="group flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[10px] leading-5 tracking-[0.01em] text-slatebody/80">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70 transition-transform duration-300 group-hover:scale-125 motion-reduce:transform-none"
          />
          <span>
            <span className="font-medium text-brand/90 transition-colors duration-200 group-hover:text-brand">
              Built with Alan AI
            </span>
            <span className="px-1 text-slatebody/50" aria-hidden="true">
              ·
            </span>
            <span>Created for OpenFire Hackathon 2026</span>
          </span>
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div id="top" className="landing-shell min-h-screen bg-cream text-navy">
      <ScrollProgress />
      <LandingNav />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <PipelineSection />
        <FeaturesSection />
        <TrustSection />
        <TechSection />
        <GitHubSection />
        <FinalCta />
      </main>
      <Footer />
      <AttributionFooter />
    </div>
  );
}
