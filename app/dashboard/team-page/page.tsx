import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { TeamPageEdit } from "@/components/dashboard/team-page-edit";
import { currentAcademicYearStart } from "@/lib/about/academic-year";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { footerProjects } from "@/lib/project-content/public";

export const metadata: Metadata = {
  title: "Team page · Dashboard · PoliTo Rocket Team",
};

// Boards 80 to 80h (issues #284 to #286): the Team page on its real page
// under the edit shell, opened on the layer the editor works on (the draft
// when there is one), laid on the team's roles, with the hand-added advisors. Full access and anyone with
// site-content access reach it (lib/content/gate.ts); everyone else gets the
// dashboard's not found.
export default function TeamPageEditPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveTeamPage />
    </Suspense>
  );
}

async function LiveTeamPage() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/team-page");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "team-page")) notFound();
  const [editing, advisors, academicYear, projects] = await Promise.all([
    data.teamPage.open(),
    data.teamAdvisors.list(),
    currentAcademicYearStart(),
    footerProjects(),
  ]);
  if (editing === null || advisors === null) notFound();
  return <TeamPageEdit opening={editing} advisors={advisors} academicYear={academicYear} footerProjects={projects} />;
}
