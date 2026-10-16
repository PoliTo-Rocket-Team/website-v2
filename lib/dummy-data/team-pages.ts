import { canReach } from "@/lib/dashboard/access";
import { alumniMove } from "@/lib/dashboard/alumni-move";
import { joinChange, memberStanding, NEW_APPLICANT, type ApplicantStanding, type LeadMove } from "@/lib/dashboard/application-flow";
import { DashboardRefused, type DashboardData, type TeamWrites } from "@/lib/dashboard/data";
import { departmentMembers } from "@/lib/dashboard/department-members";
import {
  checkDepartmentClose,
  checkDepartmentCreate,
  checkDepartmentSave,
  planDepartmentClose,
  planDepartmentCreate,
  planDepartmentSave,
} from "@/lib/dashboard/department-edit";
import {
  checkDivisionSave,
  closeRefusal,
  planDivisionSave,
  searchTeam,
  type DivisionPlan,
  type DivisionSubject,
  type TeamPerson,
} from "@/lib/dashboard/division-edit";
import { NO_MEMBER_DETAILS } from "@/lib/dashboard/details";
import {
  addOutcome,
  checkAddMember,
  checkMemberEdit,
  checkMemberPhoto,
  divisionMembers,
  lookupForAdd,
  signInEmailOf,
  type AddStanding,
  type PersonRecord,
  type TeamCandidate,
  type WaitingPerson,
} from "@/lib/dashboard/division-members";
import {
  alumniDirectory,
  buildTeamTree,
  DIVISION_ROLE_OF,
  homeDivision,
  homeDivisionOf,
  inDivisions,
  isIn,
  mayChangeDivision,
  mayLeaveTeam,
  memberRowOf,
  membershipsIn,
  NO_MEMBERS,
  placedWithRoleIn,
  reachesDivision,
  removalFrom,
  roleIn,
  standingOfPlacement,
  teamDirectory,
  withJoined,
  withoutDivision,
  type AlumnusRow,
  type DivisionRole,
  type Joining,
  type OrgChart,
  type OrgDepartment,
  type OrgDivision,
  type Placement,
  type RosterEntry,
  type TeamActor,
} from "@/lib/dashboard/team";
import { editableDivisionIds, teamStructure } from "@/lib/dashboard/team-structure";
import { testDeveloperStanding, type ViewerKind } from "@/lib/dashboard/viewer";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { cleanTitle, detailsKey, type MemberChange, type TeamEdits } from "./edits";
import { dummyMemberDetails, dummyNda, dummySignInEmail } from "./members";
import { alumni, closedDivisions, departments, divisions, DUMMY_NOW, people, positions, roster, waitingPeople, type DummyPerson, type DummyWaiting } from "./team";

// The test developer's Team pages (issues #143, #172 and #231): the roster
// and alumni in ./team.ts with the test developer's own edits (./edits.ts)
// laid over them, the people accepted for a position joining it, and the
// people added by email waiting for Confirm NDA.

/** A division with the day it closed, or null while it is open. */
type DummyDivisionState = OrgDivision & { readonly closedOn: string | null };

/** A department with the day it closed, or null while it is open. */
type DummyDepartmentState = OrgDepartment & { readonly closedOn: string | null };

/** A closed division, with the department it was closed in: its positions are closed and its access is gone. */
export type DummyClosedDivision = {
  readonly id: number;
  readonly name: string;
  readonly code: string | null;
  readonly closedOn: string;
  readonly departmentId: number;
};

/**
 * Every department as the test developer left it: the ones ./team.ts starts
 * with and the ones they created, each edit in its place (issue #251).
 */
function departmentStates(edits: TeamEdits): DummyDepartmentState[] {
  const all = new Map<number, DummyDepartmentState>();
  for (const d of departments) all.set(d.id, { ...d, closedOn: null });
  for (const [id, edit] of Object.entries(edits.departments)) all.set(Number(id), { id: Number(id), name: edit.name, code: edit.code, closedOn: edit.closedOn });
  return [...all.values()].sort((a, b) => a.id - b.id);
}

/**
 * The open chart and the closed divisions as the test developer left them:
 * the departments and divisions ./team.ts starts with, open and closed, with
 * each department and division they created, edited, moved or closed (issues
 * #232, #251) in its place.
 */
