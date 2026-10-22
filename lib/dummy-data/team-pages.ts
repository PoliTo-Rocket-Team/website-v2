import { canReach } from "@/lib/dashboard/access";
import { alumniMove } from "@/lib/dashboard/alumni-move";
import { joinChange, memberStanding, NEW_APPLICANT, type ApplicantStanding, type LeadMove } from "@/lib/dashboard/application-flow";
import { DashboardRefused, type DashboardData, type TeamWrites } from "@/lib/dashboard/data";
import { departmentMembers } from "@/lib/dashboard/department-members";
import {
  ADVISOR_TITLE,
  advisorAfterDivisionCloses,
  checkTeamLeaderHandOver,
  advising,
  planTeamLeaderHandOver,
  type AdvisorPlace,
  type SteppingDown,
} from "@/lib/dashboard/hand-over";
import {
  checkDepartmentClose,
  checkDepartmentCreate,
  checkDepartmentSave,
  closingPeople,
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
import type { AlumniRecord, AlumnusKey, EntryChange } from "@/lib/about/alumni-record";
import { alumniDirectory, alumnusRow, checkAdvisor, checkAlumnusFix } from "@/lib/dashboard/alumni";
import { checkPhoto } from "@/lib/dashboard/self";
import {
  buildTeamTree,
  DIVISION_ROLE_OF,
  homeDivision,
  homeDivisionOf,
  homeFirst,
  inDivisions,
  isIn,
  ledDivisionsOf,
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
  teamPageEditOf,
  withJoined,
  withoutDivision,
  type DivisionRole,
  type Joining,
  type OrgChart,
  type OrgDepartment,
  type OrgDivision,
  type Placement,
  type RoleBeyondDivisions,
  type RosterEntry,
  type TeamActor,
} from "@/lib/dashboard/team";
import { editableDivisionIds, teamStructure } from "@/lib/dashboard/team-structure";
import { kindOfTestViewer, readsArea, seatOf, testDeveloperStanding, type TestViewer } from "@/lib/dashboard/viewer";
import { grantActors, testGrantAreas, type TestGrant } from "./test-grant";
import { wholeTeamMembers } from "@/lib/dashboard/team-members";
import { opensWholeTeam } from "@/lib/dashboard/members-view";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { DUMMY_ALUMNI_YEAR, dummyAlumni, dummyAlumniRecord, type DummyFormer } from "./alumni";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { cleanTitle, detailsKey, type DummyAdvisor, type MemberChange, type TeamEdits } from "./edits";
import { dummySeatsOf } from "./division";
import { dummyHandOversOf, nextHandOverId, waitingHandOvers, withDummyHandOver, withLapsedHandOvers } from "./hand-overs";
import { withDummyNotices } from "./notices";
import { dummyAliasesOf, dummyAliasRequestsOf, nextAliasRequestId, openAliasRequests, withDummyAliasRequest } from "./aliases";
import {
  aliasAnswerNotices,
  aliasAttentionFor,
  checkAliasAnswer,
  memberAliasesFor,
  planAliasAnswer,
  planAliasCancel,
  planAliasRequest,
} from "@/lib/dashboard/alias-request";
import {
  answerNoticeOf,
  checkHandOverSend,
  handOverAttentionFor,
  handOverOfferOf,
  hasLapsed,
  planHandOverAnswer,
  planHandOverSend,
  type HandOverAnswerPlan,
  type HandOverOffer,
} from "@/lib/dashboard/hand-over-request";
import type { AttentionItem } from "@/lib/dashboard/overview";
import { dummyMemberDetails, dummyNda, dummySignInEmail } from "./members";
import { alumni, closedDivisions, departments, divisions, DUMMY_NOW, formerMember, people, positions, rosterSeason, waitingPeople, type DummyPerson, type DummyWaiting } from "./team";

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
  for (const [id, edit] of Object.entries(edits.departments)) {
    const kind = edit.kind ?? all.get(Number(id))?.kind ?? "technical";
    all.set(Number(id), { id: Number(id), name: edit.name, code: edit.code, kind, closedOn: edit.closedOn });
  }
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
const SELF_ID: Readonly<Record<TestViewer, number | null>> = {
  "team-leader": 14,
  "operations-lead": 1,
  "department-head": 15,
  "division-lead": 2,
  member: 5,
  alumni: formerMember.id,
  "non-member": null,
};

/** The day the dummy team's writes happen on: the dummy team is seen from DUMMY_NOW. */
const TODAY = DUMMY_NOW.slice(0, 10);

const NOT_ON_ALUMNI = "They are not on the Alumni page.";

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
  return [...joinedTeam, ...added, ...confirmed]
    .filter((e) => edits.movedToAlumni[e.id] === undefined)
    .map((e) => withoutAdvisorAccess(withTeamLeaderSeat(withDepartmentSeat(e, edits), edits), edits));
}

