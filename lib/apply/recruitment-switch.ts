import type { ViewerStanding } from "@/lib/dashboard/viewer";
import type { Recruitment } from "./positions";

// The site-wide recruitment switch on the dashboard (issue #121). Full access
// includes it (Owner decision, issue #621): every full-access seat (the team
// leader, the operations lead, the IT lead, the Project Manager and the Chief
// Engineer) and full access from an org or admin scope row may flip it, from
// the standing alone, with no positions grant. Nobody else may: a lead's or a
// head's rights, or an area grant, on one department or division do not reach
// the whole site. The permission, the store and the cache are passed in, so
// the rule is tested without them (recruitment-switch.test.ts). The dashboard
// data interface supplies them from the caller's standing.

/**
 * Whether a member with this standing may flip the switch: full access, the
 * `operations-lead` kind, and no one else. Someone off the team never may,
 * whatever scope rows outlived their roles (issues #201, #477).
 */
export function canSwitchRecruitment(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead";
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
