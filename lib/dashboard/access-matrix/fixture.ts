import {
  aliasRequests,
  alumniEntries,
  applicationFiles,
  applications,
  applyPositions,
  dashboardNotices,
  departments,
  divisions,
  handOverRequests,
  interviewSlots,
  members,
  orders,
  recruitmentSetting,
  roles,
  scopes,
  teamJoins,
  users,
} from "@/db/schema";
import { BOARD_SEAT_TITLES } from "../team";
import type { FlaggedSeat, GrantArea } from "../viewer";
import { insertRows, resetFakeDb } from "./fake-db";
import { ALL, UNITS, VIEWERS, type Role, type Unit } from "./matrix";

// The database the server-side access tests read (issue #477): the matrix's
// org, one account per matrix viewer, and in every division a person, a role
// with applications and an interview, a CV and a letter, an order, someone
// waiting to join, a notice and a hand-over. Each unit's private data carries
// a marker (`MARKERS`) naming its area and unit, so an answer that holds a
// marker shows exactly which area of which unit reached the viewer.

const SINCE = "2025-10-01";
const NOW = new Date().toISOString();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

const UNIT_INDEX: Readonly<Record<Unit, number>> = { MA: 1, OA: 2, DM: 3 };
const lower = (u: Unit) => u.toLowerCase();

/** The private strings each unit's data carries, by area. A title is shown where Positions or Applications is read. */
export const MARKERS = {
  /** A role's description: the Positions page's edit drawer. */
  positions: (u: Unit) => [`pos-${lower(u)}-description`],
  /** A role's title: the Positions and Applications pages and the Overview. */
  title: (u: Unit) => [`role-${lower(u)}-title`],
  /** Who applied, what they answered, their files and interviews. */
  applications: (u: Unit) => [`appl-${lower(u)}`, `answer-${lower(u)}`, `cv-${lower(u)}`, `letter-${lower(u)}`],
  /** A person's private details on the Members page, and who waits to join. Their team email is public on the Team page, so no marker. */
  members: (u: Unit) => [`mob-${lower(u)}`, `disc-${lower(u)}`, `join-${lower(u)}`],
  /** An order's item and reason. */
  orders: (u: Unit) => [`ord-${lower(u)}`],
} as const satisfies Record<GrantArea | "title", (u: Unit) => readonly string[]>;

/** Ids of the rows a write test aims at, in each unit. */
export const IDS = {
  division: (u: Unit) => UNITS[u].divisionId,
  department: (u: Unit) => UNITS[u].departmentId,
  person: (u: Unit) => 200 + UNIT_INDEX[u],
  position: (u: Unit) => 10 + UNIT_INDEX[u],
  application: (u: Unit) => 30 + UNIT_INDEX[u],
  interview: (u: Unit) => 40 + UNIT_INDEX[u],
  joining: (u: Unit) => 45 + UNIT_INDEX[u],
  slot: (u: Unit) => 50 + UNIT_INDEX[u],
  order: (u: Unit) => 60 + UNIT_INDEX[u],
  approvedOrder: (u: Unit) => 65 + UNIT_INDEX[u],
  join: (u: Unit) => 70 + UNIT_INDEX[u],
  notice: (u: Unit) => 80 + UNIT_INDEX[u],
  handOver: (u: Unit) => 90 + UNIT_INDEX[u],
  aliasRequest: (u: Unit) => 95 + UNIT_INDEX[u],
  lead: (u: Unit) => 300 + UNIT_INDEX[u],
  cvFile: (u: Unit) => 400 + UNIT_INDEX[u],
  letterFile: (u: Unit) => 500 + UNIT_INDEX[u],
} as const;

/** The CV's pathname in the private store, and the file hash the old file route is addressed by. */
export const cvPathname = (u: Unit) => `applications/cv-${lower(u)}.pdf`;
export const cvHash = (u: Unit) => `hash-cv-${lower(u)}`;

