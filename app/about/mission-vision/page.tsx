import type { Metadata } from "next";
import { Beliefs, Mission, Path, Vision } from "@/components/about/mission";
import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { mission } from "@/lib/about/mission";

export const metadata: Metadata = {
  title: "Mission & Vision · PoliTo Rocket Team",
  description: mission.description,
};

// Boards 29 (desktop) and 29m (phone): the header with no figures, the
// mission, the vision, the path and what we believe, all drawn from one
// record (lib/about/mission.ts). No apply band on this page (Huey's ruling,
// issue #103).
export default function MissionVisionPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...mission.header} />
          <Mission mission={mission.mission} />
          <Vision vision={mission.vision} />
          <Path path={mission.path} />
          <Beliefs beliefs={mission.beliefs} />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
