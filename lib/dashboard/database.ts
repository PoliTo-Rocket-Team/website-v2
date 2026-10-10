import "server-only";

import { and, count, desc, eq, inArray, isNull, max, min, notInArray, or } from "drizzle-orm";
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
import { canReach, type NavCounts } from "./access";
import type { DashboardData } from "./data";
import {
  alumniDirectory,
  buildTeamTree,
  divisionDirectory,
  NO_DIVISION,
  seasonAt,
  teamDirectory,
  type MemberDirectory,
} from "./team";
import { alumniOf, readTeamSnapshot, rosterOf } from "./team-database";
import { formatEuro, waitingOrders } from "./orders";
import {
  checklistProgress,
  divisionShortName,
  noPhotoItem,
  oldestLine,
  type ApplicationStatus,
  type AttentionItem,
  type ChecklistItem,
  type DivisionOverview,
  type Overview,
  type PersonalOverview,
  type TeamOverview,
} from "./overview";
import { databaseDivisionPages } from "./database-division";
import { databaseRecruitmentPages } from "./database-recruitment";
import { databaseTeamWrites, leadDivisionId, readJoining } from "./database-team";
import { databaseSelfPages } from "./database-self";
import { viewerKindOf, type DashboardViewer, type ViewerKind } from "./viewer";

// The signed-in account's side of the dashboard data interface: the same
// answers as lib/dummy-data/, read from the database. Reads follow
// .patterns/drizzle-reads.md: getDb() per call, closed units and deleted
// positions left out.

type ActiveRole = {
  title: string;
  type: "president" | "head" | "lead" | "core" | null;
  startedAt: string;
  divisionId: number | null;
  divisionName: string | null;
  departmentId: number | null;
  departmentName: string | null;
};

type Identity = {
  userId: string;
  name: string;
  email: string;
  linkedin: string | null;
  memberId: number | null;
  picture: string | null;
  role: ActiveRole | null;
  /** The divisions and departments a lead's figures cover. */
  divisionIds: number[];
  departmentIds: number[];
  kind: ViewerKind;
};

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
    return { ...base, role: null, divisionIds: [], departmentIds: [], kind: viewerKindOf(null) };
  }

  const [scopeRows, [role]] = await Promise.all([
    db
      .select({ scope: scopes.scope, division_id: scopes.divisionId, dept_id: scopes.deptId })
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
      })
      .from(roles)
      .leftJoin(divisions, eq(roles.divisionId, divisions.id))
      .leftJoin(departments, eq(divisions.deptId, departments.id))
      .where(and(eq(roles.memberId, user.member_id), isNull(roles.leavedAt)))
      .orderBy(desc(roles.startedAt))
      .limit(1),
  ]);

  const divisionIds = scopeRows.flatMap((s) => (s.scope === "division" && s.division_id !== null ? [s.division_id] : []));
  if (role?.divisionId != null && (role.type === "lead" || role.type === "head")) divisionIds.push(role.divisionId);
  const departmentIds = scopeRows.flatMap((s) => (s.scope === "department" && s.dept_id !== null ? [s.dept_id] : []));

  return {
    ...base,
    role: role ?? null,
    divisionIds,
    departmentIds,
    kind: viewerKindOf({ scopes: scopeRows.map((s) => s.scope), roleType: role?.type ?? null }),
  };
}

type ScopedPosition = {
  id: number;
  title: string;
  open: boolean;
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
  const [positions, recruitmentOpen, memberCount] = await Promise.all([
    readPositions(identity),
    readRecruitmentOpen(),
    readActiveMemberCount(null),
  ]);
  const open = positions.filter((p) => p.open);
  const fresh = positions.reduce((sum, p) => sum + p.newApplications, 0);
  const openDepartments = new Set(open.map((p) => p.departmentName)).size;

  const attention = positions
    .filter((p) => p.newApplications > 0)
    .map((p): AttentionItem => ({
      kind: "applications",
      title: `${plural(p.newApplications, "new application", "new applications")} for ${p.title}`,
      detail: `${p.departmentName} · ${p.divisionName}`,
      action: { label: "Review", href: `/dashboard/applications?position=${p.id}` },
    }));

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
 * Board 56: the division lead's figures, attention, interviews and activity,
 * scoped to their division. Interview times (`interview_slots`, #169) are
 * not read here yet, and the database holds no activity feed, so both read
 * empty here.
 */
async function divisionOverview(identity: Identity): Promise<DivisionOverview> {
  const now = new Date();
  const [positions, memberCount, divisionOrders, withoutPhoto] = await Promise.all([
    readPositions(identity),
    readActiveMemberCount(identity.divisionIds),
    databaseDivisionPages(identity).divisionOrders(),
    readMembersWithoutPhoto(identity.divisionIds),
  ]);
  const open = positions.filter((p) => p.open);
  const fresh = positions.reduce((sum, p) => sum + p.newApplications, 0);
  const waiting = divisionOrders ? waitingOrders(divisionOrders.orders) : { count: 0, total: 0 };
  const divisionName = identity.role?.divisionName ?? divisionOrders?.division.name ?? "";
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
    interviews: [],
    activity: [],
  };
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

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
    const people = rows.map((r) => {
      const self = r.member_id === identity.memberId;
      const lead = r.type === "lead" || r.type === "head";
      return {
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
        role: lead ? "Division lead" : "Member",
        lead,
        self,
      };
    });
    const leads = people.filter((p) => p.lead && !p.self);
    const others = people.filter((p) => !p.lead && !p.self).slice(0, 2);
    const me = people.filter((p) => p.self);
    roster = {
      title: role.divisionName ?? "",
      detail: `${role.departmentName ?? ""} · ${plural(people.length, "person", "people")}`,
      size: people.length,
      people: [...leads, ...others, ...me],
    };
  }

  return {
    shape: "personal",
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
    applications: null,
    hint: "Need to work on recruitment or site content? Ask your division lead or the admin team for access.",
  };
}