/** The account each matrix viewer signs in as. */
export function accountOf(name: string): { readonly userId: string; readonly memberId: number | null } {
  const index = VIEWERS.findIndex((v) => v.name === name);
  if (index === -1) throw new Error(`no matrix viewer ${name}`);
  return { userId: `viewer-${index}`, memberId: VIEWERS[index].viewer.kind === "non-member" ? null : 100 + index };
}

const DB_SEAT = {
  "operations-lead": "operations_lead",
  "it-lead": "it_lead",
  "project-manager": "project_manager",
  "chief-engineer": "chief_engineer",
} as const satisfies Record<FlaggedSeat, string>;

/** A role's title as stored: a board seat's role is titled by the seat (Project Manager, Chief Engineer), as on the real data. */
function titleOf(r: Role): string {
  if (r.fullAccess === "project-manager" || r.fullAccess === "chief-engineer") return BOARD_SEAT_TITLES[r.fullAccess];
  return r.type === "president" ? "Team Leader" : r.type === "head" ? "Head" : r.type === "lead" ? "Division Lead" : "Member";
}

function seedViewers(): void {
  VIEWERS.forEach(({ name, viewer }) => {
    const { userId, memberId } = accountOf(name);
    insertRows(users, [{ id: userId, email: `${userId}@team.test`, firstName: "Viewer", lastName: userId, member: memberId, createdAt: SINCE }]);
    if (memberId === null) return;
    insertRows(members, [{ memberId, ndaSignedAt: SINCE }]);
    insertRows(
      roles,
      viewer.heldRoles.map((r, i) => ({
        id: 1_000 + memberId * 10 + i,
        memberId,
        deptId: r.type === "head" ? r.departmentId : null,
        divisionId: r.type === "head" ? null : r.divisionId,
        title: titleOf(r),
        startedAt: SINCE,
        type: r.type,
        fullAccess: r.fullAccess === null ? null : DB_SEAT[r.fullAccess],
      })),
    );
    if (viewer.onAlumniRecord) {
      // An alumnus: a role they left, and their entry on the Alumni record.
      insertRows(roles, [{ id: 1_000 + memberId * 10, memberId, divisionId: 1, title: "Member", startedAt: SINCE, leavedAt: "2026-06-01", type: "core" }]);
      insertRows(alumniEntries, [{ id: 700 + memberId, kind: "member", memberId, shown: true, createdAt: SINCE }]);
    }
    insertRows(
      scopes,
      viewer.rawRows.map((r, i) => ({
        id: 2_000 + memberId * 10 + i,
        memberId,
        scope: r.scope,
        target: r.target,
        accessLevel: r.level,
        divisionId: r.divisionId,
        deptId: r.deptId,
      })),
    );
  });
}

