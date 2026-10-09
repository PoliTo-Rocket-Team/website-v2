import type { ScopeInfo } from "@/app/actions/get-member-scopes";
import type { Recruitment } from "./positions";

// The site-wide recruitment switch on the dashboard (issue #121). Only an
// org-wide positions editor, or an admin, may flip it: a lead's edit rights
// on one department or division do not reach the whole site. The database,
// the cache and the caller's scope are passed in, so the rule is tested
// without them (recruitment-switch.test.ts).

/** Whether a member with this positions scope may flip the switch. */
export function canSwitchRecruitment(scope: ScopeInfo): boolean {
  return scope.hasOrgEdit || scope.hasAdminEdit;
}

/** What the dashboard shows: the switch's state and whether this member may change it. */
export type RecruitmentControl = { recruitment: Recruitment; canSwitch: boolean };

export type SwitchRecruitmentDeps = {
  /** The caller's positions scope; the empty scope when no one is signed in. */
  scope: () => Promise<ScopeInfo>;
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
  if (!canSwitchRecruitment(await deps.scope())) return { status: "refused" };
  await deps.save(recruitment);
  deps.refresh();
  return { status: "switched", recruitment };
}
