import "server-only";

import { and, asc, count, eq, inArray, isNull, max, min, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateTag } from "next/cache";
import { getRecruitmentControl, PUBLIC_POSITIONS_CACHE_TAG } from "@/app/actions/get-apply-positions";
import { getScopeInfoForCurrentUser } from "@/app/actions/get-member-scopes";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  applications,
  applyPositions,
  departments,
  divisions,
  members,
  recruitmentSetting,
  roles,
  scopes,
  users,
} from "@/db/schema";
import type { Recruitment } from "@/lib/apply/positions";
import { canSwitchRecruitment, switchRecruitment } from "@/lib/apply/recruitment-switch";
import { getCurrentUserId } from "@/lib/current-user";
import { runAuditQuery } from "@/lib/db-audit";
import { canReach, LANDING_AFTER_LEAVING, type NavCounts } from "./access";
import { isShownAt } from "./my-applications";
import { DashboardRefused, type DashboardData } from "./data";
import {
  buildTeamTree,
  seasonAt,
  teamDirectory,
  type MemberDirectory,
  type RoleType,
} from "./team";
import { readTeamSnapshot, recordsOf, rosterOf } from "./team-database";
import { departmentSummaries, leaderAttention, leaderStats } from "./leader-overview";
import { wholeTeamMembers } from "./team-members";
import { databaseAlumniWrites, databaseOwnAlumni, readAlumniDirectory, readOwnAlumnus } from "./database-alumni";
import { formatEuro, ordersOfDivisions, waitingOrders } from "./orders";
import {
  checklistProgress,
  divisionRoster,
  divisionShortName,
  noPhotoItem,
  oldestLine,
  type AttentionItem,
  type ChecklistItem,
  type DepartmentOverview,
  type DivisionOverview,
  type DivisionSummary,
  type PersonalOverview,
  type TeamLeaderOverview,
  type TeamOverview,
  type TeamSideOverview,
  type UpcomingInterview,
} from "./overview";
import { databaseDivisionPages, readHeadDepartment, readOrdersIn } from "./database-division";
import { databaseRecruitmentPages, readSlots } from "./database-recruitment";
import { answerHandOver, databaseTeamWrites, findForAdd, findPeople, readDivisionMembers, readTeamStructure } from "./database-team";
import { databaseSelfPages } from "./database-self";
import { blobLogoFiles, databasePartnerStore } from "./database-partners";
import { partnerEditor } from "@/lib/partners-editor";
import { faqEditor } from "@/lib/faq/editor";
import { databaseFaqStore } from "./database-faqs";
import { team as teamRecord } from "@/lib/about/team";
import { teamPageEditor } from "@/lib/about/team-page-editor";
import { databaseTeamRoles } from "@/lib/about/team-data";
import { currentAcademicYearStart } from "@/lib/about/academic-year";
import { databaseTeamPageLayerStore } from "./database-team-page";
import { advisorEditor } from "@/lib/about/advisors";
import { databaseAdvisorStore } from "./database-team-advisors";
import { blobPhotoFiles, databaseOutreachStore } from "./database-outreach";
import { outreachEditor } from "@/lib/outreach-editor";
import { projectEditor } from "@/lib/project-content/editor";
import { blobProjectPhotoFiles, databaseProjectStore, readProjectStamps } from "./database-projects";
import { dismissNotice, readNoticeAttention } from "./database-notices";
import { readHandOverAttention, sendHandOver } from "./database-hand-over";
import { upcomingInterviews } from "./interview-slots";
import { SEAT_OF_FLAG, VIEWER_KIND_LABELS, areaGrantsOf, isOffTeam, isTeamLeader, readsAsDivisionLead, standingOf, unitRowsOf, viewerStandingOf, viewerUnitsOf, type AreaGrant, type DashboardViewer, type FlaggedSeat, type ViewerStanding } from "./viewer";
import { written } from "./write";