const statusOf: Readonly<Record<(typeof applications.$inferSelect)["status"], ApplicationStatus>> = {
  received: "received",
  pending: "in-review",
  interview: "in-review",
  accepted: "accepted",
  joined: "accepted",
  rejected: "declined",
  accepted_by_another_team: "declined",
};

async function applicantOverview(identity: Identity): Promise<PersonalOverview> {
  const db = getDb();
  const rows = await db
    .select({
      title: applyPositions.title,
      dept_name: departments.name,
      applied_at: applications.appliedAt,
      status: applications.status,
    })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .leftJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .leftJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(eq(applications.userId, identity.userId), isNull(applications.withdrawnAt)))
    .orderBy(desc(applications.appliedAt));

  return {
    shape: "personal",
    person: { name: identity.name, line: `Applicant · ${identity.email}`, since: null, edit: null },
    checklist: null,
    roster: null,
    applications: rows.map((r) => ({
      title: r.title ?? "Untitled position",
      detail: [r.dept_name, `sent ${dayMonthYear.format(new Date(r.applied_at))}`].filter(Boolean).join(" · "),
      status: statusOf[r.status],
    })),
    hint: null,
  };
}

function overviewOf(identity: Identity): Promise<Overview> {
  switch (identity.kind) {
    case "operations-lead":
      return teamOverview(identity);
    case "division-lead":
      return divisionOverview(identity);
    case "member":
      return memberOverview(identity);
    case "non-member":
      return applicantOverview(identity);
  }
}

async function hasOwnApplications(identity: Identity): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.userId, identity.userId))
    .limit(1);
  return row !== undefined;
}

async function navCountsOf(identity: Identity): Promise<NavCounts> {
  if (identity.kind !== "operations-lead" && identity.kind !== "division-lead") return {};
  const fresh = (await readPositions(identity)).reduce((sum, p) => sum + p.newApplications, 0);
  return fresh > 0 ? { applications: fresh } : {};
}

/**
 * The Members page: the whole team for the operations lead, the lead's own
 * division and the people joining it for a division lead.
 */
async function membersOf(identity: Identity): Promise<MemberDirectory> {
  if (identity.kind === "operations-lead") {
    const snapshot = await readTeamSnapshot();
    return teamDirectory(rosterOf(snapshot), snapshot.org, identity.memberId);
  }
  const division = leadDivisionId(identity);
  if (division === null) return NO_DIVISION;
  const [snapshot, joining] = await Promise.all([readTeamSnapshot(), readJoining(division)]);
  return divisionDirectory(rosterOf(snapshot), snapshot.org, division, identity.memberId, joining);
}

/** The signed-in account's dashboard, or null when nobody is signed in or there is no database. */
export async function openDatabaseDashboard(): Promise<DashboardData | null> {
  if (!isDatabaseConfigured()) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const identity = await readIdentity(userId);
  if (!identity) return null;

  const viewer: DashboardViewer = {
    kind: identity.kind,
    name: identity.name,
    role: identity.kind === "non-member" ? "Applicant" : identity.role?.title ?? "Member",
    session: "account",
  };
  return {
    viewer,
    navCounts: () => navCountsOf(identity),
    hasOwnApplications: () => hasOwnApplications(identity),
    overview: () => overviewOf(identity),
    members: () => membersOf(identity),
    alumni: async () =>
      alumniDirectory(canReach(identity.kind, "alumni") ? alumniOf(await readTeamSnapshot()) : []),
    teamTree: async () => {
      const snapshot = await readTeamSnapshot();
      const roster = canReach(identity.kind, "team-tree") ? rosterOf(snapshot) : [];
      return buildTeamTree(roster, snapshot.org, seasonAt(new Date()), identity.memberId);
    },
    teamWrites: databaseTeamWrites(identity),
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
    ...databaseSelfPages(identity),
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
