import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Latest } from "@/components/landing/latest";
import { Projects } from "@/components/landing/projects";
import { InsideTeam } from "@/components/landing/inside-team";
import { Partners } from "@/components/landing/partners";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";
import { Starfield } from "@/components/landing/starfield";

// Approved landing page per Pencil board 21 ("Home v3, footer background
// throughout"). One drawn sky runs behind every section from below the hero
// to the apply band; the sections inside it paint no background of their own.
export default function LandingPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <main>
        <Hero />
        <div className="relative isolate">
          <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
            <div className="page-sky-light" />
            {/* The footer's starfield, without its shooting star. Stars are
                placed in percent, so the count is sized for the sky's usual
                height of about 3600px. Unlike the hero and footer skies, this
                one holds still under reduced motion. */}
            <Starfield
              count={200}
              seed={31}
              twinkleEvery={9}
              dimOpacity={0.6}
              reducedMotion="still"
              className="top-[240px]"
            />
          </div>
          <Latest />
          <Projects />
          <InsideTeam />
          <Partners />
        </div>
        <ApplyBand />
      </main>
      <LandingFooter />
    </div>
  );
}
