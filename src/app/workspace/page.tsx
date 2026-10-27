import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";

import { ScopeWorkspace } from "@/components/scope-workspace";

export const metadata: Metadata = {
  title: "Analysis workspace",
  description:
    "Turn a discovery transcript or project brief into a structured, evidence-backed scope and review its gaps.",
};

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

function BrandMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="9" fill="#1B2440" />
      <rect
        x="0.75"
        y="0.75"
        width="32.5"
        height="32.5"
        rx="9"
        stroke="#FFFFFF"
        strokeOpacity="0.14"
        strokeWidth="0.5"
      />
      <path
        d="M9 23.5V11.5h12"
        stroke="#F7F6F3"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <path
        d="M9 26.5h8"
        stroke="#A5B4FC"
        strokeOpacity="0.8"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <circle cx="22.5" cy="12.5" r="2.4" fill="#8B93F8" />
    </svg>
  );
}

export default async function Home() {
  const transcript = await getSampleTranscript();

  return (
    <div className="flex min-h-full flex-1 flex-col text-ink">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-4 px-4 py-3.5 sm:gap-6 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            aria-label="Scope Guard overview"
          >
            <BrandMark />
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="whitespace-nowrap font-serif text-[20px] leading-none tracking-[-0.015em] text-forest">
                Scope Guard
              </span>
              <span className="hidden text-[9px] font-medium uppercase tracking-[0.24em] text-muted sm:inline">
                Scoping intelligence
              </span>
            </div>
          </Link>
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-line/70 bg-white/60 px-3 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex">
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
              aria-hidden="true"
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
              Analysis workspace
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] px-5 pb-24 sm:px-8 lg:px-12">
        <section className="border-b border-line/70 py-6 lg:py-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-8">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-accent/70" aria-hidden="true" />
                <p className="text-[9.5px] font-medium uppercase tracking-[0.26em] text-accent">
                  From conversation to clarity
                </p>
              </div>
              <h1 className="mt-3 max-w-none font-serif text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.05] tracking-[-0.024em] text-forest sm:max-w-[24ch]">
                Build the right thing.
                <span className="block text-forest/75">
                  Before you build anything.
                </span>
              </h1>
            </div>
            <div className="lg:col-span-4 lg:pb-1">
              <p className="max-w-sm text-[13.5px] leading-6 text-muted lg:ml-auto">
                Turn client conversations into explicit scope, testable
                requirements, and risks your team can act on.
              </p>
            </div>
          </div>
        </section>

        <ScopeWorkspace initialInput={transcript} />
      </main>
    </div>
  );
}