function seedUnit(u: Unit): void {
  const { divisionId } = UNITS[u];
  const l = lower(u);
  // A member of the division, with the private details the Members page shows.
  const person = IDS.person(u);
  insertRows(members, [{ memberId: person, mobileNumber: `mob-${l}`, prtEmail: `prt-${l}@team.test`, discord: `disc-${l}`, ndaSignedAt: SINCE }]);
  insertRows(users, [{ id: `person-${l}`, email: `person-${l}@mail.test`, firstName: "Person", lastName: u, member: person, createdAt: SINCE }]);
  insertRows(roles, [{ id: 5_000 + person, memberId: person, divisionId, title: "Member", startedAt: SINCE, type: "core" }]);
  // Its lead, who has asked to hand the division over.
  const lead = IDS.lead(u);
  insertRows(members, [{ memberId: lead, ndaSignedAt: SINCE }]);
  insertRows(users, [{ id: `lead-${l}`, email: `lead-${l}@mail.test`, firstName: "Lead", lastName: u, member: lead, createdAt: SINCE }]);
  insertRows(roles, [{ id: 5_000 + lead, memberId: lead, divisionId, title: "Division Lead", startedAt: SINCE, type: "lead" }]);
  // DM's lead has sent one, waiting for the team leader: Structures has no head.
  if (u === "DM") insertRows(handOverRequests, [{ id: IDS.handOver(u), fromId: lead, role: "lead", divisionId, toId: person, outcome: "advisor", createdAt: daysAgo(1) }]);
  insertRows(dashboardNotices, [{ id: IDS.notice(u), recipientId: lead, kind: "member-left", subjectId: person, data: {}, createdAt: daysAgo(1) }]);
  // An email alias the site asked for the lead by itself (epic #538), open for the three approver seats.
  insertRows(aliasRequests, [{ id: IDS.aliasRequest(u), memberId: lead, requestedBy: null, createdAt: daysAgo(1) }]);
  // Someone the lead added, waiting for the NDA.
  insertRows(users, [{ id: `joiner-${l}`, email: `join-${l}@mail.test`, firstName: "Joiner", lastName: u, createdAt: SINCE }]);
  insertRows(teamJoins, [{ id: IDS.join(u), userId: `joiner-${l}`, divisionId, title: "Member", prtEmail: `join-${l}@team.test`, addedBy: lead, addedAt: daysAgo(2) }]);
  // An open role with a new application, and one at interview with a time offered.
  insertRows(applyPositions, [
    {
      id: IDS.position(u),
      status: true,
      divisionId,
      title: `role-${l}-title`,
      description: `pos-${l}-description`,
      requiredSkills: ["x"],
      desirableSkills: [],
      customQuestions: ["Why?"],
      createdAt: daysAgo(60),
      requiresMotivationLetter: true,
      isDeleted: false,
    },
  ]);
  insertRows(users, [
    { id: `applicant-${l}`, email: `appl-${l}@mail.test`, firstName: "Applicant", lastName: `appl-${l}`, phone: `appl-${l}-phone`, createdAt: SINCE },
    { id: `interviewee-${l}`, email: `appl-${l}-interviewee@mail.test`, firstName: "Interviewee", lastName: `appl-${l}`, createdAt: SINCE },
    { id: `joining-${l}`, email: `appl-${l}-joining@mail.test`, firstName: "Joining", lastName: `appl-${l}`, createdAt: SINCE },
  ]);
  insertRows(applicationFiles, [
    { id: IDS.cvFile(u), pathname: cvPathname(u), originalFilename: `cv-${l}.pdf`, fileHash: cvHash(u), fileSize: 1, uploadedAt: daysAgo(3), userId: `applicant-${l}` },
    { id: IDS.letterFile(u), pathname: `applications/letter-${l}.pdf`, originalFilename: `letter-${l}.pdf`, fileHash: `hash-letter-${l}`, fileSize: 1, uploadedAt: daysAgo(3), userId: `applicant-${l}` },
  ]);
  insertRows(applications, [
    {
      id: IDS.application(u),
      applyPositionId: IDS.position(u),
      userId: `applicant-${l}`,
      cvFileId: IDS.cvFile(u),
      coverLetterFileId: IDS.letterFile(u),
      cvName: `cv-${l}.pdf`,
      mlName: `letter-${l}.pdf`,
      appliedAt: daysAgo(3),
      status: "received",
      customAnswers: [{ question: "Why?", answer: `answer-${l}` }],
    },
    {
      id: IDS.interview(u),
      applyPositionId: IDS.position(u),
      userId: `interviewee-${l}`,
      appliedAt: daysAgo(10),
      status: "interview",
      customAnswers: [{ question: "Why?", answer: `answer-${l}-interviewee` }],
    },
    // Accepted, the signed NDA in: joining the division once the lead confirms.
    {
      id: IDS.joining(u),
      applyPositionId: IDS.position(u),
      userId: `joining-${l}`,
      appliedAt: daysAgo(20),
      status: "accepted",
      acceptedAt: daysAgo(15),
      ndaArrivedAt: daysAgo(5),
      customAnswers: [{ question: "Why?", answer: `answer-${l}-joining` }],
    },
  ]);
  insertRows(interviewSlots, [{ id: IDS.slot(u), applicationId: IDS.interview(u), startsAt: new Date(Date.now() + DAY).toISOString(), endsAt: new Date(Date.now() + DAY + 3_600_000).toISOString(), createdAt: daysAgo(1) }]);
  // An order the division placed, waiting for a decision, and one approved, waiting to be ordered.
  insertRows(orders, [
    { id: IDS.order(u), status: "pending", requester: person, description: `ord-${l} item`, reason: `ord-${l} reason`, quantity: 1, price: "10", name: `ord-${l}`, createdAt: daysAgo(4), divisionId },
    { id: IDS.approvedOrder(u), status: "accepted", requester: person, description: `ord-${l} approved`, reason: `ord-${l} reason`, quantity: 1, price: "10", name: `ord-${l}-approved`, createdAt: daysAgo(6), divisionId },
  ]);
}

