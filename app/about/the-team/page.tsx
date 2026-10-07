import type { Metadata } from "next";
import { Advisors } from "@/components/about/advisors";
import { CoreMembers } from "@/components/about/core-members";
import { Departments } from "@/components/about/departments";
import { InNumbers } from "@/components/about/in-numbers";
import { OrgChart } from "@/components/about/org-chart";
import { PageHeader } from "@/components/about/page-header";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { team } from "@/lib/about/team";

export const metadata: Metadata = {
  title: "The Team · PoliTo Rocket Team",
  description: team.description,
};

// Boards 26 (desktop) and 26m (phone): the header and its
// figures, then who leads, the departments, the advisors, the numbers and
// every core member, all drawn from one record (lib/about/team.ts). The page
// sky runs behind everything above the apply band; the sections paint no
// background of their own and each sits one section pad below the last, as
// on the project pages.
export default function TeamPage() {
  const { header } = team;
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...header} />

          <OrgChart chart={team.orgChart} />
          <Departments departments={team.departments} />
          <Advisors advisors={team.advisors} />
          <InNumbers numbers={team.inNumbers} />
          <CoreMembers core={team.coreMembers} />
        </main>
      </PageSky>
      <ApplyBand />
      <LandingFooter />
    </div>
  );
}