/**
 * "Become an advisor" removes every access row a lead or head holds (Owner
 * decision, 2026-10-16), as the database deletes them; a former team leader
 * keeps theirs.
 */
function withoutAdvisorAccess(entry: RosterEntry, edits: TeamEdits): RosterEntry {
  return edits.advisors[entry.id]?.access === "ends" ? { ...entry, access: [] } : entry;
}

/**
 * The seat "Hand over the role" moved (board 77i, issue #253): the person
 * picked is the team leader, keeping the divisions they are in; the one in
 * the arrays is the team leader no more and keeps theirs.
 */
function withTeamLeaderSeat(entry: RosterEntry, edits: TeamEdits): RosterEntry {
  const { placement } = entry;
  if (edits.teamLeader === null) return entry;
  if (entry.id === edits.teamLeader) return { ...entry, placement: { role: "team-leader", memberships: placement.memberships } };
  return placement.role === "team-leader" ? { ...entry, placement: { role: "divisions", memberships: placement.memberships } } : entry;
}

function entryWithChanges(entry: RosterEntry, change: MemberChange | undefined): RosterEntry {
  return { ...entry, placement: placementWith(entry.placement, change) };
}

/**
 * The seat New department, Change head and Close department changed (issues
 * #251, #253): the head New department or Change head picked heads it,
 * keeping their divisions; a head replaced by Change head, and the head of a
 * closed department, hold that seat no more and keep every division they are
 * in. What became of them is kept apart: "Become an advisor" in `advisors`
 * (`beyondOf`), "Leave the team" in `movedToAlumni`.
 */
function withDepartmentSeat(entry: RosterEntry, edits: TeamEdits): RosterEntry {
  const { placement } = entry;
  const headed = Object.entries(edits.departments).find(([, d]) => d.headId === entry.id && d.closedOn === null);
  if (headed && placement.role === "divisions") return { ...entry, placement: { role: "head", departmentId: Number(headed[0]), memberships: placement.memberships } };
  const department = placement.role === "head" ? edits.departments[placement.departmentId] : undefined;
  if (department && (department.closedOn !== null || (department.headId !== null && department.headId !== entry.id))) {
    return { ...entry, placement: { role: "divisions", memberships: placement.memberships } };
  }
  return entry;
}

/** An Advisor role as a role beyond every division: one on a department or on the whole team. One in a division is a membership. */
function advisorBeyond(place: AdvisorPlace): RoleBeyondDivisions | null {
  if (place.kind === "division") return null;
  return { kind: "advisor", departmentId: place.kind === "department" ? place.departmentId : null };
}

/** Every role someone holds in no division: their seat, and an Advisor role on a department or on the whole team. */
function beyondOf(entry: RosterEntry, edits: TeamEdits): readonly RoleBeyondDivisions[] {
  const { beyond } = standingOfPlacement(entry.placement);
  const advisor = edits.advisors[entry.id];
  const role = advisor ? advisorBeyond(advisor.place) : null;
  return role === null ? beyond : [...beyond, role];
}

/** The advisors with someone's Advisor role set, from what `steppingDown` said became of them. */
function withAdvisor(edits: TeamEdits, personId: number, step: Extract<SteppingDown, { kind: "advisor" }>): TeamEdits {
  const advisor: DummyAdvisor = { place: step.place, access: step.access };
  return { ...edits, advisors: { ...edits.advisors, [personId]: advisor } };
}

/** Whether an Advisor role sits in the closing department `departmentId`, on it or on one of its divisions (`own`). */
function closedHere(place: AdvisorPlace, departmentId: number, own: readonly { readonly id: number }[]): boolean {
  if (place.kind === "department") return place.departmentId === departmentId;
  return place.kind === "division" && own.some((d) => d.id === place.divisionId);
}

/** Whether someone's Advisor role is kept on the division. */
function advisesIn(edits: TeamEdits, personId: number, divisionId: number): boolean {
  const place = edits.advisors[personId]?.place;
  return place?.kind === "division" && place.divisionId === divisionId;
}

/**
 * Someone who leaves the team from a structure edit or a hand-over (an old
 * lead's or head's "Leave the team"): moved to Alumni
 * with their years, or why the preview cannot.
 */
function leftTeamEdits(next: TeamEdits, id: number, name: string | undefined): TeamEdits | string {
  const person = people.find((p) => p.id === id);
  // Only people on the dummy roster have an Alumni row to move to, as in Leaves the team.
  if (!person) return `${name ?? "They"} cannot be moved to Alumni in this preview.`;
  const departure = { from: Number(person.since.slice(0, 4)), to: Number(TODAY.slice(0, 4)), reason: null };
  return { ...next, movedToAlumni: { ...next.movedToAlumni, [id]: departure } };
}