// The signed-in account's side of the dashboard data interface: the same
// answers as lib/dummy-data/, read from the database. Reads follow
// .patterns/drizzle-reads.md: getDb() per call, closed units and deleted
// positions left out.

type ActiveRole = {
  title: string;
  type: RoleType;
  startedAt: string;
  divisionId: number | null;
  divisionName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  /** The full-access seat the role is flagged as (issue #238). */
  fullAccess: FlaggedSeat | null;
};


type Identity = {
  userId: string;
  name: string;
  email: string;
  linkedin: string | null;
  memberId: number | null;
  picture: string | null;
  /**
   * The role a single-division page names (`primaryRole`): their highest, the
   * oldest of those. Pages that still show one division read it (#231).
   */
  role: ActiveRole | null;
  /** Every role they hold now, oldest first (issue #229). */
  roles: readonly ActiveRole[];
  /** The divisions and departments a lead's figures cover: their roles' units and their grants'. */
  divisionIds: number[];
  departmentIds: number[];
  /** Each area grant they hold, with its area and level: what a recruitment change checks (`mayChange`, issue #160). */
  grants: readonly AreaGrant[];
} & ViewerStanding;

/** Who the signed-in account is; the page modules beside this one read it. */
export type DashboardIdentity = Identity;

async function readIdentity(userId: string): Promise<Identity | null> {
  const db = getDb();
  const [user] = await db
    .select({
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      linkedin: users.linkedin,
      member_id: users.member,
      picture: members.picture,
    })
    .from(users)
    .leftJoin(members, eq(users.member, members.memberId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const base = {
    userId,
    name,
    email: user.email,
    linkedin: user.linkedin,
    memberId: user.member_id,
    picture: user.picture,
  };
  if (user.member_id === null) {
    return { ...base, role: null, roles: [], divisionIds: [], departmentIds: [], grants: [], ...viewerStandingOf(null) };
  }

  const [scopeRows, roleRows] = await Promise.all([
    db
      .select({
        scope: scopes.scope,
        target: scopes.target,
        level: scopes.accessLevel,
        division_id: scopes.divisionId,
        dept_id: scopes.deptId,
      })
      .from(scopes)
      .where(eq(scopes.memberId, user.member_id)),
    db
      .select({
        title: roles.title,
        type: roles.type,
        startedAt: roles.startedAt,
        divisionId: roles.divisionId,
        divisionName: divisions.name,
        departmentId: departments.id,
        departmentName: departments.name,
        fullAccess: roles.fullAccess,
      })
      .from(roles)
      .leftJoin(divisions, eq(roles.divisionId, divisions.id))
      // A head's role names its department; a lead's names it through the division (issue #230).
      .leftJoin(departments, eq(departments.id, sql`coalesce(${roles.deptId}, ${divisions.deptId})`))
      .where(and(eq(roles.memberId, user.member_id), isNull(roles.leavedAt)))
      .orderBy(asc(roles.startedAt)),
  ]);
  const activeRoles: ActiveRole[] = roleRows.map((r) => ({ ...r, fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess] }));

  // A grant across the whole team stands for every open department (issue #247).
  const wholeTeam = scopeRows.some((s) => s.scope === "team" && s.target !== "approve_orders");
  const openDepartmentIds = wholeTeam
    ? (await db.select({ id: departments.id }).from(departments).where(isNull(departments.closedAt))).map((d) => d.id)
    : [];
  const unitRows = unitRowsOf(
    scopeRows.map((s) => ({ scope: s.scope, target: s.target, level: s.level, divisionId: s.division_id, deptId: s.dept_id })),
    openDepartmentIds,
  );
  // Someone with no active role left the team: an alumnus when the Alumni record knows them (issue #317).
  const onAlumniRecord = activeRoles.length === 0 && (await readOwnAlumnus(user.member_id)) !== null;
  const access = { scopes: unitRows, activeRoles, onAlumniRecord };
  const standing = viewerStandingOf(access);
  // Off the team, scope rows that outlived the roles reach nothing.
  if (isOffTeam(standing.kind)) return { ...base, role: null, roles: [], divisionIds: [], departmentIds: [], grants: [], ...standing };

  // Every division they lead and the department they head, plus the units their scopes name.
  const units = viewerUnitsOf(unitRows, activeRoles);
  return {
    ...base,
    role: primaryRole(activeRoles),
    roles: activeRoles,
    divisionIds: [...units.divisionIds],
    departmentIds: [...units.departmentIds],
    grants: areaGrantsOf(unitRows),
    ...standing,
  };
}

const ROLE_RANK: Readonly<Record<NonNullable<ActiveRole["type"]>, number>> = { president: 0, head: 1, lead: 2, core: 3, advisor: 3 };

/** Their highest role, the oldest of those when they hold several: a lead role over a member role. */
function primaryRole(active: readonly ActiveRole[]): ActiveRole | null {
  const rank = (r: ActiveRole) => (r.type === null ? 4 : ROLE_RANK[r.type]);
  return [...active].sort((a, b) => rank(a) - rank(b) || a.startedAt.localeCompare(b.startedAt))[0] ?? null;
}

type ScopedPosition = {
  id: number;
  title: string;
  open: boolean;
  divisionId: number;
  divisionName: string;
  departmentName: string;
  newApplications: number;
  /** When the oldest unread application came in; null when there is none. */
  oldestNew: Date | null;
};

/** Open org units' live positions the viewer's figures cover, with their unread application counts. */
async function readPositions(identity: Identity): Promise<ScopedPosition[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: applyPositions.id,
      title: applyPositions.title,
      status: applyPositions.status,
      division_id: divisions.id,
      division_name: divisions.name,
      dept_id: departments.id,
      dept_name: departments.name,
    })
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(
      and(eq(applyPositions.isDeleted, false), isNull(divisions.closedAt), isNull(departments.closedAt)),
    );

  const scoped =
    identity.kind === "operations-lead"
      ? rows
      : rows.filter(
          (r) => identity.divisionIds.includes(r.division_id) || identity.departmentIds.includes(r.dept_id),
        );
  if (scoped.length === 0) return [];

  const unread = await db
    .select({ position_id: applications.applyPositionId, n: count(), oldest: min(applications.appliedAt) })
    .from(applications)
    .where(
      and(
        eq(applications.status, "received"),
        isNull(applications.withdrawnAt),
        inArray(
          applications.applyPositionId,
          scoped.map((r) => r.id),
        ),
      ),
    )
    .groupBy(applications.applyPositionId);
  const unreadBy = new Map(unread.map((u) => [u.position_id, u]));

  return scoped.map((r) => {
    const fresh = unreadBy.get(r.id);
    return {
      id: r.id,
      title: r.title ?? "Untitled position",
      open: r.status,
      divisionId: r.division_id,
      divisionName: r.division_name,
      departmentName: r.dept_name,
      newApplications: fresh?.n ?? 0,
      oldestNew: fresh?.oldest ? new Date(fresh.oldest) : null,
    };
  });
}

