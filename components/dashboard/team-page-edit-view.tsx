import { TeamPageView, type TeamPageFrames } from "@/components/about/team-page";
import type { TeamPage } from "@/lib/about/types";

/**
 * The Team page as its editor draws it under the edit shell
 * (team-page-edit.tsx), its editable parts framed through `frames`, without
 * the site's navbar and footer (issue #495): they are not the editor's to
 * change. The apply band stays.
 */
export function EditedTeamPage({ page, academicYear, frames }: { page: TeamPage; academicYear: number; frames: TeamPageFrames }) {
  return <TeamPageView page={page} academicYear={academicYear} chrome="none" frames={frames} />;
}