/** People off the team: the ./team.ts alumni, and those the test developer moved with the place they held. */
export function editedFormer(edits: TeamEdits): DummyFormer[] {
  const moved = people.flatMap((p): DummyFormer[] => {
    const departure = edits.movedToAlumni[p.id];
    if (departure === undefined) return [];
    const entry = entryOf(p, edits.members[p.id]);
    const row = memberRowOf(entry, dummyOrg(edits).org);
    const unit = row.department ?? "Board";
    const alumnus = { id: p.id, name: p.name, lastRole: row.roleLabel, unit, department: unit, from: departure.from, to: departure.to, shownOnSite: true };
    return [{ row: alumnus, placement: entry.placement }];
  });
  return [...alumni.map((row) => ({ row, placement: null })), ...moved];
}

/** The Alumni record as the test developer left it (issue #257): the team, the people who left, the import and their fixes. */
export function editedAlumniRecord(edits: TeamEdits, joiners: readonly DummyJoiner[] = []): AlumniRecord {
  const { org, closed } = dummyOrg(edits);
  return dummyAlumniRecord({
    team: editedRoster(edits, joiners),
    former: editedFormer(edits),
    org,
    closed: closed.map(({ id, name, code, departmentId }) => ({ id, name, code, departmentId })),
    edits: edits.alumni,
  });
}

/** Every division a division lead leads, the home one first (issue #185); none for every other viewer. */
function myDivisions(kind: TestViewer): number[] {
  if (kind !== "division-lead") return [];
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine ? ledDivisionsOf(mine.placement) : [];
}

/** The department the department head heads; null for every other viewer. */
function myDepartment(kind: TestViewer): number | null {
  if (kind !== "department-head") return null;
  const mine = people.find((p) => p.id === SELF_ID[kind]);
  return mine?.placement.role === "head" ? mine.placement.departmentId : null;
}

/**
 * Who `kind` acts as on the Members page: the operations lead reaches the
 * team, a department head their department (issue #235), a division lead
 * every division they lead (issue #185), and the member holding a test grant
 * the divisions where it lets them change Members (issue #351); nobody else
 * acts there.
 */
function actorOf(kind: TestViewer, org: OrgChart, grant: TestGrant | null): TeamActor | null {
  if (kind === "member" && grant !== null) return grantActors(grant, org).changing;
  if (!canReach(testDeveloperStanding(kind), "members")) return null;
  if (kindOfTestViewer(kind) === "operations-lead") return { kind: "team" };
  const department = myDepartment(kind);
  if (department !== null) return { kind: "head", departmentIds: [department] };
  const divisions = myDivisions(kind);
  return divisions.length === 0 ? null : { kind: "lead", divisionIds: divisions };
}

/**
 * Whether `kind` may change this person from the Members page, as `actor`
 * reaches them (`reachesDivision`): anyone for the team, someone in the
 * head's department or in a division the lead leads (Owner decisions,
 * 2026-10-19, issue #444); never themselves.
 */
function mayEdit(kind: TestViewer, actor: TeamActor | null, entry: RosterEntry, org: OrgChart): boolean {
  if (actor === null || !canReach(testDeveloperStanding(kind), "members") || entry.id === SELF_ID[kind]) return false;
  if (actor.kind === "team") return true;
  return membershipsIn(entry.placement).some((m) => reachesDivision(actor, m.divisionId, org));
}

/**
 * The division a drawer's role change is about: the person's home division
 * for the team, else their home one among the divisions `actor` reaches.
 */
function drawerDivision(actor: TeamActor, entry: RosterEntry, org: OrgChart): number | null {
  if (actor.kind === "team") return homeDivisionOf(entry.placement);
  return homeFirst(membershipsIn(entry.placement)).find((m) => reachesDivision(actor, m.divisionId, org))?.divisionId ?? null;
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
    beyondDivisions: beyondOf(entry, edits),
    titles,
    advising: memberships.flatMap((m) => (advisesIn(edits, entry.id, m.divisionId) ? [m.divisionId] : [])),
    details: savedDetails ?? addedDetails ?? (person ? dummyMemberDetails(person) : NO_MEMBER_DETAILS),
    nda: person ? dummyNda(person) : confirmation ? { signedOn: confirmation.on, confirmedBy: confirmer } : null,
  };
}

/** Everyone on the team as the test developer left it, as the Members pages read them: the team leader's Overview counts these. */
export function dummyRecords(edits: TeamEdits, joiners: readonly DummyJoiner[]): PersonRecord[] {
  return editedRoster(edits, joiners).map((entry) => recordOf(entry, edits));
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
    return { id: entry.id, name: entry.name, emails: candidate.emails, memberships: candidate.memberships, beyond: beyondOf(entry, edits) };
  });
}

/** Everyone on the team `edits` make, as the hand-over rules read them (lib/dashboard/hand-over-request.ts). */
export function dummyTeamPeople(edits: TeamEdits, current: readonly DummyApplication[] = baseApplications): TeamPerson[] {
  return teamPeople(editedRoster(edits, dummyJoiners(current)), edits);
}

