"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BrandMark } from "./brand-mark";

const GITHUB_URL = "https://github.com/maxsilver9890/Scope-Guard";

const SECTIONS = [
  { id: "problem", label: "The Problem" },
  { id: "how-it-works", label: "How It Works" },
  { id: "features", label: "Features" },
  { id: "tech-stack", label: "Tech Stack" },
] as const;

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

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const tracked = new Set<string>(SECTIONS.map(({ id }) => id));
    const nodes = [
      ...SECTIONS.map(({ id }) => id),
      "solution",
      "trust",
      "github",
      "start",
    ]
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id ?? "";
        setActive(tracked.has(id) ? id : "");
      },
      { rootMargin: "-38% 0px -52% 0px", threshold: [0, 0.1, 0.4] },
    );

    for (const node of nodes) {
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled || open
          ? "border-navy/10 bg-cream/90 shadow-[0_12px_40px_-28px_rgba(23,32,51,0.28)] backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1220px] items-center justify-between gap-5 px-5 py-3.5 sm:px-8 lg:py-4">
        <Link
          href="#top"
          className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
          aria-label="Scope Guard home"
        >
          <BrandMark className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.03] motion-reduce:transform-none" />
          <span className="flex flex-col">
            <span className="font-display text-[21px] leading-none tracking-[-0.025em] text-navy">
              Scope Guard
            </span>
            <span className="mt-1 hidden text-[8px] font-semibold uppercase tracking-[0.26em] text-slatebody sm:block">
              Evidence-backed scoping
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 rounded-full border border-navy/10 bg-white/70 px-1.5 py-1.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] backdrop-blur-md lg:flex"
        >
          {SECTIONS.map((section) => {
            const isActive = active === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`nav-underline relative rounded-full px-3.5 py-2 text-[11.5px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  isActive
                    ? "bg-lav text-brand-strong"
                    : "text-slatebody hover:bg-white hover:text-navy"
                }`}
              >
                {section.label}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-navy/10 bg-white/60 px-4 text-[11.5px] font-medium text-navy transition-all duration-200 hover:-translate-y-0.5 hover:border-navy/20 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transform-none"
          >
            <GitHubIcon />
            View on GitHub
          </a>
          <Link
            href="/workspace"
            className="group inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[11.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(112,87,245,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-[0_14px_28px_-12px_rgba(112,87,245,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transform-none"
          >
            Try Scope Guard
            <ArrowIcon />
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 bg-white/70 text-navy transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream lg:hidden"
          aria-expanded={open}
          aria-controls="landing-mobile-navigation"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="relative block h-3.5 w-5" aria-hidden="true">
            <span
              className={`absolute left-0 top-0 h-[1.6px] w-5 rounded-full bg-current transition-transform duration-200 ${
                open ? "translate-y-[6px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[6px] h-[1.6px] w-5 rounded-full bg-current transition-opacity duration-200 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 top-[12px] h-[1.6px] w-5 rounded-full bg-current transition-transform duration-200 ${
                open ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      <div
        id="landing-mobile-navigation"
        className={`mx-auto w-full max-w-[1220px] px-5 pb-4 sm:px-8 lg:hidden ${
          open ? "block" : "hidden"
        }`}
      >
        <nav
          aria-label="Mobile navigation"
          className="rounded-2xl border border-navy/10 bg-white/90 p-3 shadow-[0_24px_60px_-34px_rgba(23,32,51,0.4)] backdrop-blur-xl"
        >
          <div className="grid gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-3 text-[13px] font-medium text-navy transition-colors hover:bg-lav focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {section.label}
              </a>
            ))}
          </div>
          <div className="mt-3 grid gap-2 border-t border-navy/10 pt-3">
            <Link
              href="/workspace"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Try Scope Guard
              <ArrowIcon />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-navy/10 bg-white text-[12.5px] font-medium text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <GitHubIcon />
              View on GitHub
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
