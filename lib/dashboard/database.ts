import "server-only";

import { and, asc, count, eq, inArray, isNull, max, min, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getRecruitmentControlFor } from "@/app/actions/get-apply-positions";
import { getScopeInfoForMember } from "@/app/actions/get-member-scopes";
import { cachedReadTags, refreshAfter } from "@/lib/cache-tags";
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
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import { runAuditQuery } from "@/lib/db-audit";
import { canReach, LANDING_AFTER_LEAVING, type NavCounts } from "./access";
import { isShownAt } from "./my-applications";
import { DashboardRefused, type DashboardData } from "./data";
import {
  buildTeamTree,
  seasonAt,
  type MemberDirectory,
  type RoleType,
} from "./team";
import { readTeamSnapshot, recordsOf, rosterOf } from "./team-database";
import { departmentSummaries, leaderAttention, leaderStats } from "./leader-overview";
import { opensWholeTeam } from "./members-view";
import { databaseAlumniWrites, databaseOwnAlumni, readAlumniDirectory, readOwnAlumnus } from "./database-alumni";
import { decideRightOfStanding, formatEuro, waitingOrders, type Order } from "./orders";
import {
  checklistProgress,
  divisionRoster,
  noPhotoItem,
  oldestLine,
  type AttentionItem,
  type ChecklistItem,
  type DepartmentOverview,
  type DivisionOverview,
  type DivisionSummary,
  type PersonalPanels,
  type Roster,
  type ScopeBoard,
  type TeamLeaderOverview,
  type TeamOverview,
  type TeamSideOverview,
  type UpcomingInterview,
} from "./overview";
import { databaseDivisionPages, readHeadDepartment, readOrdersIn } from "./database-division";
import { databaseRecruitmentPages, readSlots } from "./database-recruitment";
import { divisionOverviewOf, membersScopeOf, overviewAreasOf, type DivisionFigures } from "./division-overview";
import { accessSectionOf, accessSummariesOf, type AccessFigures, type AccessSummary } from "./access-summary";
import { answerHandOver, databaseTeamWrites, findForAdd, findPeople, readDivisionMembers, readTeamStructure, readWholeTeamMembers } from "./database-team";
import { databaseSelfPages } from "./database-self";
import { blobLogoFiles, databasePartnerStore } from "./database-partners";
import { partnerEditor } from "@/lib/partners-editor";
import { faqEditor } from "@/lib/faq/editor";
import { databaseFaqStore } from "./database-faqs";
import { team as teamRecord } from "@/lib/about/team";
import { teamPageEditor } from "@/lib/about/team-page-editor";
import { databaseTeamRoles } from "@/lib/about/team-data";
import { currentAcademicYearStart } from "@/lib/about/academic-year";
import { databaseTeamPageStore } from "./database-team-page-store";
import { blobTeamPagePhotos } from "./database-team-page-photos";
import { advisorEditor } from "@/lib/about/advisors";
import { databaseAdvisorStore } from "./database-team-advisors";
import { blobPhotoFiles, databaseOutreachStore } from "./database-outreach";
import { outreachEditor } from "@/lib/outreach-editor";
import { projectEditor } from "@/lib/project-content/editor";
import { blobProjectBackgroundFiles, blobProjectPhotoFiles, databaseProjectStore, readProjectStamps } from "./database-projects";
import { dismissNotice, readNoticeAttention } from "./database-notices";
import { readHandOverAttention, sendHandOver } from "./database-hand-over";
import { answerAlias, cancelAliasRequest, confirmAliasSetUp, readAliasAttention, readMemberAliases, readOwnAlias, requestAlias } from "./database-alias";
import { upcomingInterviews } from "./interview-slots";
import { SEAT_OF_FLAG, VIEWER_KIND_LABELS, areaGrantsOf, areasGrantedBy, isOffTeam, isTeamLeader, readsArea, readsAreaIn, standingOf, unitRowsOf, viewerStandingOf, viewerUnitsOf, type AreaGrant, type DashboardViewer, type FlaggedSeat, type GrantArea, type ViewerStanding } from "./viewer";
import { written } from "./write";