async function readRecruitmentOpen(): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select({ is_open: recruitmentSetting.isOpen }).from(recruitmentSetting).limit(1);
  return row?.is_open ?? true;
}

async function readActiveMemberCount(divisionIds: number[] | null): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count(roles.memberId) })
    .from(roles)
    .where(
      divisionIds === null
        ? isNull(roles.leavedAt)
        : and(isNull(roles.leavedAt), inArray(roles.divisionId, divisionIds.length ? divisionIds : [-1])),
    );
  return row?.n ?? 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Board 40: the operations lead's figures and attention across the team. */
async function teamOverview(identity: Identity): Promise<TeamOverview> {
  const [positions, recruitmentOpen, memberCount, notices] = await Promise.all([
    readPositions(identity),
    readRecruitmentOpen(),
    readActiveMemberCount(null),
    readNoticeAttention(identity, new Date()),
  ]);
  const open = positions.filter((p) => p.open);
  const fresh = positions.reduce((sum, p) => sum + p.newApplications, 0);
  const openDepartments = new Set(open.map((p) => p.departmentName)).size;

  const attention = [
    ...positions
      .filter((p) => p.newApplications > 0)
      .map((p): AttentionItem => ({
        kind: "applications",
        title: `${plural(p.newApplications, "new application", "new applications")} for ${p.title}`,
        detail: `${p.departmentName} · ${p.divisionName}`,
        action: { label: "Review", href: `/dashboard/applications?position=${p.id}` },
      })),
    ...notices,
  ];

  return {
    shape: "team",
    stats: [
      { label: "New applications", value: String(fresh), detail: "Waiting for a first look" },
      {
        label: "Open positions",
        value: String(open.length),
        detail: `In ${plural(openDepartments, "department", "departments")}`,
      },
      {
        label: "Recruitment",
        value: recruitmentOpen ? "Open" : "Closed",
        detail: recruitmentOpen ? "Public on the site" : "Positions are hidden on the site",
        live: recruitmentOpen,
      },
      { label: "Team members", value: String(memberCount), detail: "On the team now" },
    ],
    attention,
    activity: [],
  };
}