export function dummyOrg(edits: TeamEdits): { readonly org: OrgChart; readonly closed: readonly DummyClosedDivision[] } {
  const all = new Map<number, DummyDivisionState>();
  for (const d of divisions) all.set(d.id, { ...d, closedOn: null });
  for (const d of closedDivisions) all.set(d.id, d);
  for (const [id, edit] of Object.entries(edits.divisions)) all.set(Number(id), { id: Number(id), ...edit });
  const known = departmentStates(edits);
  const states = [...all.values()].filter((d) => known.some((x) => x.id === d.departmentId)).sort((a, b) => a.id - b.id);
  return {
    org: {
      departments: known.flatMap(({ closedOn, ...d }) => (closedOn === null ? [d] : [])),
      divisions: states.flatMap(({ closedOn, ...d }) => (closedOn === null ? [d] : [])),
    },
    closed: states
      .flatMap((d) => (d.closedOn === null ? [] : [{ id: d.id, name: d.name, code: d.code ?? null, closedOn: d.closedOn, departmentId: d.departmentId }]))
      .sort((a, b) => b.closedOn.localeCompare(a.closedOn) || a.id - b.id),
  };
}

/** The person each viewer signs in as; the applicant is not on the team. */
const SELF_ID: Readonly<Record<ViewerKind, number | null>> = {
  "operations-lead": 1,
  "department-head": 15,
  "division-lead": 2,
  member: 5,
  "non-member": null,
};

/** The day the dummy team's writes happen on: the dummy team is seen from DUMMY_NOW. */
const TODAY = DUMMY_NOW.slice(0, 10);

/**
 * The placement with each saved change: roles set, divisions joined and left;
 * every other division as it was, and a seat or a head kept (a seat picked to
 * lead a division joins it beside the seat, #232).
 */
