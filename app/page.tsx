import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Latest } from "@/components/landing/latest";
import { Projects } from "@/components/landing/projects";
import { InsideTeam } from "@/components/landing/inside-team";
import { Partners } from "@/components/landing/partners";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";
import { PageSky } from "@/components/landing/page-sky";

// Approved landing page per Pencil board 21 ("Home v3, footer background
// throughout"). One sky runs behind every section from below the hero to the
// apply band: a repeating streak tile, a grain layer and stars. The sections
// inside it paint no background of their own. Every section pads its top and
// bottom by the `section` token; the hero has no pad of its own, so the sky
// adds one, and the gap after the hero matches every other section gap.
export default function LandingPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <main>
        <Hero />
        <PageSky className="pt-section" starsClassName="top-[240px]">
          <Latest />
          <Projects />
          <InsideTeam />
          <Partners />
        </PageSky>
        <ApplyBand />
      </main>
      <LandingFooter />
    </div>
  );
}
