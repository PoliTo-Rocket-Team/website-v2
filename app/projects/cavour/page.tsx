import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { PageSky } from "@/components/landing/page-sky";
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
// homepage's navbar and footer, and the shared page sky behind everything
// above the footer, as on /projects; the sections paint no background.
export default function CavourPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main>
          <CavourHero />
          <CavourStory />
          <CavourVersions />
          <CavourLaunches />
          <CavourNextProject />
        </main>
      </PageSky>
      <LandingFooter />
    </div>
  );
}
