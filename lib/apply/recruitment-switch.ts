import type { ScopeInfo } from "@/app/actions/get-member-scopes";
import { isOffTeam, isTeamLeader, type ViewerStanding } from "@/lib/dashboard/viewer";
import type { Recruitment } from "./positions";

// The site-wide recruitment switch on the dashboard (issue #121). The team
// leader may flip it from their seat alone, by the rule that gives them full
// access everywhere else (`isTeamLeader`, issue #444); otherwise only an
// org-wide positions editor, or an admin, may: a lead's edit rights on one
// department or division do not reach the whole site. The permission, the
// store and the cache are passed in, so the rule is tested without them
// (recruitment-switch.test.ts). The dashboard data interface supplies them:
// the database side from the caller's standing and scope rows, the dummy side
// from the test developer's standing.

/**
 * Whether a member with this standing and positions scope may flip the
 * switch. Someone off the team never may, whatever scope rows outlived their
 * roles (issues #201, #477): those rows reach nothing.
 */
export function canSwitchRecruitment(viewer: ViewerStanding, scope: ScopeInfo): boolean {
  if (isOffTeam(viewer.kind)) return false;
  return isTeamLeader(viewer) || scope.hasOrgEdit || scope.hasAdminEdit;
}

/** Whether a test developer looking as this standing may flip the dummy switch: the team leader and the operations lead. */
export function canSwitchRecruitmentAs(viewer: ViewerStanding): boolean {
  return isTeamLeader(viewer) || viewer.kind === "operations-lead";
}

/** What the dashboard shows: the switch's state and whether this member may change it. */
export type RecruitmentControl = { recruitment: Recruitment; canSwitch: boolean };

export type SwitchRecruitmentDeps = {
  /** Whether the caller may flip it; false when no one is signed in. */
  maySwitch: () => Promise<boolean>;
  /** Stores the new state, logged under the caller. */
  save: (recruitment: Recruitment) => Promise<void>;
  /** Drops the public pages' cached copy so they follow at once. */
  refresh: () => void;
};

export type SwitchRecruitmentResult =
  | { status: "switched"; recruitment: Recruitment }
  | { status: "refused" };

/** Sets the switch when the caller may; otherwise writes nothing. */
export async function switchRecruitment(
  recruitment: Recruitment,
  deps: SwitchRecruitmentDeps,
): Promise<SwitchRecruitmentResult> {
  if (!(await deps.maySwitch())) return { status: "refused" };
  await deps.save(recruitment);
  deps.refresh();
  return { status: "switched", recruitment };
}
