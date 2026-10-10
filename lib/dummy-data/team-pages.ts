import { canReach } from "@/lib/dashboard/access";
import { joinChange, type LeadMove } from "@/lib/dashboard/application-flow";
import { DashboardRefused, type DashboardData, type TeamWrites } from "@/lib/dashboard/data";
import {
  alumniDirectory,
  buildTeamTree,
  divisionDirectory,
  divisionIdOf,
  memberRowOf,
  NO_DIVISION,
  teamDirectory,
  type AlumnusRow,
  type Joining,
  type MemberEdit,
  type OrgChart,
  type Placement,
  type RosterEntry,
} from "@/lib/dashboard/team";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { cleanTitle, type TeamEdits } from "./edits";
import { alumni, departments, divisions, people, positions, roster, type DummyPerson } from "./team";

// The test developer's Team pages (issues #143 and #172): the roster and
// alumni in ./team.ts with the test developer's own edits (./edits.ts) laid
// over them, and the people accepted for a position joining it.

const org: OrgChart = { departments, divisions };

/** The person each viewer signs in as; the applicant is not on the team. */
const SELF_ID: Readonly<Record<ViewerKind, number | null>> = {
  "operations-lead": 1,
  "division-lead": 2,
  member: 5,
  "non-member": null,
};

