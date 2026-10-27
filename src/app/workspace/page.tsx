import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";

import { BrandMark } from "@/components/landing/brand-mark";
import { ScopeWorkspace } from "@/components/scope-workspace";

export const metadata: Metadata = {
  title: "Analysis workspace",
  description:
    "Turn a discovery transcript or project brief into a structured, evidence-backed scope and review its gaps.",
};

const GITHUB_URL = "https://github.com/maxsilver9890/Scope-Guard";

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.48 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.94c.85 0 1.71.12 2.51.35 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.48A10.19 10.19 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
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

async function getSampleTranscript() {
  "use cache";
  cacheLife("max");

  const samplePath = path.join(
    process.cwd(),
    "samples",
    "discovery-call-transcript.txt",
  );

  return (await readFile(samplePath, "utf8")).trim();
}

export default async function WorkspacePage() {
  const transcript = await getSampleTranscript();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[radial-gradient(1100px_540px_at_14%_-8%,rgba(233,229,255,0.82),transparent_62%),radial-gradient(820px_460px_at_96%_4%,rgba(255,230,213,0.58),transparent_58%),linear-gradient(180deg,#fafaf7_0%,#fbfaff_40%,#f8f7f3_100%)] text-ink">
      <header className="sticky top-0 z-40 border-b border-navy/8 bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
            aria-label="Scope Guard overview"
          >
            <BrandMark className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.03] motion-reduce:transform-none" />
            <span className="flex min-w-0 flex-col">
              <span className="whitespace-nowrap font-display text-[21px] leading-none tracking-[-0.025em] text-navy">
                Scope Guard
              </span>
              <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.26em] text-slatebody sm:block">
                Evidence-backed scoping
              </span>
            </span>
          </Link>

          <nav
            aria-label="Workspace navigation"
            className="hidden items-center gap-1 rounded-full border border-navy/10 bg-white/70 px-1.5 py-1.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] backdrop-blur-md md:flex"
          >
            <Link
              href="/"
              className="rounded-full px-3.5 py-2 text-[11.5px] font-medium text-slatebody transition-colors hover:bg-white hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Overview
            </Link>
            <span
              aria-current="page"
              className="rounded-full bg-lav px-3.5 py-2 text-[11.5px] font-medium text-brand-strong"
            >
              Workspace
            </span>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-10 items-center gap-2 rounded-full border border-navy/10 bg-white/60 px-4 text-[11.5px] font-medium text-navy transition-all duration-200 hover:-translate-y-0.5 hover:border-navy/20 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transform-none sm:inline-flex"
            >
              <GitHubIcon />
              GitHub
            </a>
            <Link
              href="/"
              className="group inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[11.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(112,87,245,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-[0_14px_28px_-12px_rgba(112,87,245,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transform-none"
            >
              Back to home
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-navy/8">
        <div
          className="absolute inset-0 -z-20 bg-[radial-gradient(860px_460px_at_8%_-10%,rgba(233,229,255,0.92),transparent_64%),radial-gradient(720px_420px_at_98%_8%,rgba(255,230,213,0.7),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="landing-grid absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[1480px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)] lg:items-end lg:gap-12">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-brand/60" aria-hidden="true" />
                <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-brand">
                  From conversation to clarity
                </p>
              </div>
              <h1 className="mt-5 max-w-[15ch] font-display text-[clamp(2.45rem,5vw,4.4rem)] font-normal leading-[1.01] tracking-[-0.04em] text-navy">
                Build the right thing.
                <span className="block text-slatebody">
                  Before you build anything.
                </span>
              </h1>
            </div>
            <div className="rounded-[1.75rem] border border-white/70 bg-white/50 p-5 shadow-[0_24px_60px_-46px_rgba(23,32,51,0.45)] backdrop-blur-md sm:p-6">
              <p className="max-w-sm text-[13.5px] leading-6 text-slatebody lg:ml-auto">
                Turn client conversations into explicit scope, testable
                requirements, and risks your team can act on.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                <span className="rounded-full border border-brand/10 bg-lav/70 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-brand">
                  Evidence-linked
                </span>
                <span className="rounded-full border border-cyan-200/60 bg-sky/60 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-sky-700">
                  Status-aware
                </span>
                <span className="rounded-full border border-emerald-200/60 bg-mint/70 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Review-ready
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1480px] px-5 pb-20 pt-8 sm:px-8 lg:px-12">
        <ScopeWorkspace initialInput={transcript} />
      </main>

      <footer className="mt-auto border-t border-navy/8 bg-white/45">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-2 px-5 py-6 text-[12px] text-slatebody sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>Scope Guard — evidence-backed project scoping.</p>
          <p>
            Made with <span className="font-semibold text-brand">Alan AI</span>{" "}
            for the OpenFire Hackathon.
          </p>
        </div>
      </footer>
    </div>
  );
}
