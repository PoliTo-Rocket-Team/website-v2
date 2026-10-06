"use client";

import dynamic from "next/dynamic";

// Mounted as the homepage hero mounts its rocket (components/landing/hero.tsx):
// client-only, so three, R3F and drei stay out of the server render. The hero
// that holds it is a server component, which may not pass `ssr: false` itself.
export const CavourRocketStage = dynamic(() => import("@/components/landing/cavour-stage-3d"), { ssr: false });