// The dashboard data interface for the signed-in account, read from the
// database. Reads follow
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
  /**
   * The account behind a View as session, read from the session on the
   * server (issue #605): `userId` is then the person viewed as. Each write
   * that names its author stores it beside them; null for a plain session.
   */
  actingAccountId: string | null;
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

/**
 * Who the account is, read in one round trip (issue #397): the user row, their
 * scope rows and active roles (both reached through the user's member id) and
 * the open departments go out together, since none needs another's answer.
 * Only someone with no active role waits for one more read, the Alumni record.
 */
async function readIdentity({ id: userId, actingAccountId }: Pick<CurrentUser, "id" | "actingAccountId">): Promise<Identity | null> {
  const db = getDb();
  const [[user], scopeRows, roleRows, openDepartments] = await Promise.all([
    db
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
      .limit(1),
    db
      .select({
        scope: scopes.scope,
        target: scopes.target,
        level: scopes.accessLevel,
        division_id: scopes.divisionId,
        dept_id: scopes.deptId,
      })
      .from(scopes)
      .innerJoin(users, eq(users.member, scopes.memberId))
      .where(eq(users.id, userId)),
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
      .innerJoin(users, eq(users.member, roles.memberId))
      .leftJoin(divisions, eq(roles.divisionId, divisions.id))
      // A head's role names its department; a lead's names it through the division (issue #230).
      .leftJoin(departments, eq(departments.id, sql`coalesce(${roles.deptId}, ${divisions.deptId})`))
      .where(and(eq(users.id, userId), isNull(roles.leavedAt)))
      .orderBy(asc(roles.startedAt)),
    db.select({ id: departments.id }).from(departments).where(isNull(departments.closedAt)),
  ]);
  if (!user) return null;

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const base = {
    userId,
    actingAccountId,
    name,
    email: user.email,
    linkedin: user.linkedin,
    memberId: user.member_id,
    picture: user.picture,
  };
  if (user.member_id === null) {
    return { ...base, role: null, roles: [], divisionIds: [], departmentIds: [], grants: [], ...viewerStandingOf(null) };
  }

  const activeRoles: ActiveRole[] = roleRows.map((r) => ({ ...r, fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess] }));

  // A grant across the whole team stands for every open department (issue #247).
  const wholeTeam = scopeRows.some((s) => s.scope === "team" && s.target !== "approve_orders");
  const openDepartmentIds = wholeTeam ? openDepartments.map((d) => d.id) : [];
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

type LivePosition = {
  id: number;
  title: string;
  open: boolean;
  divisionId: number;
  divisionName: string;
  departmentId: number;
  departmentName: string;
};

declare const readsApplications: unique symbol;

/**
 * A live position in a unit where the viewer reads Applications
 * (`applicationsPositions`): the only kind whose unread applications are
 * read (`withUnread`), so no Overview figure about applications reaches a
 * unit where the viewer reads Positions alone (issue #477).
 */
type ApplicationsPosition = LivePosition & { readonly [readsApplications]: true };

type UnreadPosition = Omit<LivePosition, "departmentId"> & {
  newApplications: number;
  /** When the oldest unread application came in; null when there is none. */
  oldestNew: Date | null;
};

/**
 * Every live position in an open division and department, read once for
 * every viewer and cached (ADR 0003). Its tags are refreshed by every
 * position write and by every write that renames or closes a division or a
 * department (lib/cache-tags.ts); each viewer's share is filtered after the
 * cache hit (`scopedPositions`).
 */
async function readLivePositions(): Promise<LivePosition[]> {
  "use cache";
  cacheTag(...cachedReadTags("livePositions"));
  cacheLife("hours");
  const rows = await getDb()
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
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? "Untitled position",
    open: r.status,
    divisionId: r.division_id,
    divisionName: r.division_name,
    departmentId: r.dept_id,
    departmentName: r.dept_name,
  }));
}

/**
 * The live positions the viewer's figures cover in `area` (`readsAreaIn`):
 * a head's or a lead's units in every area, a member's granted ones in that
 * area alone (issue #471).
 */