/**
 * Rows only the write tests aim at, beside the matrix's units: Structures'
 * head, who answers the DM lead's hand-over; a member of DM who is also in
 * Testing, so DM can let them go; an empty division and an empty department
 * to close; and a grant someone in DM holds, to take away.
 */
export const EXTRA = {
  head: 310,
  mover: 311,
  testing: 4,
  emptyDivision: 5,
  emptyDepartment: 3,
} as const;

function seedExtras(): void {
  insertRows(departments, [{ id: EXTRA.emptyDepartment, name: "Spare", startedAt: SINCE, code: "SPR", kind: "technical" }]);
  insertRows(divisions, [
    { id: EXTRA.testing, deptId: 2, name: "Testing", startedAt: SINCE, code: "TST" },
    { id: EXTRA.emptyDivision, deptId: 2, name: "Empty", startedAt: SINCE, code: "EMP" },
  ]);
  insertRows(members, [
    { memberId: EXTRA.head, ndaSignedAt: SINCE },
    { memberId: EXTRA.mover, ndaSignedAt: SINCE },
  ]);
  insertRows(users, [
    { id: "head-str", email: "head-str@mail.test", firstName: "Head", lastName: "Structures", member: EXTRA.head, createdAt: SINCE },
    { id: "mover", email: "mover@mail.test", firstName: "Mover", lastName: "Twice", member: EXTRA.mover, createdAt: SINCE },
  ]);
  insertRows(roles, [
    { id: 6_000, memberId: EXTRA.head, deptId: 2, title: "Head", startedAt: SINCE, type: "head" },
    { id: 6_001, memberId: EXTRA.mover, divisionId: UNITS.DM.divisionId, title: "Member", startedAt: SINCE, type: "core" },
    { id: 6_002, memberId: EXTRA.mover, divisionId: EXTRA.testing, title: "Member", startedAt: SINCE, type: "core" },
  ]);
  insertRows(scopes, [{ id: 6_100, memberId: IDS.person("DM"), scope: "division", target: "members", accessLevel: "view", divisionId: UNITS.DM.divisionId }]);
}

/** Empties the fake database and seeds the org, every matrix viewer and every unit. */
export function seedFixture(): void {
  resetFakeDb();
  insertRows(departments, [
    { id: 1, name: "Aerodynamics", startedAt: SINCE, code: "AER", kind: "technical" },
    { id: 2, name: "Structures", startedAt: SINCE, code: "STR", kind: "technical" },
  ]);
  insertRows(
    divisions,
    ALL.map((u) => ({
      id: UNITS[u].divisionId,
      deptId: UNITS[u].departmentId,
      name: { MA: "Mission Analysis", OA: "Optimization", DM: "Design & Manufacturing" }[u],
      startedAt: SINCE,
      code: { MA: "MSA", OA: "OPT", DM: "DMA" }[u],
    })),
  );
  seedExtras();
  insertRows(recruitmentSetting, [{ id: true, isOpen: true, updatedAt: NOW }]);
  seedViewers();
  for (const u of ALL) seedUnit(u);
}