function placementWith(placement: Placement, edit: MemberEdit | undefined): Placement {
  if (!edit || edit.role === null) return placement;
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

/**
 * Someone accepted for a position (board 59), waiting for Confirm join or
 * joined. The application's own state is the one record of it: the dummy
 * team has one waiting from the start, for Mission Analyst; an application
 * the test developer accepts on the Applications page waits too, and Confirm
 * join on either page moves the application to Joined.
 */
export type DummyJoiner = Joining & {
  readonly email: string;
  readonly divisionId: number;
  readonly program: string;
  readonly study: string;
  /** The year Confirm join ran; null while they wait. */
  readonly joinedIn: number | null;
};

/** The accepted Mission Analyst applicant who is waiting for their NDA when the dummy team starts. */
const WAITING_FROM_THE_START = baseApplications.find((a) => a.positionId === 1 && a.state.stage === "accepted")!.id;

/** Roster ids for people who joined from an application, clear of the people and alumni ids. */
const JOINER_ID_BASE = 100_000;

/** The accepted applicants waiting to join, and those who joined, from the applications as the test developer left them. */
export function dummyJoiners(current: readonly DummyApplication[]): DummyJoiner[] {
  return current.flatMap((a): DummyJoiner[] => {
    const base = baseApplications.find((b) => b.id === a.id);
    const waiting = a.state.stage === "accepted" && (a.id === WAITING_FROM_THE_START || base?.state.stage !== "accepted");
    const joined = a.state.stage === "joined";
    const position = positions.find((p) => p.id === a.positionId);
    if ((!waiting && !joined) || !position) return [];
    return [
      {
        applicationId: a.id,
        name: a.applicant.name,
        position: position.title,
        ndaArrived: a.state.stage === "accepted" ? a.state.ndaArrived : true,
        email: a.applicant.email,
        divisionId: position.divisionId,
        program: a.applicant.degree,
        study: a.applicant.year,
        joinedIn: a.state.stage === "joined" ? new Date(a.state.joinedAt).getUTCFullYear() : null,
      },
    ];
  });
}

function joinedEntry(joiner: DummyJoiner, year: number): RosterEntry {
  return {
    id: JOINER_ID_BASE + joiner.applicationId,
    name: joiner.name,
    email: joiner.email,
    placement: { role: "member", divisionId: joiner.divisionId },
    pageTitle: joiner.position,
    joined: year,
    program: joiner.program,
    study: joiner.study,
    access: [],
  };
}

/**
 * This year's roster after the test developer's edits: moved people left
 * out, saved drawers and promotions applied, joined applicants added as
 * `joinChange` says (someone already on the team gets no second place).
 */
export function editedRoster(edits: TeamEdits, joiners: readonly DummyJoiner[] = []): RosterEntry[] {
  const onTeam = people.map((p) => entryOf(p, edits.members[p.id]));
  const joined = joiners.flatMap((j) => {
    if (j.joinedIn === null) return [];
    const membership = onTeam.some((e) => e.email === j.email) ? "member" : "applicant";
    return joinChange(membership) === "nothing" ? [] : [joinedEntry(j, j.joinedIn)];
  });
  return [...onTeam, ...joined].filter((e) => edits.movedToAlumni[e.id] === undefined);
}

/** The alumni, those the test developer moved included, with their switches as flipped. */
export function editedAlumni(edits: TeamEdits): AlumnusRow[] {
  const moved = people.flatMap((p): AlumnusRow[] => {
    const departure = edits.movedToAlumni[p.id];
    if (departure === undefined) return [];
    const row = memberRowOf(entryOf(p, edits.members[p.id]), org);
    const unit = row.department ?? "Board";
    return [{ id: p.id, name: p.name, lastRole: row.roleLabel, unit, department: unit, from: departure.from, to: departure.to, shownOnSite: true }];
  });
  return [...alumni, ...moved].map((a) => ({ ...a, shownOnSite: edits.shownOnSite[a.id] ?? a.shownOnSite }));
}

/** Whether `kind` may change this person from the Members page: the whole team, or the lead's own division; never themselves. */
function mayEdit(kind: ViewerKind, entry: RosterEntry): boolean {
  if (!canReach(kind, "members") || entry.id === SELF_ID[kind]) return false;
  if (kind === "operations-lead") return true;
  return kind === "division-lead" && divisionIdOf(entry.placement) === myDivision(kind);
}

/** The division a division lead leads; null for every other viewer. */
function myDivision(kind: ViewerKind): number | null {
  if (kind !== "division-lead") return null;
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine ? divisionIdOf(mine.placement) : null;
}

/** The Applications page's move, as the dummy dashboard runs it: Confirm join on the Members page is that move. */
export type DummyMove = (applicationId: number, move: LeadMove) => Promise<WriteResult<null>>;

/** Without the Applications page's store nothing moves. */
const NO_MOVE: DummyMove = async () => ({ ok: false, error: "Nothing to move." });

function writesFor(
  kind: ViewerKind,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
  joiners: readonly DummyJoiner[],
  move: DummyMove,
): TeamWrites {
  const team = editedRoster(edits, joiners);
  const find = (id: number) => team.find((e) => e.id === id);
  const thisYear = new Date().getUTCFullYear();
  return {
    async setShownOnSite(alumnusId, shown) {
      if (!canReach(kind, "alumni") || !editedAlumni(edits).some((a) => a.id === alumnusId)) return false;
      await save({ ...edits, shownOnSite: { ...edits.shownOnSite, [alumnusId]: shown } });
      return true;
    },
    async saveMember(personId, edit) {
      const entry = find(personId);
      if (!entry || !mayEdit(kind, entry)) return false;
      if (edit.role !== null) {
        const ownRole = entry.placement.role === "division-lead" || entry.placement.role === "member";
        if (!ownRole || divisionIdOf(entry.placement) === null) return false;
      }
      const next: MemberEdit = { role: edit.role, pageTitle: cleanTitle(edit.pageTitle) };
      await save({ ...edits, members: { ...edits.members, [personId]: next } });
      return true;
    },
    async promote(personId, mode) {
      const entry = find(personId);
      const self = find(SELF_ID[kind] ?? -1);
      if (kind !== "division-lead" || !entry || !self || !mayEdit(kind, entry) || entry.placement.role !== "member") return false;
      const members = { ...edits.members, [personId]: { role: "division-lead" as const, pageTitle: entry.pageTitle } };
      if (mode === "hand-over") members[self.id] = { role: "member", pageTitle: self.pageTitle };
      await save({ ...edits, members });
      return true;
    },
    async moveToAlumni(personId, departure) {
      const entry = find(personId);
      // Only people on the dummy roster have an Alumni row to move to.
      if (!entry || !mayEdit(kind, entry) || !people.some((p) => p.id === personId)) return false;
      if (departure.from > departure.to || departure.to > thisYear) return false;
      await save({ ...edits, movedToAlumni: { ...edits.movedToAlumni, [personId]: departure } });
      return true;
    },
    async confirmJoin(applicationId) {
      const joiner = joiners.find((j) => j.applicationId === applicationId);
      if (!joiner || joiner.divisionId !== myDivision(kind) || joiner.joinedIn !== null) return false;
      try {
        return (await move(applicationId, { kind: "confirm-join" })).ok;
      } catch (error) {
        if (error instanceof DashboardRefused) return false;
        throw error;
      }
    },
  };
}

/**
 * The Team pages as `kind` sees them, with `edits` laid over the arrays,
 * `current` the applications as the test developer left them and `move` the
 * Applications page's move, which Confirm join runs.
 */
export function dummyTeamPages(
  kind: ViewerKind,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
  current: readonly DummyApplication[] = baseApplications,
  move: DummyMove = NO_MOVE,
): Pick<DashboardData, "members" | "alumni" | "teamTree" | "teamWrites"> {
  const self = SELF_ID[kind];
  const joiners = dummyJoiners(current);
  return {
    members: async () => {
      const team = editedRoster(edits, joiners);
      if (kind === "operations-lead") return teamDirectory(team, org, self);
      const division = myDivision(kind);
      if (division === null) return NO_DIVISION;
      const joining = joiners.filter((j) => j.divisionId === division && j.joinedIn === null);
      return divisionDirectory(
        team,
        org,
        division,
        self,
        joining.map(({ applicationId, name, position, ndaArrived }) => ({ applicationId, name, position, ndaArrived })),
      );
    },
    alumni: async () => alumniDirectory(canReach(kind, "alumni") ? editedAlumni(edits) : []),
    teamTree: async () =>
      buildTeamTree(canReach(kind, "team-tree") ? editedRoster(edits, joiners) : [], org, roster.season, self),
    teamWrites: writesFor(kind, edits, save, joiners, move),
  };
}