async function scopedPositions(identity: Identity, area: "positions" | "applications"): Promise<LivePosition[]> {
  const rows = await readLivePositions();
  return rows.filter((r) => readsAreaIn(identity, area, { divisionId: r.divisionId, departmentId: r.departmentId }));
}

/**
 * The unread applications on every position: how many, and when the oldest
 * came in. Applications change by the minute, so this is read on request,
 * beside the cached positions rather than after them.
 */
async function readUnread(): Promise<Map<number | null, { n: number; oldest: string | null }>> {
  const unread = await getDb()
    .select({ position_id: applications.applyPositionId, n: count(), oldest: min(applications.appliedAt) })
    .from(applications)
    .where(and(eq(applications.status, "received"), isNull(applications.withdrawnAt)))
    .groupBy(applications.applyPositionId);
  return new Map(unread.map((u) => [u.position_id, u]));
}

/** The live positions in the units where the viewer reads Applications. */
async function applicationsPositions(identity: Identity): Promise<ApplicationsPosition[]> {
  return (await scopedPositions(identity, "applications")) as ApplicationsPosition[];
}

/** The live positions where the viewer reads Applications, with their unread application counts. */
async function readUnreadPositions(identity: Identity): Promise<UnreadPosition[]> {
  return withUnread(applicationsPositions(identity));
}

