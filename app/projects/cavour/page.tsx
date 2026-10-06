import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Starfield } from "@/components/landing/starfield";
import { CavourHero } from "@/components/cavour/hero";
import { CavourStory } from "@/components/cavour/story";
import { CavourVersions } from "@/components/cavour/versions";
import { CavourLaunches } from "@/components/cavour/launches";
import { CavourNextProject } from "@/components/cavour/next-project";

export const metadata: Metadata = {
  title: "Cavour",
  description:
    "The Team's first rocket, named after Camillo Benso, Count of Cavour. Three flights in one year, three configurations, two awards.",
};

// Pencil boards 23 (/projects/cavour v3, 1440) and 23m (phone, 390). The
// homepage's navbar, footer and page sky (streak tile, grain, still stars)
// run behind every section; the sections paint no background of their own.
export default function CavourPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <main className="relative isolate">
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <div className="page-sky-light" />
          <div className="page-sky-grain" />
          <Starfield count={220} seed={39} twinkleEvery={9} dimOpacity={0.6} reducedMotion="still" />
        </div>
        <CavourHero />
        <CavourStory />
        <CavourVersions />
        <CavourLaunches />
        <CavourNextProject />
      </main>
      <LandingFooter />
    </div>
  );
}
