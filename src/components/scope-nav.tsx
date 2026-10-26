"use client";

import { useEffect, useState } from "react";

export type NavIconName =
  | "overview"
  | "in-scope"
  | "out-of-scope"
  | "assumptions"
  | "questions"
  | "requirements"
  | "acceptance"
  | "risks"
  | "clarifications"
  | "changes";

export type NavItem = {
  id: string;
  label: string;
  icon: NavIconName;
};

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    viewBox: "0 0 20 20",
    fill: "none",
    "aria-hidden": true,
    className: "h-4 w-4 shrink-0",
  } as const;

  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="10" cy="10" r="2" fill="currentColor" />
        </svg>
      );
    case "in-scope":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="m7 10.2 2 2 4-4.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "out-of-scope":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M7 10h6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "assumptions":
      return (
        <svg {...common}>
          <path
            d="M10 3.2a5 5 0 0 0-3 9v2.1h6V12.2a5 5 0 0 0-3-9Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8.4 16.6h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "questions":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8.3 8.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="13.8" r="0.9" fill="currentColor" />
        </svg>
      );
    case "requirements":
      return (
        <svg {...common}>
          <path
            d="M4.5 5.5h11M4.5 10h11M4.5 14.5h7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="15.4" cy="14.5" r="1.1" fill="currentColor" />
        </svg>
      );
    case "acceptance":
      return (
        <svg {...common}>
          <rect
            x="3.5"
            y="3.5"
            width="13"
            height="13"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="m6.6 10.2 2.1 2.1 4.7-5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "risks":
      return (
        <svg {...common}>
          <path
            d="M10 3.6 16.4 15H3.6L10 3.6Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M10 8.2v3.2M10 13.6v.1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "clarifications":
      return (
        <svg {...common}>
          <path
            d="M4 5.5h12v7.2H9.4L6 16.2v-3.5H4V5.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7.4 9h5.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "changes":
      return (
        <svg {...common}>
          <path
            d="M4.5 7.2h9.2M11.4 4.8l2.3 2.4-2.3 2.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 12.8H6.3M8.6 10.4 6.3 12.8l2.3 2.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function scrollToSection(id: string) {
  if (typeof document === "undefined") {
    return;
  }

  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  element.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "start",
  });

  if (typeof history !== "undefined") {
    history.replaceState(null, "", `#${id}`);
  }
}

/**
 * Track which section heading is currently nearest the top of the viewport.
 * The section order must match the rendered document order.
 */
export function useActiveSection(ids: string[]): string | null {
  const key = ids.join("|");
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    const sectionIds = key ? key.split("|") : [];

    if (sectionIds.length === 0) {
      return;
    }

    let frame = 0;

    const compute = () => {
      frame = 0;
      const offset = 168;
      let current = sectionIds[0] ?? null;

      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (!element) {
          continue;
        }
        if (element.getBoundingClientRect().top - offset <= 0) {
          current = id;
        } else {
          break;
        }
      }

      setActive(current);
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(compute);
      }
    };

    frame = window.requestAnimationFrame(compute);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [key]);

  return active;
}

export function ScopeNav({
  items,
  activeId,
  onNavigate,
  variant,
}: {
  items: NavItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
  variant: "rail" | "bar";
}) {
  if (items.length === 0) {
    return null;
  }

  const isRail = variant === "rail";

  return (
    <nav
      aria-label="Scope sections"
      className={
        isRail
          ? "hidden lg:block"
          : "sticky top-[68px] z-30 -mt-1 mb-5 lg:hidden"
      }
    >
      <div
        className={
          isRail
            ? "sticky top-24 rounded-[26px] border border-line/70 bg-white/70 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl"
            : "no-scrollbar overflow-x-auto rounded-2xl border border-line/70 bg-white/80 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl"
        }
      >
        {isRail ? (
          <div className="mb-2 flex items-center gap-2.5 rounded-2xl px-2 pb-2 pt-1.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-forest text-[#f7f6f3]">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M5 14V6h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="square"
                />
                <circle cx="13.4" cy="6.4" r="1.6" fill="#8b93f8" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight text-forest">
                Scope Guard
              </span>
              <span className="block text-[9px] font-medium uppercase tracking-[0.18em] text-muted">
                Document map
              </span>
            </span>
          </div>
        ) : null}

        <ul
          className={isRail ? "flex flex-col gap-0.5" : "flex items-center gap-1"}
          role="list"
        >
          {items.map((item) => {
            const active = activeId === item.id;
            return (
              <li key={item.id} className={isRail ? "" : "shrink-0"}>
                <a
                  href={`#${item.id}`}
                  aria-current={active ? "true" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(item.id);
                  }}
                  className={`relative flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                    active
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-sage hover:text-forest"
                  }`}
                >
                  {isRail ? (
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-full bg-accent transition-all ${
                        active ? "w-1 opacity-100" : "w-0 opacity-0"
                      }`}
                    />
                  ) : null}
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}