/** The given positions, each where the viewer reads Applications, with their unread application counts. */
async function withUnread(scoped: Promise<ApplicationsPosition[]>): Promise<UnreadPosition[]> {
  const [rows, unreadBy] = await Promise.all([scoped, readUnread()]);
  return rows.map((r) => {
    const fresh = unreadBy.get(r.id);
    return {
      id: r.id,
      title: r.title,
      open: r.open,
      divisionId: r.divisionId,
      divisionName: r.divisionName,
      departmentName: r.departmentName,
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
  // Open positions count where the viewer reads Positions; new applications, where they read Applications (issue #477).
  const [positions, unread, recruitmentOpen, memberCount, notices] = await Promise.all([
    scopedPositions(identity, "positions"),
    readUnreadPositions(identity),
    readRecruitmentOpen(),
    readActiveMemberCount(null),
    readNoticeAttention(identity, new Date()),
  ]);
  const open = positions.filter((p) => p.open);
  const fresh = unread.reduce((sum, p) => sum + p.newApplications, 0);
  const openDepartments = new Set(open.map((p) => p.departmentName)).size;

  const attention = [
    ...unread
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
 * Every order in the team. Deciding is team-wide (`ordersScopeOf`), so what
 * waits for a decision is counted across the team.
 */
function readTeamOrders(): Promise<Order[]> {
  return readTeamSnapshot().then((s) => readOrdersIn(s.org.divisions.map((d) => d.id)));
}

/**
 * Board 72 (issue #252): the team leader's figures and the Departments
 * panel, across the team, from the team's orders (`teamOrders`). What waits
 * for their decision is added by `overviewOf`, as for anyone who decides. The
 * database holds no activity feed, so that reads empty.
 */
async function leaderOverview(identity: Identity, teamOrders: Promise<Order[]>): Promise<TeamLeaderOverview> {
  const [positions, unread, snapshot, orders, notices] = await Promise.all([
    scopedPositions(identity, "positions"),
    readUnreadPositions(identity),
    readTeamSnapshot(),
    teamOrders,
    readNoticeAttention(identity, new Date()),
  ]);
  const records = recordsOf(snapshot);
  const open = positions.filter((p) => p.open);
  return {
    shape: "leader",
    stats: leaderStats({
      newApplications: unread.reduce((sum, p) => sum + p.newApplications, 0),
      newDetail: "Waiting for a first look",
      openPositions: open.length,
      openDepartments: new Set(open.map((p) => p.departmentName)).size,
      ordersWaiting: waitingOrders(orders).count,
      people: records.length,
      departments: snapshot.org.departments.length,
    }),
    attention: notices,
    departments: departmentSummaries(records, snapshot.org, positions, unread),
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
async function readInterviews(positions: readonly { id: number; title: string }[]): Promise<UpcomingInterview[]> {
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
 * scoped to their division; a member's, with only the areas they are granted
 * (issue #593). Interviews are those on the positions the viewer reaches,
 * with their booked or offered times. The database holds no activity feed,
 * so that reads empty here.
 */
async function divisionOverview(identity: Identity): Promise<DivisionOverview> {
  const now = new Date();
  // Each area is read only when the viewer reads it (`overviewAreasOf`,
  // ./division-overview.ts): a lead every area, a member the granted ones.
  const areas = overviewAreasOf(identity);
  const reads = (area: GrantArea) => areas.includes(area);
  const [positions, applications, orders, members, notices] = await Promise.all([
    reads("positions") ? scopedPositions(identity, "positions") : undefined,
    reads("applications") ? readApplicationFigures(identity) : undefined,
    reads("orders") ? readOrderFigures(identity) : undefined,
    reads("members") ? readMemberFigures(identity) : undefined,
    readNoticeAttention(identity, now),
  ]);
  return divisionOverviewOf(areas, { now, notices, positions, applications, orders, members });
}

/** The live positions the viewer reads Applications on, with their unread counts, and the upcoming interviews on them. */
async function readApplicationFigures(identity: Identity): Promise<NonNullable<DivisionFigures["applications"]>> {
  // The interviews need only which positions the viewer reads, so they start beside the counts.
  const scoped = applicationsPositions(identity);
  const [positions, interviews] = await Promise.all([withUnread(scoped), scoped.then(readInterviews)]);
  return { positions, interviews };
}

/**
 * The orders waiting in the units the viewer reads Orders in (`readsAreaIn`):
 * a lead's own divisions, though Orders shows the whole team (issue #233),
 * and the units their Orders grants cover; a grant on another area adds none
 * (issue #477).
 */
async function readOrderFigures(identity: Identity): Promise<NonNullable<DivisionFigures["orders"]>> {
  const ordersPage = await databaseDivisionPages(identity).orders();
  if (!ordersPage) return { count: 0, total: 0 };
  const granted = ordersPage.orders.filter(
    (o) => o.unit !== null && readsAreaIn(identity, "orders", { divisionId: o.unit.division.id, departmentId: o.unit.department?.id ?? -1 }),
  );
  return waitingOrders(granted);
}

/**
 * How many people are in the open divisions the viewer reads Members in
 * (`readsAreaIn`), each once; the scope those divisions make, which the
 * figure names (issue #593); and who there has no photo.
 */
async function readMemberFigures(identity: Identity): Promise<NonNullable<DivisionFigures["members"]>> {
  const { org, roles: roleRows } = await readTeamSnapshot();
  const covered = coveredMemberDivisions(identity, org.divisions);
  const people = new Set(
    roleRows.filter((r) => r.leaved_at === null && r.division_id !== null && covered.includes(r.division_id)).map((r) => r.member_id),
  );
  const own = identity.roles.flatMap((r) => (r.divisionId === null ? [] : [r.divisionId]));
  return { count: people.size, scope: membersScopeOf(covered, org, own), withoutPhoto: await readMembersWithoutPhoto(covered) };
}

/** The open divisions where the viewer reads Members: a grant on a department covers each of its divisions, as on the Members page. */
function coveredMemberDivisions(identity: Identity, divisionRows: readonly { id: number; departmentId: number }[]): number[] {
  return divisionRows.filter((d) => readsAreaIn(identity, "members", { divisionId: d.id, departmentId: d.departmentId })).map((d) => d.id);
}

/**
 * Boards 62 and 62m (issue #230): a department head's figures, attention,
 * divisions, interviews and activity, across their department. The database
 * holds no activity feed, so that reads empty here.
 */
async function departmentOverview(identity: Identity): Promise<DepartmentOverview> {
  const now = new Date();
  const db = getDb();
  // The positions, their interviews and the notices need nothing of the
  // department, so they start beside its read; the rest wait for its divisions.
  // The new applications and the interviews are Applications data, so they
  // come from the positions the head reads Applications on, never from a
  // Positions grant alone (issue #477).
  const scoped = scopedPositions(identity, "positions");
  const interviewed = applicationsPositions(identity);
  const departmentRead = readHeadDepartment(identity).then(async (department) => {
    const divisionIds = department?.divisions.map((d) => d.id) ?? [];
    const [team, orders, withoutPhoto] = await Promise.all([
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
    ]);
    return { department, team, orders, withoutPhoto };
  });
  const [positions, unread, interviews, notices, { department, team, orders, withoutPhoto }] = await Promise.all([
    scoped,
    withUnread(interviewed),
    interviewed.then(readInterviews),
    readNoticeAttention(identity, now),
    departmentRead,
  ]);
  const open = positions.filter((p) => p.open);
  const fresh = unread.reduce((sum, p) => sum + p.newApplications, 0);
  const waiting = waitingOrders(orders);
  const noPhoto = noPhotoItem(withoutPhoto);
  // One row per active role, so someone in two of the department's divisions
  // has two rows; the department figure counts each person once (issue #229).
  const headcount = new Set(team.map((t) => t.member_id)).size;
  const nameOf = (r: { first_name: string | null; last_name: string | null; email: string }) =>
    [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;

  const attention: AttentionItem[] = [
    ...unread.flatMap((p): AttentionItem[] =>
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
      const own = positions.filter((p) => p.divisionId === division.id);
      const members = team.filter((t) => t.division_id === division.id);
      return {
        id: division.id,
        name: division.name,
        leads: members.filter((t) => t.type === "lead" || t.type === "head").map(nameOf),
        people: new Set(members.map((t) => t.member_id)).size,
        newApplications: unread.filter((p) => p.divisionId === division.id).reduce((sum, p) => sum + p.newApplications, 0),
        openPositions: own.filter((p) => p.open).length,
      };
    }),
    interviews,
    activity: [],
  };
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Board 52's panels, for every team seat (issue #593): who they are, their
 * page on the site, their rosters, and "Your access". `teamOrders` is the
 * team's orders when they decide orders, else null.
 */
async function personalPanelsOf(identity: Identity, teamOrders: Promise<Order[]> | null): Promise<PersonalPanels> {
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

  // The grants' figures need nothing of the rosters, so they are read beside them.
  // "Approve orders" is a grant only where the viewer holds it: the team leader decides by their seat, and that is no grant.
  const [rosters, lines] = await Promise.all([readRosters(identity), readAccessSummaries(identity, identity.approveOrders ? teamOrders : null)]);

  return {
    person: {
      name: identity.name,
      line: [role?.title ?? "Member", role?.divisionName, role?.departmentName].filter(Boolean).join(" · "),
      since: role ? `In the team since ${monthYear.format(new Date(`${role.startedAt}T00:00:00Z`))}` : null,
      edit: { label: "Edit profile", href: "/dashboard/profile" },
      // The photo the sidebar shows, `DashboardViewer.photoUrl` (issue #599).
      photoUrl: identity.picture,
    },
    checklist: {
      title: "Your page on the site",
      detail: `This is how you appear on The Team page. ${checklistProgress(items)}`,
      items,
    },
    rosters,
    access: accessSectionOf(lines, overviewAreasOf(identity).length > 0),
  };
}

/**
 * One roster per division the viewer holds an active role in, in the order
 * their roles come (issue #593): none for a seat whose roles name no division.
 */
async function readRosters(identity: Identity): Promise<Roster[]> {
  const divisionsHeld = [...new Map(identity.roles.flatMap((r) => (r.divisionId === null ? [] : [[r.divisionId, r] as const]))).values()];
  if (divisionsHeld.length === 0) return [];
  const rows = await getDb()
    .select({
      division_id: roles.divisionId,
      member_id: roles.memberId,
      type: roles.type,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      picture: members.picture,
    })
    .from(roles)
    .innerJoin(users, eq(users.member, roles.memberId))
    .leftJoin(members, eq(members.memberId, roles.memberId))
    .where(and(inArray(roles.divisionId, divisionsHeld.map((r) => r.divisionId!)), isNull(roles.leavedAt)));
  return divisionsHeld.map((held) =>
    divisionRoster(
      { title: held.divisionName ?? "", department: held.departmentName ?? "" },
      rows.flatMap((r) =>
        r.member_id === null || r.division_id !== held.divisionId
          ? []
          : [{ memberId: r.member_id, type: r.type, name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email, photoUrl: r.picture }],
      ),
      identity.memberId,
    ),
  );
}

/**
 * "Your access" on the Overview (issues #480, #593): each area the viewer
 * holds a grant on (`areasGrantedBy`), whatever their seat, counted only in
 * the units those grants cover (`grantReachOf`), never in a lead's own
 * division. Nothing is read for an area they hold no grant on, and the
 * summaries keep counts alone. A Content grant adds its own line, which
 * reads nothing (issue #504). Approve orders adds the count of the team's
 * orders waiting for a decision, from `teamOrders`, which is null when they
 * do not hold it (issue #592).
 */
async function readAccessSummaries(identity: Identity, teamOrders: Promise<Order[]> | null): Promise<AccessSummary[]> {
  const reach = grantReachOf(identity);
  const areas = reach.grantedAreas;
  const reads = (area: GrantArea) => areas.includes(area);
  const [positions, applications, orders, members, approveOrders] = await Promise.all([
    reads("positions") ? scopedPositions(reach, "positions") : undefined,
    reads("applications") ? readApplicationFigures(reach) : undefined,
    reads("orders") ? readOrderFigures(reach) : undefined,
    reads("members") ? readMemberAccess(reach) : undefined,
    teamOrders?.then((all) => ({ waiting: waitingOrders(all).count })),
  ]);
  return accessSummariesOf(areas, { positions, applications, orders, members, approveOrders }, identity.siteContent);
}

/**
 * The viewer as their area grants alone reach (issue #593): a member holding
 * exactly those grants, so every read sees the units the grants name and
 * none a lead's, a head's or full access's role adds.
 */
function grantReachOf(identity: Identity): Identity & { kind: "member" } {
  return {
    ...identity,
    kind: "member",
    grantedAreas: areasGrantedBy(identity.grants),
    siteContent: identity.siteContent,
    approveOrders: identity.approveOrders,
  };
}

/**
 * How many people are in the open divisions the viewer reads Members in
 * (`readsAreaIn`), each once, and how many divisions that is. A grant on a
 * department covers each of its divisions, as on the Members page.
 */
async function readMemberAccess(identity: Identity): Promise<NonNullable<AccessFigures["members"]>> {
  const { org, roles: roleRows } = await readTeamSnapshot();
  const covered = new Set(coveredMemberDivisions(identity, org.divisions));
  const people = new Set(
    roleRows.filter((r) => r.leaved_at === null && r.division_id !== null && covered.has(r.division_id)).map((r) => r.member_id),
  );
  return { people: people.size, divisions: covered.size };
}

/**
 * The viewer's Overview (issue #593): the board their scope reads, with the
 * personal panels every team seat gets. The hand-overs they answer are its
 * top attention rows (board 62c, issue #262): a head of the sender's
 * department or the team leader, whatever their Overview's shape. The open
 * alias requests follow them for the three approver seats (board 94c, epic
 * #538). Whoever decides orders (`decideRightOfStanding`), whatever the
 * shape, then gets what waits for their decision across the team
 * (`leaderAttention`, issue #592); nobody else's Overview reads the team's
 * orders for it.
 */
async function overviewOf(identity: Identity): Promise<TeamSideOverview> {
  const now = new Date();
  const teamOrders = decideRightOfStanding(identity) === null ? null : readTeamOrders();
  const [board, panels, handOvers, aliases, decisions] = await Promise.all([
    scopeBoardOf(identity, teamOrders),
    personalPanelsOf(identity, teamOrders),
    readHandOverAttention(identity, now),
    readAliasAttention(identity, now),
    teamOrders?.then((orders) => leaderAttention({ orders, now })) ?? [],
  ]);
  return { ...board, ...panels, attention: [...handOvers, ...aliases, ...decisions, ...board.attention] };
}

/**
 * The board the viewer's scope reads; `teamOrders` is the team's orders when
 * they decide orders, else null. A member reads the division board with only
 * the areas they are granted, as a lead reads it with every area (issue #593).
 */
function scopeBoardOf(identity: Identity, teamOrders: Promise<Order[]> | null): Promise<ScopeBoard> {
  switch (identity.kind) {
    case "operations-lead":
      // The team leader always decides, so their figures share the one read.
      return isTeamLeader(identity) ? leaderOverview(identity, teamOrders ?? readTeamOrders()) : teamOverview(identity);
    case "department-head":
      return departmentOverview(identity);
    case "division-lead":
    case "member":
      return divisionOverview(identity);
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

/** The Applications badge: unread applications where the viewer reads the Applications area; none for anyone else (issue #471). */
async function navCountsOf(identity: Identity): Promise<NavCounts> {
  if (!readsArea(identity, "applications")) return {};
  const fresh = (await readUnreadPositions(identity)).reduce((sum, p) => sum + p.newApplications, 0);
  return fresh > 0 ? { applications: fresh } : {};
}

/**
 * The Members page: the whole team with every member field for each
 * full-access seat, the team leader, the operations lead and the IT lead alike
 * (boards 73 to 73c, issue #418); for a division lead one of their divisions,
 * with the people waiting for Confirm NDA and the people joining it
 * (./database-team.ts). Every page opens the same Edit details panel for each
 * person the viewer may edit (issue #584), the team leader's included (Owner
 * decision, 2026-10-19, issue #444).
 */
async function membersOf(identity: Identity, divisionId: number | null): Promise<MemberDirectory> {
  return opensWholeTeam(identity) ? readWholeTeamMembers(identity) : readDivisionMembers(identity, divisionId);
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
  const user = await getCurrentUser();
  if (!user) return null;
  const identity = await readIdentity(user);
  if (!identity) return null;

  const viewer: DashboardViewer = {
    ...standingOf(identity),
    name: identity.name,
    role: roleLabelOf(identity),
    photoUrl: identity.picture,
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
    memberAliases: async (memberIds) => (canReach(identity, "members") ? readMemberAliases(identity, memberIds) : {}),
    requestAlias: (memberId) => requestAlias(identity, memberId),
    cancelAliasRequest: (requestId) => cancelAliasRequest(identity, requestId),
    answerAlias: (requestId, answer) => answerAlias(identity, requestId, answer),
    myAlias: () => readOwnAlias(identity),
    confirmAliasSetUp: () => confirmAliasSetUp(identity),
    // The member this request already resolved, never the session a second time (issue #397).
    recruitment: () => getRecruitmentControlFor(identity.memberId, identity),
    setRecruitment: (next) =>
      switchRecruitment(next, {
        // Read on the server, from the caller's seat and positions scope rows: the same rule the page shows.
        maySwitch: async () => canSwitchRecruitment(identity, await getScopeInfoForMember(identity.memberId, "positions")),
        save: saveRecruitment,
        refresh: () => refreshAfter("positions", updateTag),
      }),
    ...databaseRecruitmentPages(identity),
    ...databaseDivisionPages(identity),
    partners: partnerEditor(identity, databasePartnerStore, blobLogoFiles),
    faqs: faqEditor(identity, databaseFaqStore, () => new Date()),
    teamPage: teamPageEditor(identity, databaseTeamPageStore, databaseTeamRoles, teamRecord, blobTeamPagePhotos()),
    teamAdvisors: advisorEditor(identity, databaseAdvisorStore, currentAcademicYearStart),
    outreach: outreachEditor(identity, databaseOutreachStore, blobPhotoFiles()),
    projects: projectEditor(
      identity,
      databaseProjectStore,
      { stamps: readProjectStamps, now: () => new Date() },
      blobProjectPhotoFiles(),
      blobProjectBackgroundFiles(),
    ),
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
