import { managesRecruitment, readsRecruitmentIn, type RecruitmentReader } from "./application-documents";
import { mayChange, type ChangeArea, type ChangeAuthority, type DivisionUnit } from "./viewer";

// Who may change a position and its applications (issue #461): editing it,
// switching it open or closed, and every move on an application to it. One
// rule for every such write, so the database side never asks two questions
// that can disagree.

/** A viewer as a recruitment write reads them: who they read as, and what lets them change. */
export type PositionWriter = RecruitmentReader & ChangeAuthority;

/**
 * Whether the viewer may change `area` on a position in `unit`: they read
 * that area there (`readsRecruitmentIn`), and their role or an area grant at
 * Can edit lets them change it (`mayChange`). Full access, the
 * standing the team leader's seat gives (`fullAccessSeatOf`, issue #444),
 * passes both everywhere; a department head passes in their department, a
 * division lead in the divisions they lead. The recruitment manager, the
 * Logistics lead (`managesRecruitment`, issue #194), passes on Applications
 * in every division; since issue #885 that seat is full access, so it passes
 * on Positions everywhere too.
 */
export function mayChangePositionIn(viewer: PositionWriter, area: Exclude<ChangeArea, "members">, unit: DivisionUnit): boolean {
  if (area === "applications" && managesRecruitment(viewer)) return true;
  return readsRecruitmentIn(viewer, area, unit) && mayChange(viewer, area, unit);
}
