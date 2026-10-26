import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";

import { ScopeWorkspace } from "@/components/scope-workspace";

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
      <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="3.25" fill="#18352F" />
      <rect
        x="0.75"
        y="0.75"
        width="32.5"
        height="32.5"
        rx="3.25"
        stroke="#18352F"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <path
        d="M8.5 23.5V11.5h13"
        stroke="#F7F6F2"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <path
        d="M8.5 27h9"
        stroke="#EAF0EB"
        strokeOpacity="0.5"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <circle cx="22.5" cy="12.5" r="2.4" fill="#B18A50" />
    </svg>
  );
}

export default async function Home() {
  const transcript = await getSampleTranscript();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      <header className="border-b border-line bg-canvas/95">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3.5">
            <BrandMark />
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="font-serif text-[21px] leading-none tracking-[-0.01em] text-forest">
                Scope Guard
              </span>
              <span className="hidden text-[9px] font-medium uppercase tracking-[0.24em] text-muted sm:inline">
                Scoping intelligence
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Analysis workspace
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
        <section className="border-b border-line/90 py-9 lg:py-12">
          <div className="grid gap-7 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-8">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-brass/70" aria-hidden="true" />
                <p className="text-[9.5px] font-medium uppercase tracking-[0.26em] text-brass">
                  From conversation to clarity
                </p>
              </div>
              <h1 className="mt-4 max-w-none font-serif text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.04] tracking-[-0.022em] text-forest sm:max-w-[24ch]">
                Build the right thing.
                <span className="block text-forest/80">
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