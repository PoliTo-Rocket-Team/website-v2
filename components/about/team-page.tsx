import type { ReactNode } from "react";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { withAcademicYear } from "@/lib/about/academic-year-copy";
import type { TeamPage } from "@/lib/about/types";
import { Advisors } from "./advisors";
import { CoreMembers } from "./core-members";
import { Departments, type DepartmentFrames } from "./departments";
import { InNumbers } from "./in-numbers";
import { OrgChart, type AddLeader, type LeaderFrame } from "./org-chart";
import { PageHeader } from "./page-header";

// Boards 26 (desktop) and 26m (phone): the Team page whole, as
// /about/the-team shows it and as the dashboard's Team page editor shows it
// under the edit shell with its editable parts framed (boards 80 to 80h,
// issue #284): the header, then who leads, the departments, the advisors,
// the numbers and every core member. The page sky runs behind everything
// above the apply band; the sections paint no background of their own and
// each sits one section pad below the last, as on the project pages.

/**
 * What the editor wraps: the intro, each person on the org chart, the head
 * blocks and slide headings of the departments, the advisors, the group photo; and what it
 * adds: the Add leader affordances and a note over the page (board 80e,
 * issue #285). The core members list and "In numbers" have none.
 */
export type TeamPageFrames = {
  readonly intro?: (intro: ReactNode) => ReactNode;
  readonly leader?: LeaderFrame;
  readonly addLeader?: AddLeader | null;
  readonly departments?: DepartmentFrames;
  readonly groupPhoto?: (photo: ReactNode) => ReactNode;
  /** The Advisors section, framed as one block (board 80c, issue #286). */
  readonly advisors?: (section: ReactNode) => ReactNode;
  readonly note?: ReactNode;
};

export function TeamPageView({
  page,
  academicYear,
  frames = {},
}: {
  page: TeamPage;
  /** The academic year the intro names, as its first calendar year. */
  academicYear: number;
  frames?: TeamPageFrames;
}) {
  const { header } = page;
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...header} intro={withAcademicYear(header.intro, academicYear)} introFrame={frames.intro} />

          <OrgChart chart={page.orgChart} frame={frames.leader} onAdd={frames.addLeader} />
          <Departments departments={page.departments} frames={frames.departments} />
          <Advisors advisors={page.advisors} frame={frames.advisors} />
          <InNumbers numbers={page.inNumbers} />
          <CoreMembers core={page.coreMembers} photoFrame={frames.groupPhoto} />
        </main>
      </PageSky>
      <ApplyBand />
      <LandingFooter />
      {frames.note}
    </div>
  );
}