function placementWith(placement: Placement, change: MemberChange | undefined): Placement {
  if (!change) return placement;
  const joined = Object.entries(change.joined ?? {}).reduce(
    (ms, [divisionId, since]) => withJoined(ms, Number(divisionId), since),
    placement.memberships,
  );
  const left = (change.left ?? []).reduce((ms, divisionId) => withoutDivision(ms, divisionId), joined);
  return Object.entries(change.roles).reduce(
    (p, [divisionId, role]) => placedWithRoleIn(p, Number(divisionId), role),
    { ...placement, memberships: left },
  );
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

/** Roster ids for people added by email whose NDA was confirmed (issue #231). */
const ADDED_ID_BASE = 200_000;

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

/** Everyone added by email, the ones ./team.ts starts with and the test developer's own, less any add cancelled. */
function addedPeople(edits: TeamEdits): DummyWaiting[] {
  return [...waitingPeople, ...edits.added].filter((a) => !edits.cancelled.includes(a.joinId));
}

function addedName(added: DummyWaiting): string {
  return `${added.firstName} ${added.lastName}`.trim() || added.email;
}

/** Someone added by email whose NDA was confirmed: a member of the division they were added to, from that day. */
function confirmedEntry(added: DummyWaiting, on: string): RosterEntry {
  return {
    id: ADDED_ID_BASE + added.joinId,
    name: addedName(added),
    email: added.email,
    placement: inDivisions([{ divisionId: added.divisionId, role: "member", since: on }]),
    pageTitle: added.title,
    joined: Number(on.slice(0, 4)),
    program: null,
    study: null,
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
  const nameOf = (id: number) => divisions.find((d) => d.id === id)?.name;
  return memberStanding(membershipsIn(entry.placement), nameOf, divisionId, entry.joined);
}

/**
 * This year's roster after the test developer's edits: moved people left
 * out, saved drawers and promotions applied, divisions joined and left from
 * the Members page, joined applicants added as `joinChange` says (a new person
 * as a new entry, someone already on the team in the new division beside every
 * one they were in, issue #229), and people added by email once their NDA was
 * confirmed (issue #231).
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
  const confirmed = addedPeople(edits).flatMap((a) => {
    const confirmation = edits.confirmed[a.joinId];
    return confirmation ? [entryWithChanges(confirmedEntry(a, confirmation.on), edits.members[ADDED_ID_BASE + a.joinId])] : [];
  });
  return [...joinedTeam, ...added, ...confirmed].filter((e) => edits.movedToAlumni[e.id] === undefined).map((e) => withDepartmentSeat(e, edits));
}

function entryWithChanges(entry: RosterEntry, change: MemberChange | undefined): RosterEntry {
  return { ...entry, placement: placementWith(entry.placement, change) };
}

/**
 * The seat New department and Close department changed (issue #251): the
 * head New department picked heads it, keeping their divisions; the head of a
 * closed department holds that seat no more and stays on the team in every
 * division they are in (none, for someone who was only its head: on the
 * roster, not placed). Nobody moves to Alumni.
 */
function withDepartmentSeat(entry: RosterEntry, edits: TeamEdits): RosterEntry {
  const { placement } = entry;
  const headed = Object.entries(edits.departments).find(([, d]) => d.headId === entry.id && d.closedOn === null);
  if (headed && placement.role === "divisions") return { ...entry, placement: { role: "head", departmentId: Number(headed[0]), memberships: placement.memberships } };
  if (placement.role === "head" && (edits.departments[placement.departmentId]?.closedOn ?? null) !== null) {
    return { ...entry, placement: { role: "divisions", memberships: placement.memberships } };
  }
  return entry;
}

/** The alumni, those the test developer moved included, with their switches as flipped. */
export function editedAlumni(edits: TeamEdits): AlumnusRow[] {
  const moved = people.flatMap((p): AlumnusRow[] => {
    const departure = edits.movedToAlumni[p.id];
    if (departure === undefined) return [];
    const row = memberRowOf(entryOf(p, edits.members[p.id]), dummyOrg(edits).org);
    const unit = row.department ?? "Board";
    return [{ id: p.id, name: p.name, lastRole: row.roleLabel, unit, department: unit, from: departure.from, to: departure.to, shownOnSite: true }];
  });
  return [...alumni, ...moved].map((a) => ({ ...a, shownOnSite: edits.shownOnSite[a.id] ?? a.shownOnSite }));
}

/** The division a division lead leads; null for every other viewer. */
function myDivision(kind: ViewerKind): number | null {
  if (kind !== "division-lead") return null;
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine ? homeDivisionOf(mine.placement) : null;
}

/** The department the department head heads; null for every other viewer. */
function myDepartment(kind: ViewerKind): number | null {
  if (kind !== "department-head") return null;
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine?.placement.role === "head" ? mine.placement.departmentId : null;
}

/**
 * Who `kind` acts as on the Members page: the operations lead reaches the
 * team, a department head their department (issue #235), a division lead
 * their division; nobody else acts there.
 */
function actorOf(kind: ViewerKind): TeamActor | null {
  if (!canReach(testDeveloperStanding(kind), "members")) return null;
  if (kind === "operations-lead") return { kind: "team" };
  const department = myDepartment(kind);
  if (department !== null) return { kind: "head", departmentIds: [department] };
  const division = myDivision(kind);
  return division === null ? null : { kind: "lead", divisionIds: [division] };
}

/** Whether `kind` may change this person from the Members page: the whole team, or the lead's own division; never themselves. */
function mayEdit(kind: ViewerKind, entry: RosterEntry): boolean {
  if (!canReach(testDeveloperStanding(kind), "members") || entry.id === SELF_ID[kind]) return false;
  if (kind === "operations-lead") return true;
  const division = myDivision(kind);
  return division !== null && isIn(entry.placement, division);
}

/** The division a drawer's role change is about: the lead's own, or the person's home division for the operations lead. */
function drawerDivision(kind: ViewerKind, entry: RosterEntry): number | null {
  return kind === "division-lead" ? myDivision(kind) : homeDivisionOf(entry.placement);
}

/** One roster entry as the Members page shows it, with the details and titles the test developer saved. */
function recordOf(entry: RosterEntry, edits: TeamEdits): PersonRecord {
  const person = people.find((p) => p.id === entry.id);
  const added = addedPeople(edits).find((a) => ADDED_ID_BASE + a.joinId === entry.id);
  const memberships = membershipsIn(entry.placement);
  const home = homeDivision(memberships);
  const saved = edits.members[entry.id]?.titles ?? {};
  const titles: Record<number, string | null> = {};
  for (const m of memberships) {
    titles[m.divisionId] =
      m.divisionId in saved ? saved[m.divisionId] : m.divisionId === home ? entry.pageTitle : (person?.titles[m.divisionId] ?? null);
  }
  const savedDetails = edits.details[detailsKey({ kind: "person", id: entry.id })];
  const addedDetails = added ? edits.details[detailsKey({ kind: "waiting", joinId: added.joinId })] : undefined;
  const confirmation = added ? edits.confirmed[added.joinId] : undefined;
  const confirmer = confirmation ? people.find((p) => p.id === confirmation.by)?.name ?? null : null;
  return {
    id: entry.id,
    name: entry.name,
    signInEmail: person ? dummySignInEmail(person) : entry.email,
    photoUrl: null,
    since: entry.joined,
    memberships,
    beyondDivisions: standingOfPlacement(entry.placement).beyond,
    titles,
    details: savedDetails ?? addedDetails ?? (person ? dummyMemberDetails(person) : NO_MEMBER_DETAILS),
    nda: person ? dummyNda(person) : confirmation ? { signedOn: confirmation.on, confirmedBy: confirmer } : null,
  };
}

/** The people added by email to `divisionId` and not confirmed yet. */
function waitingIn(edits: TeamEdits, divisionId: number): WaitingPerson[] {
  return addedPeople(edits)
    .filter((a) => a.divisionId === divisionId && edits.confirmed[a.joinId] === undefined)
    .map((a) => ({
      joinId: a.joinId,
      email: a.email,
      name: `${a.firstName} ${a.lastName}`.trim() || null,
      title: a.title,
      details: edits.details[detailsKey({ kind: "waiting", joinId: a.joinId })] ?? NO_MEMBER_DETAILS,
    }));
}

/** Every address a team member is found by in Add member: the one they sign in with, and their team address. */
function candidateOf(entry: RosterEntry, edits: TeamEdits): TeamCandidate {
  const record = recordOf(entry, edits);
  const emails = [...new Set([record.signInEmail, entry.email, record.details.prtEmail].filter((e) => e !== ""))];
  return { id: entry.id, name: entry.name, emails, memberships: record.memberships };
}

/** Everyone on the team as the division rules read them (lib/dashboard/division-edit.ts). */
function teamPeople(team: readonly RosterEntry[], edits: TeamEdits): TeamPerson[] {
  return team.map((entry) => {
    const candidate = candidateOf(entry, edits);
    return { id: entry.id, name: entry.name, emails: candidate.emails, memberships: candidate.memberships, beyond: standingOfPlacement(entry.placement).beyond };
  });
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
  const { org, closed } = dummyOrg(edits);
  const find = (id: number) => team.find((e) => e.id === id);
  const thisYear = new Date().getUTCFullYear();
  const actor = actorOf(kind);
  const changeOf = (id: number): MemberChange => edits.members[id] ?? { pageTitle: find(id)?.pageTitle ?? null, roles: {} };
  const withChange = (id: number, change: MemberChange): TeamEdits => ({ ...edits, members: { ...edits.members, [id]: change } });
  /** Someone in a division the actor reaches, never the actor. */
  const inReach = (personId: number, divisionId: number) => {
    const entry = find(personId);
    if (!entry || actor === null || entry.id === SELF_ID[kind] || !reachesDivision(actor, divisionId, org)) return null;
    return isIn(entry.placement, divisionId) ? entry : null;
  };

  /**
   * A checked division save (#232), laid over the edits in one save: the
   * division as it now reads, each lead and member change in that division
   * only, the old leads who leave the team moved to Alumni, and the emails
   * new to the team waiting for Confirm NDA.
   */
  const applyPlan = async (divisionId: number, departmentId: number, plan: DivisionPlan): Promise<WriteResult<null>> => {
    let next: TeamEdits = { ...edits, divisions: { ...edits.divisions, [divisionId]: { name: plan.name, code: plan.code, departmentId, closedOn: null } } };
    const change = (id: number, edit: (c: MemberChange) => MemberChange) => {
      next = { ...next, members: { ...next.members, [id]: edit(next.members[id] ?? changeOf(id)) } };
    };
    const setRole =
      (role: DivisionRole) =>
      (c: MemberChange): MemberChange => ({ ...c, roles: { ...c.roles, [divisionId]: role } });
    const join =
      (role: DivisionRole) =>
      (c: MemberChange): MemberChange => ({
        ...setRole(role)(c),
        joined: { ...c.joined, [divisionId]: TODAY },
        left: (c.left ?? []).filter((d) => d !== divisionId),
      });
    const leave = (c: MemberChange): MemberChange => {
      const joined = { ...c.joined };
      delete joined[divisionId];
      return { ...c, joined, left: [...(c.left ?? []), divisionId] };
    };
    plan.promote.forEach((id) => change(id, setRole("lead")));
    plan.joinAsLead.forEach((id) => change(id, join("lead")));
    plan.joinAsMember.forEach((id) => change(id, join("member")));
    plan.demote.forEach((id) => change(id, setRole("member")));
    plan.leaveDivision.forEach((id) => change(id, leave));
    for (const id of plan.leaveTeam) {
      const person = people.find((p) => p.id === id);
      // Only people on the dummy roster have an Alumni row to move to, as in Leaves the team.
      if (!person) return refused(`${find(id)?.name ?? "They"} cannot be moved to Alumni in this preview.`);
      const departure = { from: Number(person.since.slice(0, 4)), to: Number(TODAY.slice(0, 4)), reason: null };
      next = { ...next, movedToAlumni: { ...next.movedToAlumni, [id]: departure } };
    }
    // A cancelled add's join id is never given out again, as in Add member.
    const firstJoinId = Math.max(99, ...addedPeople(edits).map((a) => a.joinId), ...edits.cancelled) + 1;
    const added = plan.emails.map((email, i): DummyWaiting => ({ joinId: firstJoinId + i, email, firstName: "", lastName: "", divisionId, title: null }));
    if (added.length > 0) next = { ...next, added: [...next.added, ...added] };
    await save(next);
    return written(null);
  };

  /** The division a save is about: open on the chart. A closed one is none, so no save opens it again (#251). */
  const subjectOf = (divisionId: number): Exclude<DivisionSubject, { kind: "new" }> | null => {
    const open = org.divisions.find((d) => d.id === divisionId);
    return open ? { kind: "open", division: open } : null;
  };

  /** People in each division and people waiting for their NDA there: Close division and Close department refuse while any are. */
  const inIt = (divisionId: number) => team.filter((e) => isIn(e.placement, divisionId)).length + waitingIn(edits, divisionId).length;

  /** The department as the edits keep it, before this write. */
  const departmentEdit = (departmentId: number) => {
    const department = org.departments.find((d) => d.id === departmentId)!;
    return edits.departments[departmentId] ?? { name: department.name, code: department.code ?? null, closedOn: null, headId: null };
  };

  return {
    async createDivision(departmentId, input) {
      if (actor === null) return refused("Only a department head or the team leader creates a division.");
      const checked = checkDivisionSave(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planDivisionSave({ actor, org, subject: { kind: "new", departmentId }, save: checked.value, team: teamPeople(team, edits) });
      if (!planned.ok) return refused(planned.error);
      const id = Math.max(999, ...org.divisions.map((d) => d.id), ...closed.map((d) => d.id)) + 1;
      const result = await applyPlan(id, departmentId, planned.plan);
      return result.ok ? written(id) : result;
    },
    async saveDivision(divisionId, input) {
      const subject = subjectOf(divisionId);
      if (actor === null || subject === null) return refused("That division is not one you manage.");
      const checked = checkDivisionSave(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planDivisionSave({ actor, org, subject, save: checked.value, team: teamPeople(team, edits) });
      if (!planned.ok) return refused(planned.error);
      return applyPlan(divisionId, subject.division.departmentId, planned.plan);
    },
    async closeDivision(divisionId) {
      if (actor === null) return refused("Only a department head or the team leader closes a division.");
      const counted = { people: team.filter((e) => isIn(e.placement, divisionId)).length, waiting: waitingIn(edits, divisionId).length };
      const refusal = closeRefusal(actor, org, divisionId, counted);
      if (refusal !== null) return refused(refusal);
      const division = org.divisions.find((d) => d.id === divisionId)!;
      await save({
        ...edits,
        divisions: {
          ...edits.divisions,
          [divisionId]: { name: division.name, code: division.code ?? null, departmentId: division.departmentId, closedOn: TODAY },
        },
      });
      return written(null);
    },
    async createDepartment(input) {
      const checked = checkDepartmentCreate(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planDepartmentCreate({ actor, org, save: checked.value, team: teamPeople(team, edits) });
      if (!planned.ok) return refused(planned.error);
      const id = Math.max(99, ...departmentStates(edits).map((d) => d.id)) + 1;
      const { name, code, headId } = planned.value;
      await save({ ...edits, departments: { ...edits.departments, [id]: { name, code, closedOn: null, headId } } });
      return written(id);
    },
    async saveDepartment(departmentId, input) {
      const checked = checkDepartmentSave(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planDepartmentSave({ actor, org, departmentId, save: checked.value });
      if (!planned.ok) return refused(planned.error);
      const { name, code } = planned.value;
      await save({ ...edits, departments: { ...edits.departments, [departmentId]: { ...departmentEdit(departmentId), name, code } } });
      return written(null);
    },
    async closeDepartment(departmentId, input) {
      const checked = checkDepartmentClose(input);
      if (!checked.ok) return refused(checked.error);
      const ids = org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id);
      const planned = planDepartmentClose({ actor, org, departmentId, close: checked.value, inIt: Object.fromEntries(ids.map((id) => [id, inIt(id)])) });
      if (!planned.ok) return refused(planned.error);
      const moved = { ...edits.divisions };
      const state = (divisionId: number) => {
        const d = org.divisions.find((v) => v.id === divisionId)!;
        return { name: d.name, code: d.code ?? null, departmentId: d.departmentId, closedOn: null };
      };
      // A division moves with everyone in it: the people stay in it, so they move with it.
      for (const { divisionId, to } of planned.value.move) moved[divisionId] = { ...state(divisionId), departmentId: to };
      for (const divisionId of planned.value.close) moved[divisionId] = { ...state(divisionId), closedOn: TODAY };
      await save({
        ...edits,
        divisions: moved,
        departments: { ...edits.departments, [departmentId]: { ...departmentEdit(departmentId), closedOn: TODAY } },
      });
      return written(null);
    },
    async setShownOnSite(alumnusId, shown) {
      if (!canReach(testDeveloperStanding(kind), "alumni") || !editedAlumni(edits).some((a) => a.id === alumnusId)) return false;
      await save({ ...edits, shownOnSite: { ...edits.shownOnSite, [alumnusId]: shown } });
      return true;
    },
    async saveMember(personId, edit) {
      const entry = find(personId);
      if (!entry || !mayEdit(kind, entry) || actor === null) return false;
      const division = drawerDivision(kind, entry);
      // The drawer sets the role in one division; a seat or head, or someone in no division, has none to set.
      if (edit.role !== null && (division === null || !isIn(entry.placement, division))) return false;
      // Changing who leads a division is the head's, never a division lead's (Owner decision on #231).
      if (edit.role !== null && division !== null && !mayChangeDivision(actor, division, org).allowed) return false;
      const before = edits.members[personId]?.roles ?? {};
      const next: MemberChange = {
        ...edits.members[personId],
        pageTitle: cleanTitle(edit.pageTitle),
        roles: edit.role === null || division === null ? before : { ...before, [division]: DIVISION_ROLE_OF[edit.role] },
      };
      await save(withChange(personId, next));
      return true;
    },
    async promote() {
      // Promote is a division lead's button (board 59e), and changing a division's leads is
      // only its head's (`mayChangeDivision`); the head changes leads in Edit division (#232).
      return false;
    },
    async moveToAlumni(personId, departure) {
      const entry = find(personId);
      // Only people on the dummy roster have an Alumni row to move to.
      if (!entry || actor === null || entry.id === SELF_ID[kind] || !people.some((p) => p.id === personId)) return false;
      if (departure.from > departure.to || departure.to > thisYear) return false;
      const standing = standingOfPlacement(entry.placement);
      const { memberships } = standing;
      if (actor.kind !== "team" && !memberships.some((m) => reachesDivision(actor, m.divisionId, org))) return false;
      if (!mayLeaveTeam(actor, standing, org).allowed) return false;
      // Every role ends (alumni-move.ts); the edits keep no ended role, so the whole person moves.
      const roles: { divisionId: number | null }[] =
        memberships.length === 0 ? [{ divisionId: null }] : memberships.map((m) => ({ divisionId: m.divisionId }));
      if (alumniMove(roles) === null) return false;
      await save({ ...edits, movedToAlumni: { ...edits.movedToAlumni, [personId]: departure } });
      return true;
    },
    async confirmJoin(applicationId) {
      const joiner = joiners.find((j) => j.applicationId === applicationId);
      if (!joiner || actor === null || !reachesDivision(actor, joiner.divisionId, org) || joiner.joinedIn !== null) return false;
      try {
        return (await move(applicationId, { kind: "confirm-join" })).ok;
      } catch (error) {
        if (error instanceof DashboardRefused) return false;
        throw error;
      }
    },
    async addMember(input) {
      const checked = checkAddMember(input);
      if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
      const add = checked.value;
      if (actor === null || !reachesDivision(actor, add.divisionId, org)) return refused("You can add people only to your own division.");
      const candidates = team.map((e) => candidateOf(e, edits));
      const member =
        add.kind === "member"
          ? candidates.find((c) => c.id === add.personId)
          : candidates.find((c) => c.emails.some((e) => signInEmailOf(e) === add.email));
      if (add.kind === "member" && !member) return refused("They are not on the team.");
      const waiting = add.kind === "email" && waitingIn(edits, add.divisionId).some((w) => signInEmailOf(w.email) === add.email);
      const standing: AddStanding = member ? { kind: "member", memberships: member.memberships } : waiting ? { kind: "waiting" } : { kind: "not-on-team" };
      const outcome = addOutcome(standing, add.divisionId);
      if (outcome.kind === "refused") return refused(outcome.reason);
      if (outcome.kind === "joins" && member) {
        const change = changeOf(member.id);
        await save(
          withChange(member.id, {
            ...change,
            joined: { ...change.joined, [add.divisionId]: TODAY },
            left: (change.left ?? []).filter((d) => d !== add.divisionId),
            titles: { ...change.titles, [add.divisionId]: add.title },
          }),
        );
        return written("joined");
      }
      if (add.kind !== "email") return refused("Check the form.");
      // A cancelled add's join id is never given out again, so it cannot hide the new add.
      const joinId = Math.max(99, ...addedPeople(edits).map((a) => a.joinId), ...edits.cancelled) + 1;
      const added: DummyWaiting = { joinId, email: add.email, firstName: add.firstName, lastName: add.lastName, divisionId: add.divisionId, title: add.title };
      await save({
        ...edits,
        added: [...edits.added, added],
        details: add.details ? { ...edits.details, [detailsKey({ kind: "waiting", joinId })]: add.details } : edits.details,
      });
      return written("waiting");
    },
    async confirmNda(joinId) {
      const added = addedPeople(edits).find((a) => a.joinId === joinId);
      const self = SELF_ID[kind];
      if (!added || actor === null || self === null || edits.confirmed[joinId] !== undefined) return false;
      if (!reachesDivision(actor, added.divisionId, org)) return false;
      await save({ ...edits, confirmed: { ...edits.confirmed, [joinId]: { on: TODAY, by: self } } });
      return true;
    },
    async cancelAdd(joinId) {
      const added = addedPeople(edits).find((a) => a.joinId === joinId);
      if (!added || actor === null || edits.confirmed[joinId] !== undefined) return false;
      if (!reachesDivision(actor, added.divisionId, org)) return false;
      const details = { ...edits.details };
      delete details[detailsKey({ kind: "waiting", joinId })];
      await save({ ...edits, added: edits.added.filter((a) => a.joinId !== joinId), cancelled: [...edits.cancelled, joinId], details });
      return true;
    },
    async removeFromDivision(personId, divisionId) {
      const entry = inReach(personId, divisionId);
      if (!entry || actor === null) return false;
      if (removalFrom(actor, standingOfPlacement(entry.placement), divisionId, org).kind !== "offered") return false;
      const change = changeOf(personId);
      const joined = { ...change.joined };
      delete joined[divisionId];
      await save(withChange(personId, { ...change, joined, left: [...(change.left ?? []), divisionId] }));
      return true;
    },
    async saveMemberDetails(target, divisionId, input) {
      const checked = checkMemberEdit(input);
      if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
      if (actor === null || !reachesDivision(actor, divisionId, org)) return refused("You can edit only people in your own division.");
      const { title, details } = checked.value;
      if (target.kind === "waiting") {
        const added = waitingIn(edits, divisionId).find((w) => w.joinId === target.joinId);
        if (!added) return refused("They are not waiting to join this division.");
        await save({
          ...edits,
          added: edits.added.map((a) => (a.joinId === target.joinId ? { ...a, title } : a)),
          details: { ...edits.details, [detailsKey(target)]: details },
        });
        return written(null);
      }
      const entry = inReach(target.id, divisionId);
      if (!entry) return refused("You can edit only people in your own division.");
      const change = changeOf(entry.id);
      await save({
        ...withChange(entry.id, { ...change, titles: { ...change.titles, [divisionId]: title } }),
        details: { ...edits.details, [detailsKey(target)]: details },
      });
      return written(null);
    },
    async setMemberPhoto(personId, divisionId, photo) {
      if (!inReach(personId, divisionId)) return refused("You can edit only people in your own division.");
      if (photo === null) return written(null);
      const error = checkMemberPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
      // A preview keeps no photos: the check runs as the database side runs it, and nothing is stored.
      return error === null ? written(null) : refused(error);
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
  openPositionsIn: (divisionId: number) => number = () => 0,
): Pick<DashboardData, "members" | "findForAdd" | "findPeople" | "alumni" | "teamTree" | "teamStructure" | "teamWrites"> {
  const self = SELF_ID[kind];
  const joiners = dummyJoiners(current);
  const actor = actorOf(kind);
  const { org } = dummyOrg(edits);
  const reach = actor?.kind === "lead" ? actor.divisionIds : [];
  // As the database lists them (`readJoining`): people not on the team yet. A
  // member joins from the Applications page (board 58h2) or from Add member.
  const joiningIn = (team: readonly RosterEntry[], division: number): Joining[] =>
    joiners
      .filter((j) => j.divisionId === division && j.joinedIn === null && dummyStanding(j.email, j.divisionId, team).kind !== "member")
      .map(({ applicationId, name, position, ndaArrived }) => ({ applicationId, name, position, ndaArrived }));
  return {
    members: async (divisionId) => {
      const team = editedRoster(edits, joiners);
      if (kind === "operations-lead") return teamDirectory(team, org, self);
      if (actor?.kind === "head") {
        const [departmentId] = actor.departmentIds;
        const ids = org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id);
        const page = departmentMembers({
          records: team.map((entry) => recordOf(entry, edits)),
          org,
          departmentId,
          actor,
          selfId: self,
          waiting: Object.fromEntries(ids.map((id) => [id, waitingIn(edits, id)])),
          joining: Object.fromEntries(ids.map((id) => [id, joiningIn(team, id)])),
        });
        return page === null ? NO_MEMBERS : { scope: "department", ...page };
      }
      if (actor === null || reach.length === 0) return NO_MEMBERS;
      const division = reach.find((id) => id === divisionId) ?? reach[0];
      const page = divisionMembers({
        records: team.map((entry) => recordOf(entry, edits)),
        org,
        divisionId: division,
        actor,
        selfId: self,
        reach,
        waiting: waitingIn(edits, division),
        joining: joiningIn(team, division),
      });
      return page === null ? NO_MEMBERS : { scope: "division", ...page };
    },
    findForAdd: async (divisionId, query) => {
      if (actor === null || !reachesDivision(actor, divisionId, org)) return { kind: "none" };
      const team = editedRoster(edits, joiners).map((e) => candidateOf(e, edits));
      return lookupForAdd(query, team, waitingIn(edits, divisionId).map((w) => w.email), divisionId, org);
    },
    findPeople: async (query) => {
      // The pickers are New division's and Edit division's: a head's or the team's (#232).
      if (actor === null || actor.kind === "lead") return { kind: "none" };
      return searchTeam(query, teamPeople(editedRoster(edits, joiners), edits), org);
    },
    alumni: async () => alumniDirectory(canReach(testDeveloperStanding(kind), "alumni") ? editedAlumni(edits) : []),
    teamTree: async () =>
      buildTeamTree(canReach(testDeveloperStanding(kind), "team-tree") ? editedRoster(edits, joiners) : [], org, roster.season, self),
    teamStructure: async () => {
      if (!canReach(testDeveloperStanding(kind), "team-tree")) return null;
      const team = editedRoster(edits, joiners);
      const ids = editableDivisionIds(actor, org);
      return teamStructure({
        records: team.map((entry) => recordOf(entry, edits)),
        org,
        actor,
        selfId: self,
        waiting: Object.fromEntries(ids.map((id) => [id, waitingIn(edits, id)])),
        joining: Object.fromEntries(ids.map((id) => [id, joiningIn(team, id)])),
        openPositions: Object.fromEntries(ids.map((id) => [id, openPositionsIn(id)])),
      });
    },
    teamWrites: writesFor(kind, edits, save, joiners, move),
  };
}
