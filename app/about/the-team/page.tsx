import type { Metadata } from "next";
import { TeamPageView } from "@/components/about/team-page";
import { currentAcademicYearStart } from "@/lib/about/academic-year";
import { team } from "@/lib/about/team";
import { teamPageData } from "@/lib/about/team-data";

export const metadata: Metadata = {
  title: "The Team · PoliTo Rocket Team",
  description: team.description,
};

// Boards 26 (desktop) and 26m (phone), drawn by TeamPageView, which the
// dashboard's Team page editor shares (issue #284). One record fills it: who
// leads, the departments and the core members built from the team's roles
// with the published visual layer laid on (lib/about/team-data.ts), the rest
// the hand-typed lib/about/team.ts.
export default async function TeamPage() {
  // The intro names the current academic year, which turns over on 1 October.
  const [page, academicYear] = await Promise.all([teamPageData(), currentAcademicYearStart()]);
  return <TeamPageView page={page} academicYear={academicYear} />;
}