/**
 * Board 72 (issue #252): the team leader's figures, what waits for their
 * decision, and the Departments panel, across the team. The database holds
 * no activity feed, so that reads empty.
 */
async function leaderOverview(identity: Identity): Promise<TeamLeaderOverview> {
  const [positions, snapshot, notices] = await Promise.all([
    readPositions(identity),
    readTeamSnapshot(),
    readNoticeAttention(identity, new Date()),
  ]);
  const records = recordsOf(snapshot);
  const orders = await readOrdersIn(snapshot.org.divisions.map((d) => d.id));
  const open = positions.filter((p) => p.open);
  return {
    shape: "leader",
    stats: leaderStats({
      newApplications: positions.reduce((sum, p) => sum + p.newApplications, 0),
      newDetail: "Waiting for a first look",
      openPositions: open.length,
      openDepartments: new Set(open.map((p) => p.departmentName)).size,
      ordersWaiting: waitingOrders(orders).count,
      people: records.length,
      departments: snapshot.org.departments.length,
    }),
    attention: [...leaderAttention({ orders, now: new Date() }), ...notices],
    departments: departmentSummaries(records, snapshot.org, positions),
    people: records.length,
    activity: [],
  };
}

/** Members of the lead's divisions, not leads themselves, who have no photo for The Team page. */
async function readMembersWithoutPhoto(divisionIds: number[]): Promise<string[]> {
  if (divisionIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({ first_name: users.firstName, last_name: users.lastName, email: users.email })
    .from(roles)
    .innerJoin(members, eq(members.memberId, roles.memberId))
    .innerJoin(users, eq(users.member, roles.memberId))
    .where(
      and(
        inArray(roles.divisionId, divisionIds),
        isNull(roles.leavedAt),
        isNull(members.picture),
        or(isNull(roles.type), notInArray(roles.type, ["lead", "head"])),
      ),
    );
  return rows.map((r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email);
}

/**
 * The upcoming interviews on the given positions: each live application at
 * status `interview` with times offered, booked or waiting for the
 * applicant, read the way the applications page reads them
 * (./interview-slots.ts).
 */
async function readInterviews(positions: readonly ScopedPosition[]): Promise<UpcomingInterview[]> {
  if (positions.length === 0) return [];
  const titles = new Map(positions.map((p) => [p.id, p.title]));
  const rows = await getDb()
    .select({
      id: applications.id,
      position_id: applications.applyPositionId,
      email: users.email,
      first_name: users.firstName,
      last_name: users.lastName,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .where(
      and(
        eq(applications.status, "interview"),
        isNull(applications.withdrawnAt),
        inArray(applications.applyPositionId, [...titles.keys()]),
      ),
    );
  const slots = await readSlots(rows.map((r) => r.id));
  return upcomingInterviews(
    rows.flatMap((r) => {
      const position = r.position_id === null ? undefined : titles.get(r.position_id);
      if (position === undefined) return [];
      return [
        {
          applicant: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
          position,
          slots: slots.get(r.id) ?? [],
        },
      ];
    }),
  );
}

/**
 * Board 56: the division lead's figures, attention, interviews and activity,
 * scoped to their division. Interviews are those on the positions the lead
 * reaches, with their booked or offered times. The database holds no
 * activity feed, so that reads empty here.
 */
async function divisionOverview(identity: Identity): Promise<DivisionOverview> {
  const now = new Date();
  const [positions, memberCount, ordersPage, withoutPhoto, notices] = await Promise.all([
    readPositions(identity),
    readActiveMemberCount(identity.divisionIds),
    databaseDivisionPages(identity).orders(),
    readMembersWithoutPhoto(identity.divisionIds),
    readNoticeAttention(identity, now),
  ]);
  const interviews = await readInterviews(positions);
  const open = positions.filter((p) => p.open);
  const fresh = positions.reduce((sum, p) => sum + p.newApplications, 0);
  // The figure counts the lead's own divisions' orders, though Orders shows the whole team (issue #233).
  const waiting = ordersPage ? waitingOrders(ordersOfDivisions(ordersPage.orders, identity.divisionIds)) : { count: 0, total: 0 };
  const divisionName = identity.role?.divisionName ?? "";
  const noPhoto = noPhotoItem(withoutPhoto);

  const attention: AttentionItem[] = [
    ...positions.flatMap((p): AttentionItem[] =>
      p.newApplications > 0 && p.oldestNew !== null
        ? [
            {
              kind: "applications",
              title: `${plural(p.newApplications, "new application", "new applications")} for ${p.title}`,
              detail: oldestLine(p.oldestNew, now),
              action: { label: "Review", href: `/dashboard/applications?position=${p.id}` },
            },
          ]
        : [],
    ),
    ...(noPhoto ? [noPhoto] : []),
    ...notices,
  ];

  return {
    shape: "division",
    stats: [
      { label: "New applications", value: String(fresh), detail: "Waiting for a first look" },
      {
        label: "Open positions",
        value: String(open.length),
        detail: open.length === 0 ? "None open" : open.map((p) => p.title).join(", "),
      },
      {
        label: "Orders",
        value: `${waiting.count} waiting`,
        detail: `${formatEuro(waiting.total)} to be placed`,
        live: waiting.count > 0,
      },
      {
        label: "My division",
        value: String(memberCount),
        detail: `${memberCount === 1 ? "person" : "people"} in ${divisionShortName(divisionName)}`,
      },
    ],
    attention,
    interviews,
    activity: [],
  };
}

/**
 * Boards 62 and 62m (issue #230): a department head's figures, attention,
 * divisions, interviews and activity, across their department. The database
 * holds no activity feed, so that reads empty here.
 */
async function departmentOverview(identity: Identity): Promise<DepartmentOverview> {
  const now = new Date();
  const department = await readHeadDepartment(identity);
  const divisionIds = department?.divisions.map((d) => d.id) ?? [];
  const db = getDb();
  const [positions, team, orders, withoutPhoto, notices] = await Promise.all([
    readPositions(identity),
    divisionIds.length === 0
      ? []
      : db
          .select({
            member_id: roles.memberId,
            division_id: roles.divisionId,
            type: roles.type,
            first_name: users.firstName,
            last_name: users.lastName,
            email: users.email,
          })
          .from(roles)
          .innerJoin(users, eq(users.member, roles.memberId))
          .where(and(inArray(roles.divisionId, divisionIds), isNull(roles.leavedAt))),
    readOrdersIn(divisionIds),
    readMembersWithoutPhoto(divisionIds),
    readNoticeAttention(identity, now),
  ]);
  const interviews = await readInterviews(positions);
  const open = positions.filter((p) => p.open);
  const fresh = positions.reduce((sum, p) => sum + p.newApplications, 0);
  const waiting = waitingOrders(orders);
  const noPhoto = noPhotoItem(withoutPhoto);
  // One row per active role, so someone in two of the department's divisions
  // has two rows; the department figure counts each person once (issue #229).
  const headcount = new Set(team.map((t) => t.member_id)).size;
  const nameOf = (r: { first_name: string | null; last_name: string | null; email: string }) =>
    [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;

  const attention: AttentionItem[] = [
    ...positions.flatMap((p): AttentionItem[] =>
      p.newApplications > 0 && p.oldestNew !== null
        ? [
            {
              kind: "applications",
              title: `${plural(p.newApplications, "new application", "new applications")} for ${p.title}`,
              detail: oldestLine(p.oldestNew, now),
              action: { label: "Review", href: `/dashboard/applications?position=${p.id}` },
            },
          ]
        : [],
    ),
    ...(noPhoto ? [noPhoto] : []),
    ...notices,
  ];

  return {
    shape: "department",
    stats: [
      { label: "New applications", value: String(fresh), detail: "Waiting for a first look" },
      {
        label: "Open positions",
        value: String(open.length),
        detail: `In ${plural(new Set(open.map((p) => p.divisionName)).size, "division", "divisions")}`,
      },
      {
        label: "Orders",
        value: `${waiting.count} waiting`,
        detail: `${formatEuro(waiting.total)} to be placed`,
        live: waiting.count > 0,
      },
      {
        label: "My department",
        value: String(headcount),
        detail: `${headcount === 1 ? "person" : "people"} in ${department?.name ?? identity.role?.departmentName ?? ""}`,
      },
    ],
    attention,
    divisions: (department?.divisions ?? []).map((division): DivisionSummary => {
      const own = positions.filter((p) => p.divisionName === division.name);
      const members = team.filter((t) => t.division_id === division.id);
      return {
        id: division.id,
        name: division.name,
        leads: members.filter((t) => t.type === "lead" || t.type === "head").map(nameOf),
        people: new Set(members.map((t) => t.member_id)).size,
        newApplications: own.reduce((sum, p) => sum + p.newApplications, 0),
        openPositions: own.filter((p) => p.open).length,
      };
    }),
    interviews,
    activity: [],
  };
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

async function memberOverview(identity: Identity): Promise<PersonalOverview> {
  const role = identity.role;
  const items: ChecklistItem[] = [
    { label: "Name and division", detail: "Set by your division lead", done: role?.divisionId != null, action: null },
    { label: "Email", detail: identity.email, done: true, action: null },
    {
      label: "Photo",
      detail: "A clear, square photo of your face",
      done: identity.picture !== null,
      action: identity.picture !== null ? null : { label: "Upload", href: "/dashboard/profile" },
    },
    {
      label: "LinkedIn",
      detail: "Optional, shown as an icon on your card",
      done: identity.linkedin !== null,
      action: identity.linkedin !== null ? null : { label: "Add", href: "/dashboard/profile" },
    },
  ];

  let roster: PersonalOverview["roster"] = null;
  if (role?.divisionId != null) {
    const db = getDb();
    const rows = await db
      .select({
        member_id: roles.memberId,
        type: roles.type,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
      })
      .from(roles)
      .innerJoin(users, eq(users.member, roles.memberId))
      .where(and(eq(roles.divisionId, role.divisionId), isNull(roles.leavedAt)));
    roster = divisionRoster(
      { title: role.divisionName ?? "", department: role.departmentName ?? "" },
      rows.flatMap((r) =>
        r.member_id === null
          ? []
          : [{ memberId: r.member_id, type: r.type, name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email }],
      ),
      identity.memberId,
    );
  }

  return {
    shape: "personal",
    attention: await readNoticeAttention(identity, new Date()),
    person: {
      name: identity.name,
      line: [role?.title ?? "Member", role?.divisionName, role?.departmentName].filter(Boolean).join(" · "),
      since: role ? `In the team since ${monthYear.format(new Date(`${role.startedAt}T00:00:00Z`))}` : null,
      edit: { label: "Edit profile", href: "/dashboard/profile" },
    },
    checklist: {
      title: "Your page on the site",
      detail: `This is how you appear on The Team page. ${checklistProgress(items)}`,
      items,
    },
    roster,
    hint: "Need to work on recruitment or site content? Ask your division lead or the admin team for access.",
  };
}

/**
 * The viewer's Overview, with the hand-overs they answer as its top
 * attention rows (board 62c, issue #262): a head of the sender's department
 * or the team leader, whatever their Overview's shape.
 */
async function overviewOf(identity: Identity): Promise<TeamSideOverview> {
  const [overview, handOvers] = await Promise.all([overviewShapeOf(identity), readHandOverAttention(identity, new Date())]);
  return handOvers.length === 0 ? overview : { ...overview, attention: [...handOvers, ...overview.attention] };
}

function overviewShapeOf(identity: Identity): Promise<TeamSideOverview> {
  switch (identity.kind) {
    case "operations-lead":
      return isTeamLeader(identity) ? leaderOverview(identity) : teamOverview(identity);
    case "department-head":
      return departmentOverview(identity);
    case "division-lead":
      return divisionOverview(identity);
    case "member":
      // An area grant opens a lead's division pages, so its Overview too (issue #160).
      return identity.areaGrant ? divisionOverview(identity) : memberOverview(identity);
    case "non-member":
    case "alumni":
      return Promise.reject(new DashboardRefused("an Overview off the team is built from My applications"));
  }
}

/** Whether one of the viewer's applications is shown now (issue #317); a hidden one stays stored. */
async function hasShownApplications(identity: Identity): Promise<boolean> {
  const rows = await getDb()
    .select({
      status: applications.status,
      appliedAt: applications.appliedAt,
      withdrawnAt: applications.withdrawnAt,
      acceptedAt: applications.acceptedAt,
      rejectedAt: applications.rejectedAt,
      joinedAt: applications.joinedAt,
    })
    .from(applications)
    .where(eq(applications.userId, identity.userId));
  const now = new Date();
  return rows.some((row) => isShownAt(row, now));
}

async function navCountsOf(identity: Identity): Promise<NavCounts> {
  if (identity.kind !== "operations-lead" && identity.kind !== "department-head" && !readsAsDivisionLead(identity)) return {};
  const fresh = (await readPositions(identity)).reduce((sum, p) => sum + p.newApplications, 0);
  return fresh > 0 ? { applications: fresh } : {};
}

/**
 * The Members page: the whole team for the operations lead, and with every
 * member field for the team leader (boards 73 to 73c); for a division
 * lead one of their divisions, with the people waiting for Confirm NDA and the
 * people joining it (./database-team.ts).
 */
async function membersOf(identity: Identity, divisionId: number | null): Promise<MemberDirectory> {
  if (identity.kind === "operations-lead") {
    const snapshot = await readTeamSnapshot();
    if (isTeamLeader(identity)) {
      return { scope: "whole-team", ...wholeTeamMembers({ records: recordsOf(snapshot), org: snapshot.org, selfId: identity.memberId }) };
    }
    return teamDirectory(rosterOf(snapshot), snapshot.org, identity.memberId);
  }
  return readDivisionMembers(identity, divisionId);
}

/**
 * The line under the name on the user card: "Alumni" or "Applicant" off the
 * team (the layout reads "Signed in" for an applicant with nothing shown,
 * `userCardRole`, ./viewer.ts), else the role's title.
 */
function roleLabelOf(identity: Identity): string {
  switch (identity.kind) {
    case "alumni":
      return VIEWER_KIND_LABELS.alumni;
    case "non-member":
      return "Applicant";
    default:
      return identity.role?.title ?? "Member";
  }
}

/** The signed-in account's dashboard, or null when nobody is signed in or there is no database. */
export async function openDatabaseDashboard(): Promise<DashboardData | null> {
  if (!isDatabaseConfigured()) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const identity = await readIdentity(userId);
  if (!identity) return null;

  const viewer: DashboardViewer = {
    ...standingOf(identity),
    name: identity.name,
    role: roleLabelOf(identity),
    session: "account",
  };
  const self = databaseSelfPages(identity);
  return {
    viewer,
    navCounts: () => navCountsOf(identity),
    hasShownApplications: () => hasShownApplications(identity),
    overview: () => overviewOf(identity),
    members: (divisionId) => membersOf(identity, divisionId ?? null),
    findForAdd: (divisionId, query) => findForAdd(identity, divisionId, query),
    findPeople: (query) => findPeople(identity, query),
    alumni: () => readAlumniDirectory(identity),
    teamTree: async () => {
      const snapshot = await readTeamSnapshot();
      const roster = canReach(identity, "team-tree") ? rosterOf(snapshot) : [];
      return buildTeamTree(roster, snapshot.org, seasonAt(new Date()), identity.memberId);
    },
    teamStructure: () => readTeamStructure(identity),
    teamWrites: { ...databaseTeamWrites(identity), ...databaseAlumniWrites(identity) },
    dismissNotice: (noticeId) => dismissNotice(identity, noticeId),
    sendHandOver: (input) => sendHandOver(identity, input),
    answerHandOver: (requestId, answer) => answerHandOver(identity, requestId, answer),
    recruitment: getRecruitmentControl,
    setRecruitment: (next) =>
      switchRecruitment(next, {
        // Read on the server, from the caller's positions scope rows.
        maySwitch: async () => canSwitchRecruitment(await getScopeInfoForCurrentUser("positions")),
        save: saveRecruitment,
        refresh: () => updateTag(PUBLIC_POSITIONS_CACHE_TAG),
      }),
    ...databaseRecruitmentPages(identity),
    ...databaseDivisionPages(identity),
    partners: partnerEditor(identity, databasePartnerStore, blobLogoFiles),
    faqs: faqEditor(identity, databaseFaqStore, () => new Date()),
    teamPage: teamPageEditor(identity, databaseTeamPageLayerStore, databaseTeamRoles, teamRecord),
    teamAdvisors: advisorEditor(identity, databaseAdvisorStore, currentAcademicYearStart),
    outreach: outreachEditor(identity, databaseOutreachStore, blobPhotoFiles()),
    projects: projectEditor(identity, databaseProjectStore, { stamps: readProjectStamps, now: () => new Date() }, blobProjectPhotoFiles()),
    ...self,
    ...databaseOwnAlumni(identity),
    // Every viewer opens on their Overview, so leaving opens it too (issue #317).
    async leaveTeam(reason, removeFromAlumni) {
      const left = await self.leaveTeam(reason, removeFromAlumni);
      return left.ok ? written(LANDING_AFTER_LEAVING) : left;
    },
  };
}

/**
 * Stores the switch through runAuditQuery, so the audit trigger on
 * `recruitment_setting` logs who set it and the new value.
 */
async function saveRecruitment(recruitment: Recruitment): Promise<void> {
  const updatedAt = new Date().toISOString();
  await runAuditQuery((db) =>
    db
      .insert(recruitmentSetting)
      .values({ id: true, isOpen: recruitment.isOpen, updatedAt })
      .onConflictDoUpdate({
        target: recruitmentSetting.id,
        set: { isOpen: recruitment.isOpen, updatedAt },
      }),
  );
}
