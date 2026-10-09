import { canReach } from "@/lib/dashboard/access";
import type { DashboardData, TeamWrites } from "@/lib/dashboard/data";
import {
  alumniDirectory,
  buildTeamTree,
  divisionDirectory,
  divisionIdOf,
  memberRowOf,
  teamDirectory,
  type AlumnusRow,
  type MemberEdit,
  type OrgChart,
  type Placement,
  type RosterEntry,
} from "@/lib/dashboard/team";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { cleanTitle, type TeamEdits } from "./edits";
import { alumni, departments, divisions, people, roster, type DummyPerson } from "./team";

// The test developer's Team pages (issue #143): the roster and alumni in
// ./team.ts with the test developer's own edits (./edits.ts) laid over them.

const org: OrgChart = { departments, divisions };

/** The person each viewer signs in as; the applicant is not on the team. */
const SELF_ID: Readonly<Record<ViewerKind, number | null>> = {
  "operations-lead": 1,
  "division-lead": 2,
  member: 5,
  "non-member": null,
};

function placementWith(placement: Placement, edit: MemberEdit | undefined): Placement {
  if (!edit) return placement;
  if (placement.role === "division-lead" || placement.role === "member") {
    if (placement.divisionId === null) return placement;
    return { role: edit.role, divisionId: placement.divisionId };
  }
  return placement;
}

function entryOf(person: DummyPerson, edit: MemberEdit | undefined): RosterEntry {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    placement: placementWith(person.placement, edit),
    pageTitle: edit ? edit.pageTitle : person.pageTitle,
    joined: Number(person.since.slice(0, 4)),
    program: person.program,
    study: person.study,
    access: person.access,
  };
}

/** This year's roster after the test developer's edits: moved people left out, saved drawers applied. */
export function editedRoster(edits: TeamEdits): RosterEntry[] {
  return people.filter((p) => edits.movedToAlumni[p.id] === undefined).map((p) => entryOf(p, edits.members[p.id]));
}

/** The alumni, those the test developer moved included, with their switches as flipped. */
export function editedAlumni(edits: TeamEdits): AlumnusRow[] {
  const moved = people.flatMap((p): AlumnusRow[] => {
    const leftIn = edits.movedToAlumni[p.id];
    if (leftIn === undefined) return [];
    const entry = entryOf(p, edits.members[p.id]);
    const row = memberRowOf(entry, org);
    const unit = row.department ?? "Board";
    return [{ id: p.id, name: p.name, lastRole: row.roleLabel, unit, department: unit, from: entry.joined, to: leftIn, shownOnSite: true }];
  });
  return [...alumni, ...moved].map((a) => ({ ...a, shownOnSite: edits.shownOnSite[a.id] ?? a.shownOnSite }));
}

/** Whether `kind` may change this person from the Members page: the whole team, or the lead's own division; never themselves. */
function mayEdit(kind: ViewerKind, entry: RosterEntry): boolean {
  if (!canReach(kind, "members") || entry.id === SELF_ID[kind]) return false;
  if (kind === "operations-lead") return true;
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine !== undefined && divisionIdOf(entry.placement) === divisionIdOf(mine.placement);
}

function writesFor(kind: ViewerKind, edits: TeamEdits, save: (next: TeamEdits) => Promise<void>): TeamWrites {
  const find = (id: number) => editedRoster(edits).find((e) => e.id === id);
  return {
    async setShownOnSite(alumnusId, shown) {
      if (!canReach(kind, "alumni") || !editedAlumni(edits).some((a) => a.id === alumnusId)) return false;
      await save({ ...edits, shownOnSite: { ...edits.shownOnSite, [alumnusId]: shown } });
      return true;
    },
    async saveMember(personId, edit) {
      const entry = find(personId);
      if (!entry || !mayEdit(kind, entry)) return false;
      const placed = divisionIdOf(entry.placement) !== null;
      if (!placed && edit.role !== "member") return false;
      if (entry.placement.role !== "division-lead" && entry.placement.role !== "member") return false;
      const next: MemberEdit = { role: edit.role, pageTitle: cleanTitle(edit.pageTitle) };
      await save({ ...edits, members: { ...edits.members, [personId]: next } });
      return true;
    },
    async moveToAlumni(personId) {
      const entry = find(personId);
      if (!entry || !mayEdit(kind, entry)) return false;
      await save({ ...edits, movedToAlumni: { ...edits.movedToAlumni, [personId]: new Date().getUTCFullYear() } });
      return true;
    },
  };
}

export function dummyTeamPages(
  kind: ViewerKind,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
): Pick<DashboardData, "members" | "alumni" | "teamTree" | "teamWrites"> {
  const self = SELF_ID[kind];
  return {
    members: async () => {
      const team = editedRoster(edits);
      if (kind === "operations-lead") return teamDirectory(team, org, self);
      const me = team.find((e) => e.id === self);
      const division = me ? divisionIdOf(me.placement) : null;
      if (kind !== "division-lead" || division === null) return { scope: "division", division: "", rows: [] };
      return divisionDirectory(team, org, division, self);
    },
    alumni: async () => alumniDirectory(canReach(kind, "alumni") ? editedAlumni(edits) : []),
    teamTree: async () =>
      buildTeamTree(canReach(kind, "team-tree") ? editedRoster(edits) : [], org, roster.season, self),
    teamWrites: writesFor(kind, edits, save),
  };
}