/** The Applications page's move, as the dummy dashboard runs it: Confirm join on the Members page is that move. */
export type DummyMove = (applicationId: number, move: LeadMove) => Promise<WriteResult<null>>;

/** Without the Applications page's store nothing moves. */
const NO_MOVE: DummyMove = async () => ({ ok: false, error: "Nothing to move." });

function writesFor(
  kind: TestViewer,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
  joiners: readonly DummyJoiner[],
  move: DummyMove,
  grant: TestGrant | null,
): TeamWrites {
  const team = editedRoster(edits, joiners);
  const { org, closed } = dummyOrg(edits);
  const find = (id: number) => team.find((e) => e.id === id);
  const thisYear = new Date().getUTCFullYear();
  const actor = actorOf(kind, org, grant);
  const changeOf = (id: number): MemberChange => edits.members[id] ?? { pageTitle: find(id)?.pageTitle ?? null, roles: {} };
  const withChange = (id: number, change: MemberChange): TeamEdits => ({ ...edits, members: { ...edits.members, [id]: change } });
  /** Someone in a division the actor reaches, never the actor. */
  const inReach = (personId: number, divisionId: number) => {
    const entry = find(personId);
    if (!entry || actor === null || entry.id === SELF_ID[kind] || !reachesDivision(actor, divisionId, org)) return null;
    return isIn(entry.placement, divisionId) ? entry : null;
  };
  /** Someone the Alumni page lists, for a viewer who reaches it (#257); never someone who asked to be removed. */
  const alumnus = (key: AlumnusKey) => {
    if (!canReach(testDeveloperStanding(kind), "alumni")) return null;
    return dummyAlumni(editedAlumniRecord(edits, joiners)).find((a) => a.key === key && !a.removed) ?? null;
  };
  const saveAlumniEntry = (key: AlumnusKey, change: Omit<EntryChange, "photo">) =>
    save({ ...edits, alumni: { ...edits.alumni, entries: { ...edits.alumni.entries, [key]: { ...edits.alumni.entries[key], ...change } } } });

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
    // A replaced lead stays in the division with the Advisor role, and their access ends (issue #253).
    for (const id of plan.advise) {
      change(id, (c) => ({ ...setRole("member")(c), titles: { ...c.titles, [divisionId]: ADVISOR_TITLE } }));
      next = withAdvisor(next, id, advising({ kind: "lead", divisionId }));
    }
    plan.leaveDivision.forEach((id) => change(id, leave));
    for (const id of plan.leaveTeam) {
      const moved = leftTeam(next, id);
      if (typeof moved === "string") return refused(moved);
      next = moved;
    }
    // A cancelled add's join id is never given out again, as in Add member.
    const firstJoinId = Math.max(99, ...addedPeople(edits).map((a) => a.joinId), ...edits.cancelled) + 1;
    const added = plan.emails.map((email, i): DummyWaiting => ({ joinId: firstJoinId + i, email, firstName: "", lastName: "", divisionId, title: null }));
    if (added.length > 0) next = { ...next, added: [...next.added, ...added] };
    await save(next);
    return written(null);
  };

  const leftTeam = (next: TeamEdits, id: number): TeamEdits | string => leftTeamEdits(next, id, find(id)?.name);

  /** The division a save is about: open on the chart. A closed one is none, so no save opens it again (#251). */
  const subjectOf = (divisionId: number): Exclude<DivisionSubject, { kind: "new" }> | null => {
    const open = org.divisions.find((d) => d.id === divisionId);
    return open ? { kind: "open", division: open } : null;
  };

  /** People in each division and people waiting for their NDA there: Close division and Close department refuse while any are. */
  const inIt = (divisionId: number) => team.filter((e) => isIn(e.placement, divisionId)).length + waitingIn(edits, divisionId).length;

  /** Who heads the department now. */
  const headsOf = (departmentId: number) => team.filter((e) => e.placement.role === "head" && e.placement.departmentId === departmentId).map((e) => e.id);

  /** The department as the edits keep it, before this write. */
  const departmentEdit = (departmentId: number) => {
    const department = org.departments.find((d) => d.id === departmentId)!;
    return edits.departments[departmentId] ?? { name: department.name, code: department.code ?? null, kind: department.kind, closedOn: null, headId: null };
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
      // An advisor in the division does not keep it open: they stay in its department (issue #441).
      const advisors = team.filter((e) => isIn(e.placement, divisionId) && advisesIn(edits, e.id, divisionId)).map((e) => e.id);
      const counted = { people: team.filter((e) => isIn(e.placement, divisionId)).length - advisors.length, waiting: waitingIn(edits, divisionId).length };
      const refusal = closeRefusal(actor, org, divisionId, counted);
      if (refusal !== null) return refused(refusal);
      const division = org.divisions.find((d) => d.id === divisionId)!;
      let next: TeamEdits = {
        ...edits,
        divisions: {
          ...edits.divisions,
          [divisionId]: { name: division.name, code: division.code ?? null, departmentId: division.departmentId, closedOn: TODAY },
        },
      };
      for (const id of advisors) {
        const c = next.members[id] ?? changeOf(id);
        const joined = { ...c.joined };
        delete joined[divisionId];
        next = { ...next, members: { ...next.members, [id]: { ...c, joined, left: [...(c.left ?? []), divisionId] } } };
        next = withAdvisor(next, id, { kind: "advisor", place: advisorAfterDivisionCloses(division.departmentId), access: edits.advisors[id]!.access });
      }
      await save(next);
      return written(null);
    },
    async createDepartment(input) {
      const checked = checkDepartmentCreate(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planDepartmentCreate({ actor, org, save: checked.value, team: teamPeople(team, edits) });
      if (!planned.ok) return refused(planned.error);
      const id = Math.max(99, ...departmentStates(edits).map((d) => d.id)) + 1;
      const { name, code, kind, headId } = planned.value;
      await save({ ...edits, departments: { ...edits.departments, [id]: { name, code, kind, closedOn: null, headId } } });
      return written(id);
    },
    async saveDepartment(departmentId, input) {
      const checked = checkDepartmentSave(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planDepartmentSave({ actor, org, departmentId, save: checked.value, team: teamPeople(team, edits), headIds: headsOf(departmentId) });
      if (!planned.ok) return refused(planned.error);
      const { name, code, kind, head } = planned.value;
      const before = departmentEdit(departmentId);
      let next: TeamEdits = { ...edits, departments: { ...edits.departments, [departmentId]: { ...before, name, code, kind, headId: head?.to ?? before.headId } } };
      // Change head (issue #253): the head they replace becomes an advisor in this department, or leaves the team.
      const step = head?.steppingDown ?? null;
      for (const id of head !== null && step !== null ? head.from : []) {
        const after = step?.kind === "advisor" ? withAdvisor(next, id, step) : leftTeam(next, id);
        if (typeof after === "string") return refused(after);
        next = after;
      }
      await save(next);
      return written(null);
    },
    async closeDepartment(departmentId, input) {
      const checked = checkDepartmentClose(input);
      if (!checked.ok) return refused(checked.error);
      const own = org.divisions.filter((d) => d.departmentId === departmentId);
      const planned = planDepartmentClose({
        actor,
        org,
        departmentId,
        close: checked.value,
        people: closingPeople(
          team.map((e) => recordOf(e, edits)),
          org,
          departmentId,
        ),
        waiting: Object.fromEntries(own.map((d) => [d.id, waitingIn(edits, d.id).length])),
      });
      if (!planned.ok) return refused(planned.error);
      const closedDivisions = { ...edits.divisions };
      for (const d of own) closedDivisions[d.id] = { name: d.name, code: d.code ?? null, departmentId: d.departmentId, closedOn: TODAY };
      // The department closes, so its head is a head no more (`placedOf`).
      let next: TeamEdits = {
        ...edits,
        divisions: closedDivisions,
        departments: { ...edits.departments, [departmentId]: { ...departmentEdit(departmentId), closedOn: TODAY } },
      };
      // Every person leaves the department's divisions and starts one role where the closer sent them (Owner decision, 2026-10-19).
      for (const { personId, to, becomes } of planned.value.moves) {
        const c = next.members[personId] ?? changeOf(personId);
        const joined = { ...c.joined };
        const titles = { ...c.titles };
        const roles = { ...c.roles };
        for (const d of own) {
          delete joined[d.id];
          delete titles[d.id];
          delete roles[d.id];
        }
        const left = [...(c.left ?? []).filter((id) => to.kind !== "division" || id !== to.divisionId), ...own.map((d) => d.id)];
        const arrived: MemberChange =
          to.kind === "division"
            ? {
                ...c,
                roles: { ...roles, [to.divisionId]: "member" },
                joined: { ...joined, [to.divisionId]: TODAY },
                titles: becomes.kind === "advisor" ? { ...titles, [to.divisionId]: ADVISOR_TITLE } : titles,
                left,
              }
            : { ...c, roles, joined, titles, left };
        next = { ...next, members: { ...next.members, [personId]: arrived } };
        const advisors = { ...next.advisors };
        if (becomes.kind === "advisor") {
          advisors[personId] = { place: to, access: becomes.access === "ends" ? "ends" : (edits.advisors[personId]?.access ?? "ends") };
        } else if (advisors[personId] !== undefined && closedHere(advisors[personId].place, departmentId, own)) {
          delete advisors[personId];
        }
        next = { ...next, advisors };
      }
      await save(next);
      return written(null);
    },
    async handOverTeamLeader(input) {
      const checked = checkTeamLeaderHandOver(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planTeamLeaderHandOver({
        viewer: { seat: seatOf(testDeveloperStanding(kind)), selfId: SELF_ID[kind] },
        leaderId: team.find((e) => e.placement.role === "team-leader")?.id ?? null,
        handOver: checked.value,
        team: teamPeople(team, edits),
      });
      if (!planned.ok) return refused(planned.error);
      const { from, to, steppingDown: step } = planned.value;
      const next: TeamEdits = { ...edits, teamLeader: to };
      const after = step.kind === "advisor" ? withAdvisor(next, from, step) : leftTeam(next, from);
      if (typeof after === "string") return refused(after);
      await save(after);
      return written(null);
    },
    async setAlumnusShown(key, shown) {
      if (alumnus(key) === null) return false;
      await saveAlumniEntry(key, { shown });
      return true;
    },
    async fixAlumnus(key, input) {
      const person = alumnus(key);
      if (person === null) return refused(NOT_ON_ALUMNI);
      const fix = checkAlumnusFix(input, alumnusRow(person));
      if (!fix.ok) return fix;
      await saveAlumniEntry(key, fix.value);
      return written(null);
    },
    async setAlumnusPhoto(key, photo) {
      if (alumnus(key) === null) return refused(NOT_ON_ALUMNI);
      // A preview keeps no photos: the check runs as the database side runs it, and nothing is stored.
      const error = photo === null ? null : checkPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
      return error === null ? written(null) : refused(error);
    },
    async addAdvisor(input, photo) {
      if (!canReach(testDeveloperStanding(kind), "alumni")) return refused("You cannot edit the Alumni page.");
      const advisor = checkAdvisor(input, DUMMY_ALUMNI_YEAR);
      if (!advisor.ok) return advisor;
      const error = photo === null ? null : checkPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
      if (error !== null) return refused(error);
      await save({ ...edits, alumni: { ...edits.alumni, advisors: [...edits.alumni.advisors, advisor.value] } });
      return written(null);
    },
    async saveMember(personId, edit) {
      const entry = find(personId);
      if (!entry || actor === null || !mayEdit(kind, actor, entry, org)) return false;
      const division = drawerDivision(actor, entry, org);
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
 * Applications page's move, which Confirm join runs. `grant` is the member's
 * test grant (./test-grant.ts): the Members page then lists every division it
 * covers and offers changes only where it lets them change (issue #351).
 */
export function dummyTeamPages(
  kind: TestViewer,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
  current: readonly DummyApplication[] = baseApplications,
  move: DummyMove = NO_MOVE,
  openPositionsIn: (divisionId: number) => number = () => 0,
  grant: TestGrant | null = null,
): Pick<DashboardData, "members" | "findForAdd" | "findPeople" | "alumni" | "teamTree" | "teamStructure" | "teamWrites"> {
  const self = SELF_ID[kind];
  const joiners = dummyJoiners(current);
  const { org } = dummyOrg(edits);
  const actor = actorOf(kind, org, grant);
  // Who the page reads as: the actor, or for a test grant every division it covers, whatever its level.
  const viewing = kind === "member" && grant !== null ? grantActors(grant, org).viewing : actor;
  const reach = viewing?.kind === "lead" ? viewing.divisionIds : [];
  // The accepted applicants joining are applications data: a division's page
  // lists them only for a viewer who reads Applications, as the database side
  // does (`readDivisionMembers`), so a Members grant alone lists none (issue #477).
  const standing = testDeveloperStanding(kind);
  const readsJoining = readsArea(standing.kind === "member" && grant !== null ? { ...standing, grantedAreas: testGrantAreas(grant) } : standing, "applications");
  // As the database lists them (`readJoining`): people not on the team yet. A
  // member joins from the Applications page (board 58h2) or from Add member.
  const joiningIn = (team: readonly RosterEntry[], division: number): Joining[] =>
    joiners
      .filter((j) => j.divisionId === division && j.joinedIn === null && dummyStanding(j.email, j.divisionId, team).kind !== "member")
      .map(({ applicationId, name, position, ndaArrived }) => ({ applicationId, name, position, ndaArrived }));
  return {
    members: async (divisionId) => {
      const team = editedRoster(edits, joiners);
      // Every full-access seat's page lists every member field (boards 73 to 73c, issues #252 and #418),
      // with the Team page panel's edits (board 46b) for every seat, the team leader included (issue #444).
      if (opensWholeTeam(testDeveloperStanding(kind))) {
        return {
          scope: "whole-team",
          teamPageEdits: team.map((entry) => teamPageEditOf(entry, org)),
          ...wholeTeamMembers({ records: team.map((entry) => recordOf(entry, edits)), org, selfId: self }),
        };
      }
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
      if (reach.length === 0) return NO_MEMBERS;
      const division = reach.find((id) => id === divisionId) ?? reach[0];
      const page = divisionMembers({
        records: team.map((entry) => recordOf(entry, edits)),
        org,
        divisionId: division,
        actor,
        selfId: self,
        reach,
        waiting: waitingIn(edits, division),
        joining: readsJoining ? joiningIn(team, division) : [],
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
    alumni: async () =>
      alumniDirectory(
        canReach(testDeveloperStanding(kind), "alumni") ? dummyAlumni(editedAlumniRecord(edits, joiners)) : [],
        DUMMY_ALUMNI_YEAR,
      ),
    teamTree: async () =>
      buildTeamTree(canReach(testDeveloperStanding(kind), "team-tree") ? editedRoster(edits, joiners) : [], org, rosterSeason(), self),
    teamStructure: async () => {
      if (!canReach(testDeveloperStanding(kind), "team-tree")) return null;
      const team = editedRoster(edits, joiners);
      const ids = editableDivisionIds(actor, org);
      return teamStructure({
        records: team.map((entry) => recordOf(entry, edits)),
        org,
        actor,
        selfId: self,
        seat: seatOf(testDeveloperStanding(kind)),
        waiting: Object.fromEntries(ids.map((id) => [id, waitingIn(edits, id)])),
        joining: Object.fromEntries(ids.map((id) => [id, joiningIn(team, id)])),
        openPositions: Object.fromEntries(ids.map((id) => [id, openPositionsIn(id)])),
        seats: dummySeatsOf(team),
      });
    },
    teamWrites: writesFor(kind, edits, save, joiners, move, grant),
  };
}

/**
 * Confirm on a hand-over sent from My profile (board 62c, issue #262), laid
 * over the edits as the database writes it: a lead's successor leads the
 * division, a head's successor heads the department (keeping their
 * divisions), and the sender steps down as they chose, an advisor in their
 * unit whose access ends or off to Alumni (`steppingDown`).
 */
function confirmedHandOverEdits(
  edits: TeamEdits,
  plan: Extract<HandOverAnswerPlan, { answer: "confirm" }>,
  roster: readonly RosterEntry[],
  org: OrgChart,
): TeamEdits | string {
  const { request, steppingDown: step } = plan;
  const { fromId, toId, role } = request;
  const change = (next: TeamEdits, id: number, edit: (c: MemberChange) => MemberChange): TeamEdits => {
    const base = next.members[id] ?? { pageTitle: roster.find((e) => e.id === id)?.pageTitle ?? null, roles: {} };
    return { ...next, members: { ...next.members, [id]: edit(base) } };
  };
  let next = edits;
  if (role.kind === "lead") {
    const divisionId = role.divisionId;
    next = change(next, toId, (c) => ({ ...c, roles: { ...c.roles, [divisionId]: "lead" } }));
    if (step.kind === "advisor") {
      next = change(next, fromId, (c) => ({ ...c, roles: { ...c.roles, [divisionId]: "member" }, titles: { ...c.titles, [divisionId]: ADVISOR_TITLE } }));
      next = withAdvisor(next, fromId, step);
    }
  } else {
    const department = org.departments.find((d) => d.id === role.departmentId);
    const before = next.departments[role.departmentId] ?? { name: department?.name ?? "", code: department?.code ?? null, kind: department?.kind, closedOn: null, headId: null };
    next = { ...next, departments: { ...next.departments, [role.departmentId]: { ...before, headId: toId } } };
    if (step.kind === "advisor") next = withAdvisor(next, fromId, step);
  }
  return step.kind === "leave" ? leftTeamEdits(next, fromId, roster.find((e) => e.id === fromId)?.name) : next;
}

/**
 * Hand over your role from My profile (issue #262, boards 55d and 62c) as the
 * test developer runs it, with `edits` laid over the arrays: My profile's
 * offer, the approver's rows, "Send for confirmation", and Confirm and
 * Decline. ./hand-over-request.ts decides each as the database side does;
 * the requests and their answers live in the edits cookie (./hand-overs.ts).
 */
export function dummyHandOverPages(
  kind: TestViewer,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
  current: readonly DummyApplication[] = baseApplications,
): {
  /** My profile's "Hand over your role", or null for a viewer who holds no role to hand over from there. */
  readonly offer: () => HandOverOffer | null;
  /** The hand-overs the viewer answers, as their top attention rows. */
  readonly attention: (now: Date) => AttentionItem[];
} & Pick<DashboardData, "sendHandOver" | "answerHandOver"> {
  const self = SELF_ID[kind];
  const roster = editedRoster(edits, dummyJoiners(current));
  const team = teamPeople(roster, edits);
  const { org } = dummyOrg(edits);
  const all = dummyHandOversOf(edits);
  const waiting = waitingHandOvers(all);
  const mine = waiting.find((h) => h.fromId === self && !hasLapsed(h, team)) ?? null;
  const seats = dummySeatsOf(roster);
  return {
    offer: () => {
      const person = team.find((p) => p.id === self);
      return person ? handOverOfferOf(person, team, org, mine, seats) : null;
    },
    attention: (now) => handOverAttentionFor(self, waiting, team, org, now, seats),
    async sendHandOver(input) {
      if (self === null) return refused("This page is for team members.");
      const checked = checkHandOverSend(input);
      if (!checked.ok) return refused(checked.error);
      const planned = planHandOverSend({ senderId: self, send: checked.value, team, org, waiting });
      if (!planned.ok) return refused(planned.error);
      const { send, lapsed } = planned.value;
      // The dummy team is seen from DUMMY_NOW, so a request is sent then too.
      const request = { id: nextHandOverId(all), fromId: self, role: send.role, toId: send.to, outcome: send.outcome, sentAt: DUMMY_NOW, answered: null };
      await save(withDummyHandOver(withLapsedHandOvers(edits, lapsed), request));
      return written(null);
    },
    async answerHandOver(requestId, answer) {
      const request = all.find((h) => h.id === requestId && h.answered === null);
      if (!request || self === null) return refused("This hand-over was already answered.");
      const planned = planHandOverAnswer({ viewerId: self, request, answer, team, org });
      if (!planned.ok) return refused(planned.error);
      const plan = planned.value;
      let next = withDummyHandOver(edits, { ...request, answered: { answer: plan.answer === "confirm" ? "confirmed" : "declined", by: self } });
      if (plan.answer === "confirm") {
        const after = confirmedHandOverEdits(next, plan, roster, org);
        if (typeof after === "string") return refused(after);
        next = after;
      }
      const approver = team.find((p) => p.id === self)?.name ?? "";
      next = { ...next, notices: withDummyNotices(next.notices, [answerNoticeOf(plan, team, org)], approver, DUMMY_NOW) };
      await save(next);
      return written(null);
    },
  };
}

/**
 * Email alias requests (epic #538, boards 94 to 94e) as the test developer
 * runs them, with `edits` laid over the arrays: the member drawer's alias,
 * the approvers' rows, Request alias, Cancel request, Decline and Mark
 * created. ./alias-request.ts decides each as the database side does; the
 * requests and the saved aliases live in the edits cookie (./aliases.ts).
 */
export function dummyAliasPages(
  kind: TestViewer,
  edits: TeamEdits,
  save: (next: TeamEdits) => Promise<void>,
  current: readonly DummyApplication[] = baseApplications,
): {
  /** The open requests the viewer answers, as attention rows: none for anyone but the three approver seats. */
  readonly attention: (now: Date) => AttentionItem[];
} & Pick<DashboardData, "memberAliases" | "requestAlias" | "cancelAliasRequest" | "answerAlias"> {
  const self = SELF_ID[kind];
  const standing = testDeveloperStanding(kind);
  const roster = editedRoster(edits, dummyJoiners(current));
  const team = teamPeople(roster, edits);
  const { org } = dummyOrg(edits);
  const all = dummyAliasRequestsOf(edits);
  const open = openAliasRequests(all);
  const addresses = dummyAliasesOf(edits);
  const close = (id: number, outcome: "created" | "declined" | "cancelled") => {
    const request = all.find((r) => r.id === id);
    return request === undefined ? edits : withDummyAliasRequest(edits, { ...request, outcome });
  };
  return {
    attention: (now) => aliasAttentionFor(standing, open, team, org, now),
    memberAliases: async (memberIds) =>
      canReach(standing, "members") ? memberAliasesFor({ viewerId: self, memberIds, team, org, addresses, open, now: new Date(DUMMY_NOW) }) : {},
    async requestAlias(memberId) {
      const planned = planAliasRequest({ requesterId: self, memberId, team, org, alias: addresses.get(memberId) ?? null, open });
      if (!planned.ok) return refused(planned.error);
      // The dummy team is seen from DUMMY_NOW, so a request is sent then too.
      await save(withDummyAliasRequest(edits, { id: nextAliasRequestId(all), memberId, requesterId: planned.value.requesterId, sentAt: DUMMY_NOW, outcome: null }));
      return written(null);
    },
    async cancelAliasRequest(requestId) {
      const request = open.find((r) => r.id === requestId);
      if (!request) return refused("This alias request was already answered.");
      const planned = planAliasCancel({ viewerId: self, request, team, org });
      if (!planned.ok) return refused(planned.error);
      await save(close(requestId, "cancelled"));
      return written(null);
    },
    async answerAlias(requestId, input) {
      const checked = checkAliasAnswer(input);
      if (!checked.ok) return refused(checked.error);
      const request = open.find((r) => r.id === requestId);
      if (!request || self === null) return refused("This alias request was already answered.");
      const planned = planAliasAnswer({ viewer: standing, request, answer: checked.value });
      if (!planned.ok) return refused(planned.error);
      const plan = planned.value;
      const approver = team.find((p) => p.id === self)?.name ?? "";
      const member = team.find((p) => p.id === request.memberId)?.name ?? "";
      let next = close(requestId, plan.kind === "created" ? "created" : "declined");
      if (plan.kind === "created") next = { ...next, aliases: { ...next.aliases, [request.memberId]: plan.address } };
      next = { ...next, notices: withDummyNotices(next.notices, aliasAnswerNotices(plan, approver), member, DUMMY_NOW) };
      await save(next);
      return written(null);
    },
  };
}
