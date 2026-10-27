import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Evidence-backed project scoping",
  description:
    "Scope Guard turns discovery conversations into structured project scopes and surfaces unsupported assumptions, contradictions, and unresolved decisions before development begins.",
};

export default function Home() {
  return <LandingPage />;
}
