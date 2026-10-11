import { canReach } from "@/lib/dashboard/access";
import { alumniMove, type MoveReach } from "@/lib/dashboard/alumni-move";
import { joinChange, memberStanding, NEW_APPLICANT, type ApplicantStanding, type LeadMove } from "@/lib/dashboard/application-flow";
import { DashboardRefused, type DashboardData, type TeamWrites } from "@/lib/dashboard/data";
import { promotedNotices, type DepartmentHeadRole } from "@/lib/dashboard/notices";
import {
  alumniDirectory,
  buildTeamTree,
  DIVISION_ROLE_OF,
  divisionDirectory,
  divisionLabel,
  homeDivision,
  homeDivisionOf,
  inDivisions,
  isIn,
  memberRowOf,
  membershipsIn,
  NO_DIVISION,
  placedWithRoleIn,
  roleIn,
  teamDirectory,
  withJoined,
  type AlumnusRow,
  type DivisionRole,
  type Joining,
  type OrgChart,
  type Placement,
  type RosterEntry,
} from "@/lib/dashboard/team";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { cleanTitle, type MemberChange, type TeamEdits } from "./edits";
import { withDummyNotices } from "./notices";
import { alumni, departments, divisions, DUMMY_NOW, people, positions, roster, type DummyPerson } from "./team";

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

/** The placement with each division role a saved change set; their other divisions as they were. */
function placementWith(placement: Placement, change: MemberChange | undefined): Placement {
  if (!change) return placement;
  return Object.entries(change.roles).reduce((p, [divisionId, role]) => placedWithRoleIn(p, Number(divisionId), role), placement);
}

function entryOf(person: DummyPerson, change: MemberChange | undefined): RosterEntry {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    placement: placementWith(person.placement, change),
    pageTitle: change ? change.pageTitle : person.pageTitle,
    joined: Number(person.since.slice(0, 4)),
    program: person.program,
    study: person.study,
    access: person.access,
  };
}

/**
 * Someone accepted for a position (board 59), waiting for Confirm join or
 * joined. The application's own state is the one record of it: as
 * `readJoining` (lib/dashboard/database-team.ts) does, every accepted
 * application waits, whether it started accepted or the test developer
 * accepted it on the Applications page, and Confirm join on either page
 * moves the application to Joined.
 */
export type DummyJoiner = Joining & {
  readonly email: string;
  readonly divisionId: number;
  readonly program: string;
  readonly study: string;
  /** The year Confirm join ran; null while they wait. */
  readonly joinedIn: number | null;
  /** The day Confirm join ran ("2026-10-09"); null while they wait. */
  readonly joinedOn: string | null;
};

/** Roster ids for people who joined from an application, clear of the people and alumni ids. */
const JOINER_ID_BASE = 100_000;

/** The accepted applicants waiting to join, and those who joined, from the applications as the test developer left them. */
export function dummyJoiners(current: readonly DummyApplication[]): DummyJoiner[] {
  return current.flatMap((a): DummyJoiner[] => {
    const waiting = a.state.stage === "accepted";
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
        joinedOn: a.state.stage === "joined" ? new Date(a.state.joinedAt).toISOString().slice(0, 10) : null,
      },
    ];
  });
}

function joinedEntry(joiner: DummyJoiner, year: number): RosterEntry {
  return {
    id: JOINER_ID_BASE + joiner.applicationId,
    name: joiner.name,
    email: joiner.email,
    placement: inDivisions([{ divisionId: joiner.divisionId, role: "member", since: `${year}-10-01` }]),
    pageTitle: joiner.position,
    joined: year,
    program: joiner.program,
    study: joiner.study,
    access: [],
  };
}

/**
 * Where an applicant with `email` stands with the dummy team, toward a
 * position in `divisionId`: on `team` by their email, or new. A member signed
 * the team's NDA in the year they joined.
 */
export function dummyStanding(email: string, divisionId: number, team: readonly RosterEntry[]): ApplicantStanding {
  const entry = team.find((e) => e.email === email);
  if (!entry) return NEW_APPLICANT;
  const memberships = membershipsIn(entry.placement);
  const home = homeDivision(memberships);
  const theirs = [...memberships]
    .sort((a, b) => Number(b.divisionId === home) - Number(a.divisionId === home))
    .flatMap((m) => {
      const division = divisions.find((d) => d.id === m.divisionId);
      return division ? [{ id: division.id, name: divisionLabel(division.name) }] : [];
    });
  return memberStanding(theirs, divisionId, entry.joined);
}

/**
 * This year's roster after the test developer's edits: moved people left
 * out, saved drawers and promotions applied, joined applicants added as
 * `joinChange` says: a new person as a new entry, someone already on the team
 * in the new division beside every one they were in (issue #229).
 */
