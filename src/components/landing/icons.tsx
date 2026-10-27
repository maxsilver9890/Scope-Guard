import type { ReactNode } from "react";

export type LandingIconName =
  | "alert"
  | "arrow-down"
  | "arrow-right"
  | "assumption"
  | "check"
  | "clarification"
  | "compare"
  | "conflict"
  | "document"
  | "evidence"
  | "layers"
  | "link"
  | "lock"
  | "question"
  | "review"
  | "shield"
  | "spark"
  | "status"
  | "transcript"
  | "x";

const paths: Record<LandingIconName, ReactNode> = {
  alert: (
    <>
      <path d="M10 3.6 17 16.4H3L10 3.6Z" />
      <path d="M10 7.8v4.1" />
      <circle cx="10" cy="14.2" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  "arrow-down": <path d="M10 3.5v13M4.8 11.2 10 16.5l5.2-5.3" />,
  "arrow-right": <path d="M3.5 10h13M11 4.8 16.5 10 11 15.2" />,
  assumption: (
    <>
      <path d="M10 3.2a4.9 4.9 0 0 0-2.7 9c.5.3.8.8.8 1.4h3.8c0-.6.3-1.1.8-1.4a4.9 4.9 0 0 0-2.7-9Z" />
      <path d="M8.3 16.2h3.4M9 18h2" />
    </>
  ),
  check: <path d="m4.4 10.4 3.6 3.5 7.6-8" />,
  clarification: (
    <>
      <path d="M4 4.8h12v8.4H9.2L5.6 16v-2.8H4V4.8Z" />
      <path d="M7.2 8.2h5.6M7.2 10.6h3.4" />
    </>
  ),
  compare: (
    <>
      <path d="M6.5 3.8 3.4 7l3.1 3.2M3.7 7h9.6" />
      <path d="m13.5 16.2 3.1-3.2-3.1-3.2M16.3 13H6.7" />
    </>
  ),
  conflict: (
    <>
      <path d="M4.2 4.5 8.4 10l-4.2 5.5M15.8 4.5 11.6 10l4.2 5.5" />
    </>
  ),
  document: (
    <>
      <path d="M5.2 3.4h6.2l3.4 3.4v9.8H5.2V3.4Z" />
      <path d="M11.4 3.4v3.6h3.4M7.6 10h4.8M7.6 12.8h4.8" />
    </>
  ),
  evidence: (
    <>
      <path d="M5 4.5h10v11H5v-11Z" />
      <path d="M7.4 7.4h5.2M7.4 10h3.8" />
      <path d="M12.4 12.2h2.6" />
      <circle cx="10.7" cy="12.2" r="1.1" />
    </>
  ),
  layers: (
    <>
      <path d="m10 3.5 6.2 3.3L10 10 3.8 6.8 10 3.5Z" />
      <path d="m3.8 10 6.2 3.3 6.2-3.3M3.8 13.2 10 16.5l6.2-3.3" />
    </>
  ),
  link: (
    <>
      <path d="M8.2 11.8 11.8 8.2" />
      <path d="M7.1 13.9 5.8 15.2a3 3 0 0 1-4.2-4.2l2.3-2.3a3 3 0 0 1 4.2 0" />
      <path d="m12.9 6.1 1.3-1.3a3 3 0 0 1 4.2 4.2l-2.3 2.3a3 3 0 0 1-4.2 0" />
    </>
  ),
  lock: (
    <>
      <rect x="4.2" y="8.6" width="11.6" height="8" rx="2" />
      <path d="M6.6 8.6V6.8a3.4 3.4 0 0 1 6.8 0v1.8M10 12v2.2" />
    </>
  ),
  question: (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M8 8a2.1 2.1 0 1 1 3.1 1.9c-.7.4-1.1.9-1.1 1.7" />
      <circle cx="10" cy="14" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  review: (
    <>
      <path d="M4 4.5h7.5L16 9v6.5H4v-11Z" />
      <path d="M11.5 4.5V9H16" />
      <path d="m6.8 12 1.5 1.5 3-3" />
    </>
  ),
  shield: (
    <>
      <path d="M10 3.2 16 5.6v4.8c0 3.4-2.4 5.7-6 6.9-3.6-1.2-6-3.5-6-6.9V5.6l6-2.4Z" />
      <path d="m7.2 10.2 1.8 1.8 3.8-4" />
    </>
  ),
  spark: (
    <>
      <path d="M10 3.2 11.4 8.6 16.8 10l-5.4 1.4L10 16.8l-1.4-5.4L3.2 10l5.4-1.4L10 3.2Z" />
    </>
  ),
  status: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="14" cy="6" r="2.2" />
      <circle cx="6" cy="14" r="2.2" />
      <circle cx="14" cy="14" r="2.2" />
    </>
  ),
  transcript: (
    <>
      <path d="M4.2 4.5h11.6v11H4.2v-11Z" />
      <path d="M6.8 7.3h6.4M6.8 10h6.4M6.8 12.7h4.1" />
    </>
  ),
  x: <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />,
};

export function LandingIcon({
  name,
  className = "h-5 w-5",
}: {
  name: LandingIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
