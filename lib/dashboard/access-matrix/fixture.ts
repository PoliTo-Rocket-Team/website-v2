import {
  aliasRequests,
  alumniEntries,
  applicationFiles,
  applications,
  applyPositions,
  betterAuthAccounts,
  betterAuthUsers,
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
import { BREAK_GLASS_SETTING } from "@/lib/break-glass";
import { BOARD_FLAG_TITLES } from "../team";
import type { FlaggedSeat, GrantArea, SeatFlag } from "../viewer";
import { addRows, changeRows, removeRows, restore, tableRows } from "./test-database";
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
  /**
   * A person's private details on the Members page, the other Google account
   * the unit's lead signs in with (issue #908), and who waits to join. Their team email is
   * public on the Team page, so no marker.
   */
  members: (u: Unit) => [`mob-${lower(u)}`, `disc-${lower(u)}`, `gacct-${lower(u)}`, `join-${lower(u)}`],
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

/** The account each matrix viewer signs in as. The non-member and the break-glass admin have no member row. */
export function accountOf(name: string): { readonly userId: string; readonly memberId: number | null } {
  const index = VIEWERS.findIndex((v) => v.name === name);
  if (index === -1) throw new Error(`no matrix viewer ${name}`);
  const { viewer } = VIEWERS[index];
  return { userId: `viewer-${index}`, memberId: viewer.kind === "non-member" || viewer.breakGlass ? null : 100 + index };
}

/**
 * The placeholder sign-in email of the break-glass matrix viewer (issue
 * #646), on the reserved `.test` domain. The break-glass setting names it for
 * every test that reads this fixture, so that viewer stands as the team
 * leader and no other account's email matches it.
 */
export const BREAK_GLASS_EMAIL = "break-glass-admin@team.test";
process.env[BREAK_GLASS_SETTING] = BREAK_GLASS_EMAIL;

/** The sign-in email of a matrix viewer's account. */
function emailOf(userId: string, breakGlass: boolean): string {
  return breakGlass ? BREAK_GLASS_EMAIL : `${userId}@team.test`;
}

const DB_SEAT = {
  "operations-lead": "operations_lead",
  "it-lead": "it_lead",
  "project-manager": "project_manager",
  "chief-engineer": "chief_engineer",
} as const satisfies Record<FlaggedSeat, string>;

/** A role's title as stored: a board seat's role is titled by the seat (Project Manager, Chief Engineer), as on the real data. */
function titleOf(r: Role): string {
  if (r.fullAccess === "project-manager" || r.fullAccess === "chief-engineer") return BOARD_FLAG_TITLES[r.fullAccess];
  return r.type === "president" ? "Team Leader" : r.type === "head" ? "Head" : r.type === "lead" ? "Division Lead" : "Member";
}

type RoleRow = typeof roles.$inferInsert;

/**
 * The seats a role row holds that the fixture gives one active role each:
 * the team leader's, a full-access seat, a department's head. The database
 * takes several holders of a seat (drizzle/0077, epic #861); the fixture
 * keeps one, so each matrix viewer's seat is read as theirs alone.
 */
function seatsOf(r: Pick<RoleRow, "type" | "deptId" | "fullAccess">): string[] {
  return [
    ...(r.type === "president" ? ["team-leader"] : []),
    ...(r.fullAccess != null ? [`full-access:${r.fullAccess}`] : []),
    ...(r.type === "head" && r.deptId != null ? [`head:${r.deptId}`] : []),
  ];
}

/**
 * Each matrix viewer's role rows, split by seat. Several viewers hold one
 * seat (the operations lead with and without Approve orders, the department
 * head with each grant), and the fixture keeps one active holder per seat.
 * The first viewer in the matrix to hold a seat sits in it in the fixture;
 * a later one's row is `benched`, kept out of the fixture until they sign in
 * (`seatSignedIn`).
 */
const VIEWER_ROLES = (() => {
  const taken = new Set<string>();
  const seated: RoleRow[] = [];
  const benched = new Map<string, RoleRow[]>();
  for (const { name, viewer } of VIEWERS) {
    const { userId, memberId } = accountOf(name);
    if (memberId === null) continue;
    viewer.heldRoles.forEach((r, i) => {
      const row: RoleRow = {
        id: 1_000 + memberId * 10 + i,
        memberId,
        deptId: r.type === "head" ? r.departmentId : null,
        divisionId: r.type === "head" ? null : r.divisionId,
        title: titleOf(r),
        startedAt: SINCE,
        type: r.type,
        fullAccess: r.fullAccess === null ? null : DB_SEAT[r.fullAccess],
      };
      const seats = seatsOf(row);
      if (seats.some((s) => taken.has(s))) benched.set(userId, [...(benched.get(userId) ?? []), row]);
      else {
        seats.forEach((s) => taken.add(s));
        seated.push(row);
      }
    });
  }
  return { seated, benched };
})();

/**
 * Puts a signed-in matrix viewer in the seat they share with an earlier
 * viewer: the seat's holder's role row is removed and theirs added, so the
 * fixture still has one active holder and it is them. The fake session
 * (./fakes/current-user.ts) calls this as each server call reads who is
 * signed in. A viewer already seated, or whose row a test has changed, is
 * left as it is.
 */
export async function seatSignedIn(userId: string): Promise<void> {
  const benched = VIEWER_ROLES.benched.get(userId);
  if (benched === undefined) return;
  const stored = (await tableRows(roles)) as RoleRow[];
  const memberIds = new Set((await tableRows(members)).map((m) => m.memberId));
  for (const row of benched) {
    if (stored.some((r) => r.id === row.id) || !memberIds.has(row.memberId)) continue;
    const seats = seatsOf(row);
    const holders = stored.filter((r) => r.leavedAt === null && seatsOf(r).some((s) => seats.includes(s)));
    for (const holder of holders) await removeRows(roles, { id: holder.id });
    await addRows(roles, [row]);
  }
}

/**
 * Moves the full-access seat `flag` onto role row `rowId`: the flag comes
 * off the row holding it (a matrix viewer's), so one active row holds it,
 * as the fixture keeps it. A test's setup, as `changeRows` is.
 */
export async function moveSeatOnto(rowId: number, flag: SeatFlag): Promise<void> {
  await changeRows(roles, { fullAccess: flag }, { fullAccess: null });
  await changeRows(roles, { id: rowId }, { fullAccess: flag });
}

async function seedViewers(): Promise<void> {
  for (const { name, viewer } of VIEWERS) {
    const { userId, memberId } = accountOf(name);
    if (memberId !== null) await addRows(members, [{ memberId, ndaSignedAt: SINCE }]);
    await addRows(users, [{ id: userId, email: emailOf(userId, viewer.breakGlass), firstName: "Viewer", lastName: userId, member: memberId, createdAt: SINCE }]);
    // The break-glass setting is matched against the Better Auth account's email, the one Google signs in with.
    if (viewer.breakGlass) {
      await addRows(betterAuthUsers, [{ id: userId, name: `Viewer ${userId}`, email: BREAK_GLASS_EMAIL, emailVerified: true }]);
    }
    if (memberId === null) continue;
    await addRows(roles, VIEWER_ROLES.seated.filter((r) => r.memberId === memberId));
    if (viewer.onAlumniRecord) {
      // An alumnus: a role they left, and their entry on the Alumni record.
      await addRows(roles, [{ id: 1_000 + memberId * 10, memberId, divisionId: 1, title: "Member", startedAt: SINCE, leavedAt: "2026-06-01", type: "core" }]);
      await addRows(alumniEntries, [{ id: 700 + memberId, kind: "member", memberId, shown: true, createdAt: SINCE }]);
    }
    await addRows(
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
  }
}

async function seedUnit(u: Unit): Promise<void> {
  const { divisionId } = UNITS[u];
  const l = lower(u);
  // A member of the division, with the private details the Members page shows.
  // Their PRT email is empty, so whoever may manage them may request their
  // alias (issue #563): the alias is saved there.
  const person = IDS.person(u);
  await addRows(members, [{ memberId: person, mobileNumber: `mob-${l}`, discord: `disc-${l}`, ndaSignedAt: SINCE }]);
  await addRows(users, [{ id: `person-${l}`, email: `person-${l}@mail.test`, firstName: "Person", lastName: u, member: person, createdAt: SINCE }]);
  await addRows(roles, [{ id: 5_000 + person, memberId: person, divisionId, title: "Member", startedAt: SINCE, type: "core" }]);
  // Its lead, who has asked to hand the division over.
  const lead = IDS.lead(u);
  await addRows(members, [{ memberId: lead, ndaSignedAt: SINCE }]);
  await addRows(users, [{ id: `lead-${l}`, email: `lead-${l}@mail.test`, firstName: "Lead", lastName: u, member: lead, createdAt: SINCE }]);
  // The lead signs in with Google as that email, and with a second Google account linked to it (issue #908).
  await addRows(betterAuthUsers, [{ id: `lead-${l}`, name: `Lead ${u}`, email: `lead-${l}@mail.test`, emailVerified: true }]);
  await addRows(betterAuthAccounts, [
    { id: `account-${l}-1`, accountId: `google-${l}-1`, providerId: "google", userId: `lead-${l}`, email: `lead-${l}@mail.test`, createdAt: new Date(SINCE), updatedAt: new Date(SINCE) },
    { id: `account-${l}-2`, accountId: `google-${l}-2`, providerId: "google", userId: `lead-${l}`, email: `gacct-${l}@mail.test`, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  ]);
  await addRows(roles, [{ id: 5_000 + lead, memberId: lead, divisionId, title: "Division Lead", startedAt: SINCE, type: "lead" }]);
  // DM's lead has sent one, waiting for the team leader: Structures has no head.
  if (u === "DM") await addRows(handOverRequests, [{ id: IDS.handOver(u), fromId: lead, role: "lead", divisionId, toId: person, outcome: "advisor", createdAt: daysAgo(1) }]);
  await addRows(dashboardNotices, [{ id: IDS.notice(u), recipientId: lead, kind: "member-left", subjectId: person, data: {}, createdAt: daysAgo(1) }]);
  // An email alias the site asked for the lead by itself (epic #538), open for the three approver seats.
  await addRows(aliasRequests, [{ id: IDS.aliasRequest(u), memberId: lead, requestedBy: null, createdAt: daysAgo(1) }]);
  // Someone the lead added, waiting for the NDA.
  await addRows(users, [{ id: `joiner-${l}`, email: `join-${l}@mail.test`, firstName: "Joiner", lastName: u, createdAt: SINCE }]);
  await addRows(teamJoins, [{ id: IDS.join(u), userId: `joiner-${l}`, divisionId, title: "Member", prtEmail: `join-${l}@team.test`, addedBy: lead, addedAt: daysAgo(2) }]);
  // An open role with a new application, and one at interview with a time offered.
  await addRows(applyPositions, [
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
  await addRows(users, [
    { id: `applicant-${l}`, email: `appl-${l}@mail.test`, firstName: "Applicant", lastName: `appl-${l}`, phone: `appl-${l}-phone`, createdAt: SINCE },
    { id: `interviewee-${l}`, email: `appl-${l}-interviewee@mail.test`, firstName: "Interviewee", lastName: `appl-${l}`, createdAt: SINCE },
    { id: `joining-${l}`, email: `appl-${l}-joining@mail.test`, firstName: "Joining", lastName: `appl-${l}`, createdAt: SINCE },
  ]);
  await addRows(applicationFiles, [
    { id: IDS.cvFile(u), pathname: cvPathname(u), originalFilename: `cv-${l}.pdf`, fileHash: cvHash(u), fileSize: 1, uploadedAt: daysAgo(3), userId: `applicant-${l}` },
    { id: IDS.letterFile(u), pathname: `applications/letter-${l}.pdf`, originalFilename: `letter-${l}.pdf`, fileHash: `hash-letter-${l}`, fileSize: 1, uploadedAt: daysAgo(3), userId: `applicant-${l}` },
  ]);
  await addRows(applications, [
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
      statusKey: "new",
      customAnswers: [{ question: "Why?", answer: `answer-${l}` }],
    },
    {
      id: IDS.interview(u),
      applyPositionId: IDS.position(u),
      userId: `interviewee-${l}`,
      appliedAt: daysAgo(10),
      status: "interview",
      statusKey: "interview",
      customAnswers: [{ question: "Why?", answer: `answer-${l}-interviewee` }],
    },
    // Accepted, the signed NDA in: joining the division once the lead confirms.
    {
      id: IDS.joining(u),
      applyPositionId: IDS.position(u),
      userId: `joining-${l}`,
      appliedAt: daysAgo(20),
      status: "accepted",
      statusKey: "nda_received",
      acceptedAt: daysAgo(15),
      ndaArrivedAt: daysAgo(5),
      customAnswers: [{ question: "Why?", answer: `answer-${l}-joining` }],
    },
  ]);
  await addRows(interviewSlots, [{ id: IDS.slot(u), applicationId: IDS.interview(u), startsAt: new Date(Date.now() + DAY).toISOString(), endsAt: new Date(Date.now() + DAY + 3_600_000).toISOString(), createdAt: daysAgo(1) }]);
  // An order the division placed, waiting for a decision, and one approved, waiting to be ordered.
  await addRows(orders, [
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

async function seedExtras(): Promise<void> {
  await addRows(departments, [{ id: EXTRA.emptyDepartment, name: "Spare", startedAt: SINCE, code: "SPR", kind: "technical" }]);
  await addRows(divisions, [
    { id: EXTRA.testing, deptId: 2, name: "Testing", startedAt: SINCE, code: "TST" },
    { id: EXTRA.emptyDivision, deptId: 2, name: "Empty", startedAt: SINCE, code: "EMP" },
  ]);
  await addRows(members, [
    { memberId: EXTRA.head, ndaSignedAt: SINCE },
    { memberId: EXTRA.mover, ndaSignedAt: SINCE },
  ]);
  await addRows(users, [
    { id: "head-str", email: "head-str@mail.test", firstName: "Head", lastName: "Structures", member: EXTRA.head, createdAt: SINCE },
    { id: "mover", email: "mover@mail.test", firstName: "Mover", lastName: "Twice", member: EXTRA.mover, createdAt: SINCE },
  ]);
  await addRows(roles, [
    { id: 6_000, memberId: EXTRA.head, deptId: 2, title: "Head", startedAt: SINCE, type: "head" },
    { id: 6_001, memberId: EXTRA.mover, divisionId: UNITS.DM.divisionId, title: "Member", startedAt: SINCE, type: "core" },
    { id: 6_002, memberId: EXTRA.mover, divisionId: EXTRA.testing, title: "Member", startedAt: SINCE, type: "core" },
  ]);
}

/**
 * Puts the test database back to a freshly migrated one with the org, every
 * matrix viewer and every unit inserted (./test-database.ts): the rows are
 * inserted once per test file, and each later call restores them.
 */
export function seedFixture(): Promise<void> {
  return restore("fixture", loadFixture);
}

async function loadFixture(): Promise<void> {
  await addRows(departments, [
    { id: 1, name: "Aerodynamics", startedAt: SINCE, code: "AER", kind: "technical" },
    { id: 2, name: "Structures", startedAt: SINCE, code: "STR", kind: "technical" },
  ]);
  await addRows(
    divisions,
    ALL.map((u) => ({
      id: UNITS[u].divisionId,
      deptId: UNITS[u].departmentId,
      name: { MA: "Mission Analysis", OA: "Optimization", DM: "Design & Manufacturing" }[u],
      startedAt: SINCE,
      code: { MA: "MSA", OA: "OPT", DM: "DMA" }[u],
    })),
  );
  await seedExtras();
  // The migrations store the recruitment switch's one row (drizzle/0006): it is on.
  await changeRows(recruitmentSetting, { id: true }, { isOpen: true, updatedAt: NOW });
  await seedViewers();
  for (const u of ALL) await seedUnit(u);
  // The grant someone in DM holds, once they are on the team.
  await addRows(scopes, [{ id: 6_100, memberId: IDS.person("DM"), scope: "division", target: "members", accessLevel: "view", divisionId: UNITS.DM.divisionId }]);
}