export function editedRoster(edits: TeamEdits, joiners: readonly DummyJoiner[] = []): RosterEntry[] {
  const onTeam = people.map((p) => entryOf(p, edits.members[p.id]));
  const added: RosterEntry[] = [];
  const joinedTeam = onTeam.map((entry): RosterEntry => {
    if (entry.placement.role !== "divisions") return entry;
    const memberships = joiners.reduce(
      (ms, j) => (j.joinedOn !== null && j.email === entry.email ? withJoined(ms, j.divisionId, j.joinedOn) : ms),
      entry.placement.memberships,
    );
    return { ...entry, placement: { role: "divisions", memberships } };
  });
  for (const j of joiners) {
    if (j.joinedIn === null) continue;
    if (joinChange(dummyStanding(j.email, j.divisionId, onTeam)) === "new-member") added.push(joinedEntry(j, j.joinedIn));
  }
  return [...joinedTeam, ...added].filter((e) => edits.movedToAlumni[e.id] === undefined);
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
  const division = myDivision(kind);
  return division !== null && isIn(entry.placement, division);
}

/** The division a division lead leads; null for every other viewer. */
function myDivision(kind: ViewerKind): number | null {
  if (kind !== "division-lead") return null;
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine ? homeDivisionOf(mine.placement) : null;
}

/** The division a drawer's role change is about: the lead's own, or the person's home division for the operations lead. */
function drawerDivision(kind: ViewerKind, entry: RosterEntry): number | null {
  return kind === "division-lead" ? myDivision(kind) : homeDivisionOf(entry.placement);
}

/** What `kind`'s Move to alumni reaches: the whole team for the operations lead, their division for a division lead. */
function moveReach(kind: ViewerKind): MoveReach | null {
  if (kind === "operations-lead") return { kind: "team" };
  const division = myDivision(kind);
  return division === null ? null : { kind: "division", divisionId: division };
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
      const division = drawerDivision(kind, entry);
      // The drawer sets the role in one division; a seat or head, or someone in no division, has none to set.
      if (edit.role !== null && (division === null || !isIn(entry.placement, division))) return false;
      const before = edits.members[personId]?.roles ?? {};
      const next: MemberChange = {
        pageTitle: cleanTitle(edit.pageTitle),
        roles: edit.role === null || division === null ? before : { ...before, [division]: DIVISION_ROLE_OF[edit.role] },
      };
      await save({ ...edits, members: { ...edits.members, [personId]: next } });
      return true;
    },
    async promote(personId, mode) {
      const entry = find(personId);
      const self = find(SELF_ID[kind] ?? -1);
      const divisionId = myDivision(kind);
      if (kind !== "division-lead" || !entry || !self || divisionId === null || !mayEdit(kind, entry)) return false;
      if (roleIn(membershipsIn(entry.placement), divisionId) !== "member") return false;
      const division = divisions.find((d) => d.id === divisionId);
      if (!division) return false;
      // Only this division changes for either of them (`withRoleIn`); their other divisions stay.
      const roleChange = (who: RosterEntry, role: DivisionRole): MemberChange => ({
        pageTitle: who.pageTitle,
        roles: { ...(edits.members[who.id]?.roles ?? {}), [divisionId]: role },
      });
      const members = { ...edits.members, [personId]: roleChange(entry, "lead") };
      if (mode === "hand-over") members[self.id] = roleChange(self, "member");
      // As the database does: the heads of the division's department are told (#188).
      const heads = team.flatMap((e): DepartmentHeadRole[] =>
        e.placement.role === "head" ? [{ memberId: e.id, departmentId: e.placement.departmentId }] : [],
      );
      const told = promotedNotices(
        { personId, division: { name: division.name, departmentId: division.departmentId }, mode, lead: { id: self.id, name: self.name } },
        heads,
      );
      await save({ ...edits, members, notices: withDummyNotices(edits.notices, told, entry.name, DUMMY_NOW) });
      return true;
    },
    async moveToAlumni(personId, departure) {
      const entry = find(personId);
      // Only people on the dummy roster have an Alumni row to move to.
      if (!entry || !mayEdit(kind, entry) || !people.some((p) => p.id === personId)) return false;
      if (departure.from > departure.to || departure.to > thisYear) return false;
      // The rule the database follows (alumni-move.ts), over every division they
      // are in. A move that would leave them a role elsewhere has no dummy form
      // (the edits keep no ended role), so it is refused.
      const reach = moveReach(kind);
      const memberships = membershipsIn(entry.placement);
      const roles: { divisionId: number | null }[] =
        memberships.length === 0 ? [{ divisionId: null }] : memberships.map((m) => ({ divisionId: m.divisionId }));
      const move = reach && alumniMove(roles, reach);
      if (!move || !move.leavesTeam) return false;
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
      // As the database lists them (`readJoining`): people not on the team yet. A
      // member joins from the Applications page (board 58h2) until #231.
      const joining = joiners.filter(
        (j) => j.divisionId === division && j.joinedIn === null && dummyStanding(j.email, j.divisionId, team).kind !== "member",
      );
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
