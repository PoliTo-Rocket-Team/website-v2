import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Latest } from "@/components/landing/latest";
import { Projects } from "@/components/landing/projects";
import { InsideTeam } from "@/components/landing/inside-team";
import { Partners } from "@/components/landing/partners";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";

// Approved landing page per Pencil boards 04 → 10 (HANDOFF.md).
export default function LandingPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <main>
        <Hero />
        <Latest />
        <Projects />
        <InsideTeam />
        <Partners />
        <ApplyBand />
      </main>
      <LandingFooter />
    </div>
  );
}
