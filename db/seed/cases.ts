// The cases the typed seed holds (issues #304, #305, #308, #310, #311 and #326), each with the check that
// proves it from the seeded rows. docs/seed-cases.md lists the same cases; a
// test runs every check and fails when the page and this list differ.

import type { InferInsertModel } from "drizzle-orm";
import {
  orderStatusEnum,
  type aliasRequests,
  type alumniEntries,
  type alumniImportedRoles,
  type applicationFiles,
  type applications,
  type applicationStatuses,
  type applyPositions,
  type dashboardNotices,
  type departments,
  type divisions,
  type faqs,
  type faqVersions,
  type handOverRequests,
  type interviewSlots,
  type members,
  type orders,
  type outreachPosts,
  type outreachPostTags,
  type outreachPostVersions,
  type outreachTags,
  type partners,
  type partnerVersions,
  type projects,
  type projectVersions,
  type recruitmentSetting,
  type roles,
  type scopes,
  type teamAddresses,
  type teamPageAdvisors,
  type teamPageAdvisorVersions,
  type teamJoins,
  type teamPageLayerVersions,
  type users,
} from "@/db/schema";
import { isAdvisorVersion, publicAdvisors, type AdvisorItem } from "@/lib/about/advisors";
import { academicYearOfDay, alumniOf, listed, type AlumniRecord, type Alumnus } from "@/lib/about/alumni-record";
import { team as teamRecord } from "@/lib/about/team";
import { applyLayer, isTeamPageLayer, NO_TEAM_LAYER, NO_UPLOADS, resetLayer, type ShownTeam, type TeamBuild, type TeamPageLayer } from "@/lib/about/team-layer";
import type { TeamPerson as PagePerson } from "@/lib/about/team-person";
import { teamBuildOf, teamPageFromRoles, type TeamRoles } from "@/lib/about/team-roles";
import { publicItems, statusOf, versionedFromRows, type ContentItem, type VersionKind } from "@/lib/content/versioned";
import { BUILT_IN_STATUS_KEYS, isBuiltInStatusKey, type BuiltInStatusKey } from "@/lib/dashboard/application-status";
import { storedApplicationState } from "@/lib/dashboard/stored-application";
import type { FaqVersion } from "@/lib/faq/faq";
import { trackRecord } from "@/lib/outreach";
import { featuredIdsOf, type FeaturedIds } from "@/lib/outreach-featured";
import { draftFromColumns, outreachPostOf, postFromColumns } from "@/lib/outreach-rows";
import { CHANNEL_NAMES, type OutreachDraft, type OutreachTag, type PostItem, type PostVersions } from "@/lib/outreach-types";
import type { Partner } from "@/lib/partners";
import { visualModelOf, type ProjectRecord } from "@/lib/project-content/record";
import { rowRecordOf } from "@/lib/project-content/row";
import { rocketModelOf, type OwnModel } from "@/lib/rocket-model";
import { partnerFromColumns } from "@/lib/partners-rows";
import { aliasAttentionFor, memberAliasesFor, teamAddressOf, type AliasRequest } from "@/lib/dashboard/alias-request";
import { ownAliasOf, showsAliasCard } from "@/lib/dashboard/alias-setup";
import { UNIT_TARGETS } from "@/lib/dashboard/division-access";
import type { TeamPerson } from "@/lib/dashboard/division-edit";
import { steppingDown } from "@/lib/dashboard/hand-over";
import { attentionOf, noticeOf } from "@/lib/dashboard/notices";
import { handOverAttentionFor, hasLapsed, successorsFor, type HandOverRequest, type RequestedRole } from "@/lib/dashboard/hand-over-request";
import { isTeamSeat, membershipsOfRoles, roleBeyondDivisions, type OrgChart, type Placement, type RoleSeat } from "@/lib/dashboard/team";
import {
  kindOfPlainSeat,
  seatOf,
  SEAT_OF_FLAG,
  PLAIN_SEATS,
  plainSeatStanding,
  unitRowsOf,
  viewerStandingOf,
  type ScopeKind,
  type PlainSeat,
  type ViewerStanding,
} from "@/lib/dashboard/viewer";
import { memberTeamAddressesFor, movesWithOf, ownTeamAddressesOf, teamAddressCardsOf } from "@/lib/dashboard/team-address";
import { ALIAS_NOTICE_ROWS, ALIAS_REQUEST_ROWS, AUTOMATIC_REQUEST, CREATED_ALIAS, DECLINED_REQUEST, OPEN_REQUEST, TEAM_ADDRESS_ROWS } from "./aliases";
import { ALUMNI_ENTRY_ROWS, ALUMNI_IMPORTED_ROLE_ROWS } from "./alumni";
import { SCOPE_ROWS } from "./access";
import { FAQ_ROWS, FAQ_VERSION_ROWS } from "./faq";
import { HAND_OVER_ROWS } from "./hand-overs";
import { ORDER_ROWS } from "./orders";
import {
  OUTREACH_POST_ROWS,
  OUTREACH_POST_TAG_ROWS,
  OUTREACH_POST_VERSION_ROWS,
  OUTREACH_TAG_ROWS,
} from "./outreach";
import { PARTNER_ROWS, PARTNER_VERSION_ROWS } from "./partners";
import { PROJECT_ROWS, PROJECT_VERSION_ROWS } from "./projects";
import { ADDED_BY_EMAIL, ADDED_USER_ROWS, IT_LEAD, MEMBER_ROWS, ROLE_ROWS, PLAIN_SEAT_PEOPLE, SIGN_IN_ROWS, TEAM_JOIN_ROWS, USER_ROWS } from "./people";
import { APPLICATION_FILE_ROWS, APPLICATION_ROWS, APPLICATION_STATUS_ROWS, POSITION_ROWS, RECRUITMENT_SETTING_ROWS, SLOT_ROWS } from "./recruitment";
import { DEPARTMENT_ROWS, DIVISION_ROWS } from "./structure";
import {
  ADDED_LEADER_AFTER,
  ADDED_LEADER_PERSON,
  HIDDEN_LEAD_SPOT,
  RENAMED_HEAD_SPOT,
  TEAM_PAGE_ADVISOR_ROWS,
  TEAM_PAGE_ADVISOR_VERSION_ROWS,
  TEAM_PAGE_LAYER_ROWS,
} from "./team-page";

/** Every row the typed modules insert, by table. */
export type SeedData = {
  readonly departments: readonly InferInsertModel<typeof departments>[];
  readonly divisions: readonly InferInsertModel<typeof divisions>[];
  readonly members: readonly InferInsertModel<typeof members>[];
  readonly users: readonly InferInsertModel<typeof users>[];
  /** The people added by email who have not signed in (issue #746): `users` rows with no sign-in row. */
  readonly addedUsers: readonly InferInsertModel<typeof users>[];
  readonly teamJoins: readonly InferInsertModel<typeof teamJoins>[];
  readonly roles: readonly InferInsertModel<typeof roles>[];
  readonly scopes: readonly InferInsertModel<typeof scopes>[];
  readonly alumniEntries: readonly InferInsertModel<typeof alumniEntries>[];
  readonly alumniImportedRoles: readonly InferInsertModel<typeof alumniImportedRoles>[];
  readonly orders: readonly InferInsertModel<typeof orders>[];
  readonly positions: readonly InferInsertModel<typeof applyPositions>[];
  readonly applications: readonly InferInsertModel<typeof applications>[];
  readonly applicationFiles: readonly InferInsertModel<typeof applicationFiles>[];
  readonly interviewSlots: readonly InferInsertModel<typeof interviewSlots>[];
  readonly recruitmentSetting: readonly InferInsertModel<typeof recruitmentSetting>[];
  readonly applicationStatuses: readonly InferInsertModel<typeof applicationStatuses>[];
  readonly partners: readonly InferInsertModel<typeof partners>[];
  readonly partnerVersions: readonly InferInsertModel<typeof partnerVersions>[];
  readonly faqs: readonly InferInsertModel<typeof faqs>[];
  readonly faqVersions: readonly InferInsertModel<typeof faqVersions>[];
  readonly handOvers: readonly InferInsertModel<typeof handOverRequests>[];
  readonly aliasRequests: readonly InferInsertModel<typeof aliasRequests>[];
  readonly aliasNotices: readonly InferInsertModel<typeof dashboardNotices>[];
  readonly teamAddresses: readonly InferInsertModel<typeof teamAddresses>[];
  readonly outreachTags: readonly InferInsertModel<typeof outreachTags>[];
  readonly outreachPosts: readonly InferInsertModel<typeof outreachPosts>[];
  readonly outreachPostVersions: readonly InferInsertModel<typeof outreachPostVersions>[];
  readonly outreachPostTags: readonly InferInsertModel<typeof outreachPostTags>[];
  readonly projects: readonly InferInsertModel<typeof projects>[];
  readonly projectVersions: readonly InferInsertModel<typeof projectVersions>[];
  readonly teamPageLayerVersions: readonly InferInsertModel<typeof teamPageLayerVersions>[];
  readonly teamPageAdvisors: readonly InferInsertModel<typeof teamPageAdvisors>[];
  readonly teamPageAdvisorVersions: readonly InferInsertModel<typeof teamPageAdvisorVersions>[];
};

export const SEED_DATA: SeedData = {
  departments: DEPARTMENT_ROWS.rows,
  divisions: DIVISION_ROWS.rows,
  members: MEMBER_ROWS.rows,
  users: USER_ROWS.rows,
  addedUsers: ADDED_USER_ROWS.rows,
  teamJoins: TEAM_JOIN_ROWS.rows,
  roles: ROLE_ROWS.rows,
  scopes: SCOPE_ROWS.rows,
  alumniEntries: ALUMNI_ENTRY_ROWS.rows,
  alumniImportedRoles: ALUMNI_IMPORTED_ROLE_ROWS.rows,
  orders: ORDER_ROWS.rows,
  positions: POSITION_ROWS.rows,
  applications: APPLICATION_ROWS.rows,
  applicationFiles: APPLICATION_FILE_ROWS.rows,
  interviewSlots: SLOT_ROWS.rows,
  recruitmentSetting: RECRUITMENT_SETTING_ROWS.rows,
  applicationStatuses: APPLICATION_STATUS_ROWS.rows,
  partners: PARTNER_ROWS.rows,
  partnerVersions: PARTNER_VERSION_ROWS.rows,
  faqs: FAQ_ROWS.rows,
  faqVersions: FAQ_VERSION_ROWS.rows,
  handOvers: HAND_OVER_ROWS.rows,
  aliasRequests: ALIAS_REQUEST_ROWS.rows,
  aliasNotices: ALIAS_NOTICE_ROWS.rows,
  teamAddresses: TEAM_ADDRESS_ROWS.rows,
  outreachTags: OUTREACH_TAG_ROWS.rows,
  outreachPosts: OUTREACH_POST_ROWS.rows,
  outreachPostVersions: OUTREACH_POST_VERSION_ROWS.rows,
  outreachPostTags: OUTREACH_POST_TAG_ROWS.rows,
  projects: PROJECT_ROWS.rows,
  projectVersions: PROJECT_VERSION_ROWS.rows,
  teamPageLayerVersions: TEAM_PAGE_LAYER_ROWS.rows,
  teamPageAdvisors: TEAM_PAGE_ADVISOR_ROWS.rows,
  teamPageAdvisorVersions: TEAM_PAGE_ADVISOR_VERSION_ROWS.rows,
};

/** The academic year the Alumni page counts as current when the seed was written (2026–27). */
export const SEED_CURRENT_YEAR = 2026;

type Role = SeedData["roles"][number];

/**
 * A seeded role row of `data` as `RoleSeat`, the way lib/dashboard/team-database.ts
 * reads a stored one. A row seeded with no id gets the one a fresh database
 * gives it: its place in `data.roles`, from 1.
 */
function seatOfRole(data: SeedData, role: Role): RoleSeat {
  return {
    id: role.id ?? data.roles.indexOf(role) + 1,
    type: role.type ?? null,
    divisionId: role.divisionId ?? null,
    since: role.startedAt!,
    departmentId: role.deptId ?? null,
    title: role.title,
    fullAccess: role.fullAccess == null ? null : SEAT_OF_FLAG[role.fullAccess],
  };
}

export function isActive(role: Role): boolean {
  return (role.leavedAt ?? null) === null;
}

/** The member ids that hold a role now. */
export function onTeam(data: SeedData): Set<number> {
  return new Set(data.roles.filter(isActive).flatMap((r) => (r.memberId == null ? [] : [r.memberId])));
}

/**
 * The standing the dashboard reads for one seeded user, the way `readIdentity`
 * builds it: someone with no active role is on the Alumni record when the
 * Alumni page knows them (`readOwnAlumnus`, lib/dashboard/database-alumni.ts).
 */
export function standingOfUser(data: SeedData, userId: string): ViewerStanding | null {
  const user = data.users.find((u) => u.id === userId);
  if (user === undefined) return null;
  const memberId = user.member ?? null;
  if (memberId === null) return viewerStandingOf(null);
  const openDepartmentIds = data.departments.filter((d) => (d.closedAt ?? null) === null).map((d) => d.id!);
  const scopeRows = data.scopes
    .filter((s) => s.memberId === memberId)
    .map((s) => ({
      scope: s.scope as ScopeKind,
      target: s.target,
      level: s.accessLevel ?? "view",
      divisionId: s.divisionId ?? null,
      deptId: s.deptId ?? null,
    }));
  const activeRoles = data.roles
    .filter((r) => r.memberId === memberId && isActive(r))
    .map((r) => ({
      type: r.type ?? null,
      divisionId: r.divisionId ?? null,
      fullAccess: r.fullAccess == null ? null : SEAT_OF_FLAG[r.fullAccess],
    }));
  const onAlumniRecord = activeRoles.length === 0 && alumnusOf(data, memberId) !== undefined;
  return viewerStandingOf({ scopes: unitRowsOf(scopeRows, openDepartmentIds), activeRoles, onAlumniRecord });
}

/** Whether the seeded person reads as the plain seat: the same kind and the same full-access seat. */
export function resolvesTo(data: SeedData, viewer: PlainSeat): boolean {
  const standing = standingOfUser(data, PLAIN_SEAT_PEOPLE[viewer]);
  if (standing === null) return false;
  const expected = plainSeatStanding(viewer);
  return standing.kind === kindOfPlainSeat(viewer) && seatOf(standing) === seatOf(expected);
}

/** The Alumni page's record built from the seeded rows, as lib/dashboard/database-alumni.ts reads it. */
export function alumniRecordOf(data: SeedData): AlumniRecord {
  return {
    units: {
      departments: data.departments.map((d) => ({ id: d.id!, name: d.name })),
      divisions: data.divisions.map((d) => ({ id: d.id!, name: d.name, departmentId: d.deptId ?? null })),
    },
    roles: data.roles.flatMap((r) =>
      r.memberId == null
        ? []
        : [
            {
              memberId: r.memberId,
              type: r.type ?? null,
              title: r.title,
              startedAt: r.startedAt!,
              leftAt: r.leavedAt ?? null,
              departmentId: r.deptId ?? null,
              divisionId: r.divisionId ?? null,
            },
          ],
    ),
    people: data.users.flatMap((u) =>
      u.member == null
        ? []
        : [{ memberId: u.member, name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null, email: u.email }],
    ),
    entries: data.alumniEntries.flatMap((e) => {
      const who =
        e.kind === "member" && e.memberId != null
          ? { kind: "member" as const, memberId: e.memberId, keptName: e.recordName ?? null }
          : e.kind === "imported" && e.recordName != null
            ? { kind: "imported" as const, name: e.recordName }
            : null;
      if (who === null) return [];
      return [
        {
          id: e.id!,
          who,
          name: e.name ?? null,
          founder: e.founder == null ? null : e.founder === "founder" ? ("founder" as const) : ("co-founder" as const),
          photo: e.photo ?? null,
          shown: e.shown ?? true,
          removed: (e.removedAt ?? null) !== null,
          fixes: [],
        },
      ];
    }),
    imported: data.alumniImportedRoles.map((r) => ({ entryId: r.entryId, year: r.year, group: r.groupName, role: r.role, position: r.position })),
  };
}

export function alumniOfSeed(data: SeedData): Alumnus[] {
  return alumniOf(alumniRecordOf(data), SEED_CURRENT_YEAR);
}

function alumnusOf(data: SeedData, memberId: number): Alumnus | undefined {
  return alumniOfSeed(data).find((a) => a.key === `m${memberId}`);
}

function entryOf(data: SeedData, memberId: number) {
  return data.alumniEntries.find((e) => e.memberId === memberId);
}

/** The academic year each member's last role ended in, for members who hold none now. */
export function leftInYear(data: SeedData): Map<number, number> {
  const current = onTeam(data);
  const left = new Map<number, number>();
  for (const role of data.roles) {
    if (role.memberId == null || current.has(role.memberId) || role.leavedAt == null) continue;
    left.set(role.memberId, Math.max(left.get(role.memberId) ?? 0, academicYearOfDay(role.leavedAt)));
  }
  return left;
}

// Orders, recruitment, partners and FAQ (issue #305), read back from the
// rows the way the database sources read them.

/** The department each order is for, through its division. */
export function orderDepartments(data: SeedData): Set<number> {
  return new Set(
    data.orders.flatMap((o) => {
      const deptId = data.divisions.find((d) => d.id === o.divisionId)?.deptId;
      return deptId == null ? [] : [deptId];
    }),
  );
}

type Application = SeedData["applications"][number];

/** The built-in status a seeded application reads as on the dashboard: withdrawn first, then ./stored-application.ts. */
export function applicationStatusOf(data: SeedData, application: Application): BuiltInStatusKey {
  if (application.withdrawnAt != null) return "withdrawn";
  const slots = data.interviewSlots
    .filter((s) => s.applicationId === application.id)
    .map((s) => ({
      application_id: s.applicationId,
      starts_at: s.startsAt,
      ends_at: s.endsAt,
      chosen: s.chosen ?? false,
      chosen_at: s.chosenAt ?? null,
      created_at: s.createdAt!,
    }));
  const statusKey = application.statusKey ?? null;
  return storedApplicationState(
    {
      status_key: statusKey,
      status_parent_key: data.applicationStatuses.find((s) => s.key === statusKey)?.parentKey ?? null,
      applied_at: application.appliedAt!,
      accepted_at: application.acceptedAt ?? null,
      nda_arrived_at: application.ndaArrivedAt ?? null,
      joined_at: application.joinedAt ?? null,
    },
    slots,
  ).status;
}

/** Items read back from their version rows, the way the database sources build them. */
function itemsOf<T>(
  rows: readonly { id?: number; siteOrder: number }[],
  versions: readonly { itemId: number; kind: VersionKind; content: T }[],
): ContentItem<T>[] {
  return rows.flatMap((row) => {
    const version = versionedFromRows(versions.filter((v) => v.itemId === row.id));
    return version === null ? [] : [{ id: row.id!, siteOrder: row.siteOrder, version }];
  });
}

export function partnerItemsOf(data: SeedData): ContentItem<Partner>[] {
  return itemsOf(
    data.partners,
    data.partnerVersions.map((v) => ({
      itemId: v.partnerId,
      kind: v.version,
      content: partnerFromColumns({
        name: v.name,
        tier: v.tier,
        logoUrl: v.logoUrl,
        logoWidth: v.logoWidth,
        logoHeight: v.logoHeight,
        logoKind: v.logoKind,
        logoDark: v.logoDark,
        website: v.website ?? null,
        oneLiner: v.oneLiner,
        about: v.about ?? null,
        support: v.support ?? null,
      }),
    })),
  );
}

export function faqItemsOf(data: SeedData): ContentItem<FaqVersion>[] {
  return itemsOf(
    data.faqs,
    data.faqVersions.map((v) => ({
      itemId: v.faqId,
      kind: v.version,
      content: { question: v.question, answer: v.answer as unknown as FaqVersion["answer"], updatedAt: v.updatedAt! },
    })),
  );
}

/**
 * The projects read back from their version rows, the way
 * lib/dashboard/database-projects.ts reads them: a row that is not a whole
 * project record is a fault, so it throws.
 */
export function projectItemsOf(data: SeedData): ContentItem<ProjectRecord>[] {
  return itemsOf(
    data.projects,
    data.projectVersions.map((v) => {
      const content = rowRecordOf(v);
      if (content === null) throw new Error(`project ${v.projectId} holds a ${v.version} version that is not a project record`);
      return { itemId: v.projectId, kind: v.version, content };
    }),
  );
}

/** The rocket a project's home card and its page's panel draw: its own model, or the placeholder. */
export function rocketsOf(record: ProjectRecord): { card: string; page: string | null } {
  const { visual } = record.hero;
  const model = rocketModelOf(visualModelOf<OwnModel>(record.hero));
  return { card: model, page: visual.kind === "model" ? model : null };
}

// Hand-overs (issue #308), read through the hand-over rules
// (lib/dashboard/hand-over-request.ts) the way the database source reads them.

/** The open org chart, as the team snapshot reads it (lib/dashboard/team-database.ts). */
export function orgOf(data: SeedData): OrgChart {
  return {
    departments: data.departments.filter((d) => (d.closedAt ?? null) === null).map((d) => ({ id: d.id!, name: d.name, code: d.code ?? null, kind: d.kind ?? "technical" })),
    divisions: data.divisions
      .filter((d) => (d.closedAt ?? null) === null)
      .flatMap((d) => (d.deptId == null ? [] : [{ id: d.id!, name: d.name, departmentId: d.deptId, code: d.code ?? null }])),
  };
}

/**
 * Everyone on the team as the hand-over rules read them, as `teamPeopleOf`
 * builds them from the same rows: each division they hold an active role in,
 * and every active role they hold in no division.
 */
export function teamOf(data: SeedData): TeamPerson[] {
  const org = orgOf(data);
  return [...onTeam(data)].map((memberId) => {
    const active = data.roles
      .filter((r) => r.memberId === memberId && isActive(r))
      .map((r) => seatOfRole(data, r));
    const user = data.users.find((u) => u.member === memberId);
    const inOpenDivision = (r: RoleSeat) => org.divisions.some((d) => d.id === r.divisionId);
    return {
      id: memberId,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
      emails: user === undefined ? [] : [user.email],
      memberships: membershipsOfRoles(active.filter((r) => inOpenDivision(r) && roleBeyondDivisions(r, org) === null)),
      beyond: active.flatMap((r) => roleBeyondDivisions(r, org) ?? []),
    };
  });
}

type HandOverRow = SeedData["handOvers"][number];

function requestedRoleOf(row: HandOverRow): RequestedRole | null {
  if (row.role === "lead") return row.divisionId == null ? null : { kind: "lead", divisionId: row.divisionId };
  return row.deptId == null ? null : { kind: "head", departmentId: row.deptId };
}

/** The hand-overs still waiting for an answer, as `readWaitingHandOvers` reads them. */
export function waitingHandOversOf(data: SeedData): HandOverRequest[] {
  return data.handOvers.flatMap((row) => {
    const role = requestedRoleOf(row);
    return row.decision != null || role === null
      ? []
      : [{ id: row.id!, fromId: row.fromId, role, toId: row.toId, outcome: row.outcome, sentAt: row.createdAt! }];
  });
}

// Email aliases (issue #550), read through the alias rules
// (lib/dashboard/alias-request.ts, alias-setup.ts) the way the database source
// reads them (lib/dashboard/database-alias.ts).

/** The requests still open, as `readOpenAliasRequests` reads them. */
export function openAliasRequestsOf(data: SeedData): AliasRequest[] {
  return data.aliasRequests.flatMap((r) =>
    r.outcome != null ? [] : [{ id: r.id!, memberId: r.memberId, requesterId: r.requestedBy ?? null, sentAt: r.createdAt! }],
  );
}

/** Every member's PRT email that is set, their alias, by member id, as `readAliasAddresses` reads them (issue #563). */
export function aliasAddressesOf(data: SeedData): Map<number, string> {
  return new Map(
    data.members.flatMap((m) => {
      const address = teamAddressOf(m.prtEmail);
      return address === null ? [] : [[m.memberId!, address] as const];
    }),
  );
}

/** The member a seeded user is, by member id: the user whose `member` it is. */
function userOfMember(data: SeedData, memberId: number): string | undefined {
  return data.users.find((u) => u.member === memberId)?.id;
}

/** The three approver seats' standings: the team leader, the operations lead and the IT lead. */
export function aliasApproversOf(data: SeedData): ViewerStanding[] {
  const users = [PLAIN_SEAT_PEOPLE["team-leader"], PLAIN_SEAT_PEOPLE["operations-lead"], userOfMember(data, IT_LEAD)];
  return users.flatMap((id) => {
    const standing = id === undefined ? null : standingOfUser(data, id);
    return standing === null ? [] : [standing];
  });
}

/** The alias of `memberId` in `viewer`'s member drawer, with the viewer's standing as `readIdentity` builds it. */
export function drawerAliasOf(data: SeedData, viewer: number | null, memberId: number) {
  const user = viewer === null ? undefined : userOfMember(data, viewer);
  return memberAliasesFor({
    viewerId: viewer,
    standing: (user === undefined ? null : standingOfUser(data, user)) ?? viewerStandingOf(null),
    memberIds: [memberId],
    team: teamOf(data),
    org: orgOf(data),
    addresses: aliasAddressesOf(data),
    open: openAliasRequestsOf(data),
    now: new Date(),
  })[memberId];
}

/** The Team addresses row of `memberId`'s side view (board 102), as `readMemberTeamAddresses` reads it. */
export function drawerTeamAddressesOf(data: SeedData, memberId: number) {
  const held = data.teamAddresses.map((r, i) => ({
    id: r.id ?? i + 1,
    address: r.address,
    purpose: r.purpose,
    holderId: r.holderId,
    movesWith: movesWithOf({
      moves_with: r.movesWith ?? null,
      moves_with_seat: r.movesWithSeat ?? null,
      moves_with_dept_id: r.movesWithDeptId ?? null,
      moves_with_division_id: r.movesWithDivisionId ?? null,
    }),
  }));
  // The lines alone, which every viewer of the row reads the same; who may request is the viewer's.
  return (
    memberTeamAddressesFor({ viewerId: null, standing: viewerStandingOf(null), memberIds: [memberId], team: teamOf(data), org: orgOf(data), held, removing: [] }).rows[memberId]
      ?.lines ?? []
  );
}

/** The rows each approver reads under "Needs your attention" for the open requests. */
export function aliasRowsOf(data: SeedData, viewer: ViewerStanding) {
  // Each with the address they sign in with, as `aliasTeamOf` reads it (issue #586).
  const team = teamOf(data).map((p) => ({ ...p, signInEmail: data.users.find((u) => u.member === p.id)?.email ?? "" }));
  return aliasAttentionFor(viewer, openAliasRequestsOf(data), team, orgOf(data), new Date());
}

/** `recipient`'s alias notices as their attention rows, as `readNotices` reads them. */
export function aliasNoticeRowsOf(data: SeedData, recipient: number | null) {
  const team = teamOf(data);
  return data.aliasNotices.flatMap((row, i) => {
    if (row.recipientId !== recipient) return [];
    const notice = noticeOf({ id: i + 1, kind: row.kind, subject: team.find((p) => p.id === row.subjectId)?.name ?? "", createdAt: row.createdAt!, data: row.data });
    return notice === null ? [] : [attentionOf(notice, new Date())];
  });
}

/** The member a seeded user is, or null for someone off the team. */
export function memberOfUser(data: SeedData, userId: string): number | null {
  return data.users.find((u) => u.id === userId)?.member ?? null;
}

/** Whether the role row was held on `day` ("2022-09-30"). */
function heldOn(role: Role, day: string): boolean {
  return role.startedAt! <= day && (role.leavedAt == null || role.leavedAt > day);
}

/**
 * Whether a confirmed lead hand-over left the roles as Confirm writes them
 * (lib/dashboard/database-team.ts): a head of the lead's department answered
 * it; on that day the sender's lead row ended and, for "Become an advisor",
 * their Advisor role in the division started with their access gone; and the
 * successor, in the division when it was sent, leads it now.
 */
export function confirmedAsWritten(data: SeedData, row: HandOverRow): boolean {
  const role = requestedRoleOf(row);
  if (row.decision !== "confirmed" || row.decidedAt == null || row.decidedBy == null || role === null || role.kind !== "lead") return false;
  const day = row.decidedAt.slice(0, 10);
  const sent = row.createdAt!.slice(0, 10);
  const deptId = data.divisions.find((d) => d.id === role.divisionId)?.deptId;
  const answeredByHead = data.roles.some(
    (r) => r.memberId === row.decidedBy && r.type === "head" && r.deptId === deptId && r.divisionId == null && heldOn(r, day),
  );
  const senderRoles = data.roles.filter((r) => r.memberId === row.fromId);
  const leadEnded = senderRoles.some((r) => r.type === "lead" && r.divisionId === role.divisionId && heldOn(r, sent) && r.leavedAt === day);
  const step = steppingDown(role, row.outcome);
  const steppedDown =
    step.kind === "leave"
      ? senderRoles.every((r) => !isActive(r)) && !data.scopes.some((s) => s.memberId === row.fromId)
      : step.place.kind === "division" &&
        senderRoles.some((r) => r.type === "advisor" && r.divisionId === role.divisionId && r.startedAt === day && isActive(r)) &&
        (step.access === "keeps-full-access" || !data.scopes.some((s) => s.memberId === row.fromId));
  const successorLeads = data.roles.some(
    (r) => r.memberId === row.toId && r.type === "lead" && r.divisionId === role.divisionId && isActive(r) && r.startedAt! <= sent,
  );
  return answeredByHead && leadEnded && steppedDown && successorLeads;
}

// Outreach (issue #309), read back from the rows the way
// lib/dashboard/database-outreach.ts reads them.

/** The tag list in its order. */
export function outreachTagsOf(data: SeedData): OutreachTag[] {
  return [...data.outreachTags].sort((a, b) => a.listOrder - b.listOrder).map((t) => ({ name: t.name, award: t.award ?? false }));
}

/** The posts in site order, each with its versions: a live post's are whole, a never-published draft may not be. */
export function outreachItemsOf(data: SeedData): PostItem[] {
  const tagsOf = (postId: number, version: string) =>
    data.outreachPostTags
      .filter((t) => t.postId === postId && t.version === version)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.tagName);
  return [...data.outreachPosts]
    .sort((a, b) => a.siteOrder - b.siteOrder || a.id! - b.id!)
    .flatMap((post): PostItem[] => {
      // A column the insert leaves out reads back as null, as the database answers it.
      const rows = data.outreachPostVersions
        .filter((v) => v.postId === post.id)
        .map((v) => ({ ...v, place: v.place ?? null, summaryPhone: v.summaryPhone ?? null, gallery: v.gallery ?? null }));
      const published = rows.find((v) => v.version === "published");
      const draft = rows.find((v) => v.version === "draft");
      const version: PostVersions | null =
        published !== undefined
          ? {
              state: "published",
              published: postFromColumns(published, tagsOf(post.id!, "published")),
              draft: draft === undefined ? null : postFromColumns(draft, tagsOf(post.id!, "draft")),
            }
          : draft === undefined
            ? null
            : { state: "draft", draft: draftFromColumns(draft, tagsOf(post.id!, "draft")) };
      return version === null ? [] : [{ id: post.id!, siteOrder: post.siteOrder, version }];
    });
}

/** The featured posts' ids (issue #496), slot 1 first; the two slots refuse a third. */
export function outreachFeaturedOf(data: SeedData): FeaturedIds {
  const rows = data.outreachPosts.filter((p) => p.featuredSlot !== null && p.featuredSlot !== undefined);
  const ids = featuredIdsOf([...rows].sort((a, b) => (a.featuredSlot ?? 0) - (b.featuredSlot ?? 0)).map((p) => p.id ?? 0));
  if (ids === null) throw new Error("more than two outreach posts are featured");
  return ids;
}

/** Every version of every post, published or draft. */
function outreachVersionsOf(data: SeedData): OutreachDraft[] {
  return outreachItemsOf(data).flatMap((item) =>
    item.version.state === "draft" ? [item.version.draft] : [item.version.published, ...(item.version.draft === null ? [] : [item.version.draft])],
  );
}

// The Team page (issue #311), read back the way lib/about/team-data.ts reads
// it: the roles placed as the team snapshot places them, with the published
// layer laid on.

/** A role's rank when the roster picks where someone sits, as lib/dashboard/team-database.ts ranks it. */
function placementRank(role: Role): number {
  if (role.type === "president") return 0;
  if (isTeamSeat({ type: role.type ?? null, departmentId: role.deptId ?? null, divisionId: role.divisionId ?? null })) return 1;
  const ranks: Readonly<Record<string, number>> = { head: 2, lead: 3, core: 4, advisor: 4 };
  return ranks[role.type ?? ""] ?? 5;
}

/** Where someone's active roles put them, highest first, as `placementOf` in lib/dashboard/team-database.ts. */
function placementOfRoles(data: SeedData, active: readonly Role[], org: OrgChart): Placement {
  const [top] = active;
  const open = active.filter((r) => org.divisions.some((d) => d.id === r.divisionId)).map((r) => seatOfRole(data, r));
  const beside = () => membershipsOfRoles(open.filter((r) => roleBeyondDivisions(r, org) === null));
  const seat = roleBeyondDivisions(seatOfRole(data, top), org);
  if (seat?.kind === "team-leader") return { role: "team-leader", memberships: beside() };
  if (seat?.kind === "board") return { role: "board", seat: seat.seat, memberships: beside() };
  if (seat?.kind === "head") {
    const { departmentId, title } = seat;
    if (departmentId !== null && org.departments.some((d) => d.id === departmentId)) return { role: "head", departmentId, title, memberships: beside() };
  }
  return { role: "divisions", memberships: membershipsOfRoles(open) };
}

/** The team as the Team page reads it from the seeded rows. */
export function teamRolesOf(data: SeedData): TeamRoles {
  const org = orgOf(data);
  const people = [...onTeam(data)].flatMap((memberId): PagePerson[] => {
    const active = data.roles.filter((r) => r.memberId === memberId && isActive(r)).sort((a, b) => placementRank(a) - placementRank(b));
    const user = data.users.find((u) => u.member === memberId);
    const member = data.members.find((m) => m.memberId === memberId);
    if (user === undefined) return [];
    return [
      {
        id: memberId,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        placement: placementOfRoles(data, active, org),
        pageTitle: active[0].title || null,
        photo: member?.picture ?? null,
        linkedin: user.linkedin ?? null,
        teamEmail: member?.prtEmail ?? null,
      },
    ];
  });
  return { org, people };
}

/** The published visual layer, or null when no row holds a layer this code could have written. */
export function publishedTeamPageLayerOf(data: SeedData): TeamPageLayer | null {
  const row = data.teamPageLayerVersions.find((r) => r.version === "published");
  return row !== undefined && isTeamPageLayer(row.layer, NO_UPLOADS) ? row.layer : null;
}

/** The roles build, and what /about/the-team shows with the published layer laid on. */
export function teamPageOfSeed(data: SeedData): { readonly build: TeamBuild; readonly layer: TeamPageLayer; readonly shown: ShownTeam } {
  const build = teamBuildOf(teamRolesOf(data));
  const layer = publishedTeamPageLayerOf(data) ?? NO_TEAM_LAYER;
  return { build, layer, shown: applyLayer(build, layer) };
}

/** The advisors read back from their version rows, as lib/dashboard/database-team-advisors.ts reads them. */
export function teamAdvisorItemsOf(data: SeedData): AdvisorItem[] {
  return itemsOf(
    data.teamPageAdvisors,
    data.teamPageAdvisorVersions.flatMap((v) => (isAdvisorVersion(v.advisor) ? [{ itemId: v.advisorId, kind: v.version, content: v.advisor }] : [])),
  );
}

export type SeedArea =
  | "structure"
  | "people"
  | "alumni"
  | "access"
  | "orders"
  | "recruitment"
  | "partners"
  | "faq"
  | "outreach"
  | "projects"
  | "hand-overs"
  | "aliases"
  | "team-page";

export const SEED_AREAS: readonly SeedArea[] = [
  "structure",
  "people",
  "alumni",
  "access",
  "orders",
  "recruitment",
  "partners",
  "faq",
  "outreach",
  "projects",
  "hand-overs",
  "aliases",
  "team-page",
];

export type SeedCase = {
  readonly area: SeedArea;
  /** The situation in plain words. */
  readonly case: string;
  /**
   * Where its rows come from (issue #326): `public`, the data the site
   * already publishes; `invented`, at least one invented row, because the
   * public data has no example of the case or the data is private.
   */
  readonly data: "public" | "invented";
  /** How to find the rows. */
  readonly rows: string;
  /** The issues or boards whose pages show it, as markdown links. */
  readonly exercisedBy: string;
  readonly holds: (data: SeedData) => boolean;
};

const issue = (n: number) => `[#${n}](https://github.com/PoliTo-Rocket-Team/website-v2/issues/${n})`;

const activeIn = (data: SeedData, divisionId: number) => data.roles.filter((r) => r.divisionId === divisionId && isActive(r));
const openDivisions = (data: SeedData) => data.divisions.filter((d) => (d.closedAt ?? null) === null);

export const SEED_CASES: readonly SeedCase[] = [
  {
    area: "structure",
    case: "A closed division, kept as a name, with nobody in it now",
    data: "invented",
    rows: "`divisions` code `HYB`",
    exercisedBy: `${issue(251)}, ${issue(257)}`,
    holds: (data) =>
      data.divisions.some(
        (d) => d.closedAt != null && activeIn(data, d.id!).length === 0 && data.roles.some((r) => r.divisionId === d.id),
      ),
  },
  {
    area: "people",
    case: "One team leader",
    data: "public",
    rows: "`roles` type `president`, member 1",
    exercisedBy: `${issue(247)}, ${issue(252)}`,
    holds: (data) => data.roles.filter((r) => r.type === "president" && isActive(r)).length === 1,
  },
  {
    area: "people",
    case: "A Project Manager and a Chief Engineer, the two flagged board seats, so the roles fill every section of the Team page; the Head of R&D heads a department with no divisions, a core member there",
    data: "public",
    rows: "`roles` in no department or division, members 52 and 53 flagged by `roles.full_access`; member 9's head row on department 8",
    exercisedBy: `${issue(282)}, ${issue(311)}, ${issue(625)}, ${issue(627)}`,
    holds: (data) => {
      const roles = teamRolesOf(data);
      const { build } = teamPageOfSeed(data);
      return (
        build.arc.map((l) => l.spot).join(",") === "arc:project-manager:0,arc:chief-engineer:0" &&
        build.core.some((m) => m.name === "Marco Dona" && m.role === "Head of R&D") &&
        teamPageFromRoles(roles, teamRecord) !== null
      );
    },
  },
  {
    area: "people",
    case: "One operations lead and one IT lead, the two full-access seats",
    data: "invented",
    rows: "`roles.full_access`, members 3 and 11",
    exercisedBy: `${issue(238)}, ${issue(252)}`,
    holds: (data) =>
      (["operations_lead", "it_lead"] as const).every(
        (seat) => data.roles.filter((r) => r.fullAccess === seat && isActive(r)).length === 1,
      ),
  },
  {
    area: "people",
    case: "A head in every open department",
    data: "invented",
    rows: "`roles` type `head`",
    exercisedBy: issue(252),
    holds: (data) =>
      data.departments
        .filter((d) => (d.closedAt ?? null) === null)
        .every((d) => data.roles.filter((r) => r.type === "head" && r.deptId === d.id && isActive(r)).length === 1),
  },
  {
    area: "people",
    case: "A lead in every open division that has people",
    data: "invented",
    rows: "`roles` type `lead` with a `division_id`",
    exercisedBy: `${issue(251)}, ${issue(252)}`,
    holds: (data) =>
      openDivisions(data)
        .filter((d) => activeIn(data, d.id!).length > 0)
        .every((d) => activeIn(data, d.id!).filter((r) => r.type === "lead").length === 1),
  },
  {
    area: "people",
    case: "Members with no lead role",
    data: "public",
    rows: "`roles` type `core`",
    exercisedBy: issue(252),
    holds: (data) => data.roles.filter((r) => r.type === "core" && isActive(r)).length >= 10,
  },
  {
    area: "people",
    case: "A member in two divisions at once",
    data: "public",
    rows: "`roles` of member 4",
    exercisedBy: `${issue(251)}, ${issue(252)}`,
    holds: (data) =>
      [...onTeam(data)].some(
        (m) => new Set(data.roles.filter((r) => r.memberId === m && isActive(r) && r.divisionId != null).map((r) => r.divisionId)).size >= 2,
      ),
  },
  {
    area: "people",
    case: "An advisor in a division, a former lead who stayed",
    data: "invented",
    rows: "`roles` type `advisor`, member 43",
    exercisedBy: `${issue(251)}, ${issue(253)}`,
    holds: (data) =>
      data.roles.some(
        (r) =>
          r.type === "advisor" &&
          isActive(r) &&
          r.divisionId != null &&
          data.roles.some((p) => p.memberId === r.memberId && p.type === "lead" && p.divisionId === r.divisionId && !isActive(p)),
      ),
  },
  {
    area: "people",
    case: "A team-level advisor: the former team leader, in no department or division",
    data: "invented",
    rows: "`roles` type `advisor`, member 40",
    exercisedBy: `${issue(253)}, ${issue(257)}`,
    holds: (data) =>
      data.roles.some(
        (r) =>
          r.type === "advisor" &&
          isActive(r) &&
          r.deptId == null &&
          r.divisionId == null &&
          data.roles.some((p) => p.memberId === r.memberId && p.type === "president" && !isActive(p)),
      ),
  },
  {
    area: "people",
    case: "One seeded person per plain seat, read as that seat",
    data: "invented",
    rows: "`PLAIN_SEAT_PEOPLE` in `db/seed/people.ts`",
    exercisedBy: issue(247),
    holds: (data) => PLAIN_SEATS.every((viewer) => resolvesTo(data, viewer)),
  },
  {
    area: "people",
    case: "Someone a division lead added by email who has not signed in yet, so they wait with no member row and no sign-in",
    data: "invented",
    rows: `\`users\` id \`${ADDED_BY_EMAIL.userId}\`, its \`team_joins\` row in Test Bench added by member ${ADDED_BY_EMAIL.addedBy}`,
    exercisedBy: issue(741),
    holds: (data) => {
      const added = data.addedUsers.filter((u) => u.id.startsWith("added:"));
      if (added.length !== 1) return false;
      const [user] = added;
      const joins = data.teamJoins.filter((j) => j.userId === user.id);
      if (joins.length !== 1) return false;
      const [join] = joins;
      return (
        user.email.endsWith("@example.com") &&
        (user.member ?? null) === null &&
        !data.users.some((u) => u.id === user.id || u.email === user.email) &&
        !SIGN_IN_ROWS.rows.some((row) => row.id === user.id || row.email === user.email) &&
        openDivisions(data).some((d) => d.id === join.divisionId) &&
        join.addedBy != null &&
        activeIn(data, join.divisionId).some((r) => r.memberId === join.addedBy && r.type === "lead")
      );
    },
  },
  {
    area: "alumni",
    case: "People who left in each year from 2021–22 to 2025–26",
    data: "invented",
    rows: "`roles.leaved_at`, members 32 and 41–51",
    exercisedBy: `${issue(257)}, ${issue(271)}`,
    holds: (data) => {
      const years = new Set(leftInYear(data).values());
      return [2021, 2022, 2023, 2024, 2025].every((y) => years.has(y));
    },
  },
  {
    area: "alumni",
    case: "A founder and a co-founder mark",
    data: "public",
    rows: "`alumni_entries.founder` of the imported entries 3 (Fabio Meloni), 4 and 5",
    exercisedBy: issue(257),
    holds: (data) => {
      const marks = alumniOfSeed(data).map((a) => a.founder);
      return marks.includes("founder") && marks.includes("co-founder");
    },
  },
  {
    area: "alumni",
    case: "A hidden alumnus",
    data: "invented",
    rows: "`alumni_entries` member 47, `shown` false",
    exercisedBy: issue(257),
    holds: (data) => alumniOfSeed(data).some((a) => !a.shown && !a.removed && !listed(a)),
  },
  {
    area: "alumni",
    case: "An alumnus whose account is deleted and anonymized, with the Alumni entry kept",
    data: "invented",
    rows: "`users` and `members` 48, `alumni_entries` member 48",
    exercisedBy: `${issue(191)}, ${issue(257)}`,
    holds: (data) =>
      data.users.some((u) => {
        if (u.anonymizedAt == null || u.member == null) return false;
        const alumnus = alumnusOf(data, u.member);
        return u.firstName == null && entryOf(data, u.member)?.recordName != null && alumnus !== undefined && listed(alumnus);
      }),
  },
  {
    area: "alumni",
    case: "An alumnus who asked to be removed from the Alumni page",
    data: "invented",
    rows: "`alumni_entries` member 49, `removed_at` set",
    exercisedBy: issue(257),
    holds: (data) => alumniOfSeed(data).some((a) => a.removed && !listed(a)),
  },
  {
    area: "alumni",
    case: "A name fixed for the Alumni page",
    data: "invented",
    rows: "`alumni_entries` member 50, `name` set",
    exercisedBy: issue(257),
    holds: (data) => alumniOfSeed(data).some((a) => listed(a) && a.name !== a.recordName),
  },
  {
    area: "alumni",
    case: "A former member read as the alumni plain seat: every role ended, an Alumni entry kept",
    data: "invented",
    rows: "`PLAIN_SEAT_PEOPLE` alumni, member 50",
    exercisedBy: issue(317),
    holds: (data) => {
      const user = data.users.find((u) => u.id === PLAIN_SEAT_PEOPLE.alumni);
      const memberId = user?.member ?? null;
      if (memberId === null) return false;
      const roles = data.roles.filter((r) => r.memberId === memberId);
      return roles.length > 0 && !roles.some(isActive) && entryOf(data, memberId) !== undefined && resolvesTo(data, "alumni");
    },
  },
  {
    area: "access",
    case: "Grants across the whole team",
    data: "invented",
    rows: "`scopes` scope `team`, members 22 and 23",
    exercisedBy: issue(247),
    holds: (data) => data.scopes.some((s) => s.scope === "team" && (UNIT_TARGETS as readonly string[]).includes(s.target)),
  },
  {
    area: "access",
    case: "Grants in one department",
    data: "invented",
    rows: "`scopes` scope `department`, members 12 and 131",
    exercisedBy: issue(247),
    holds: (data) => data.scopes.some((s) => s.scope === "department" && s.deptId != null),
  },
  {
    area: "access",
    case: "Grants in one division",
    data: "invented",
    rows: "`scopes` scope `division`, members 117 and 139",
    exercisedBy: issue(247),
    holds: (data) => data.scopes.some((s) => s.scope === "division" && s.divisionId != null),
  },
  {
    area: "access",
    case: "Grants at view and at edit",
    data: "invented",
    rows: "`scopes.access_level`",
    exercisedBy: issue(247),
    holds: (data) => (["view", "edit"] as const).every((level) => data.scopes.some((s) => (s.accessLevel ?? "view") === level)),
  },
  {
    area: "access",
    case: "A member who holds \"Approve orders\" and nothing else",
    data: "invented",
    rows: "`scopes` target `approve_orders`, member 124",
    exercisedBy: issue(270),
    holds: (data) =>
      data.scopes.some((s) => {
        if (s.target !== "approve_orders" || s.memberId == null) return false;
        const theirs = data.scopes.filter((o) => o.memberId === s.memberId);
        const role = data.roles.filter((r) => r.memberId === s.memberId && isActive(r));
        return theirs.length === 1 && role.every((r) => r.type === "core");
      }),
  },
  {
    area: "access",
    case: "Content access, which opens the Alumni page, given across the whole team",
    data: "invented",
    rows: "`scopes` scope `website` on `content`, member 144",
    exercisedBy: `${issue(247)}, ${issue(257)}`,
    holds: (data) => data.scopes.some((s) => s.scope === "website" && s.target === "content" && s.accessLevel === "edit"),
  },
  {
    area: "orders",
    case: "An order in every status: waiting, changes requested, rejected, approved, ordered and cancelled",
    data: "invented",
    rows: "`orders` 1–7",
    exercisedBy: `${issue(172)}, ${issue(247)}`,
    holds: (data) => orderStatusEnum.enumValues.every((status) => data.orders.some((o) => o.status === status)),
  },
  {
    area: "orders",
    case: "Orders made for divisions in different departments",
    data: "invented",
    rows: "`orders.division_id`",
    exercisedBy: `${issue(233)}, ${issue(247)}`,
    holds: (data) => orderDepartments(data).size >= 5,
  },
  {
    area: "orders",
    case: "An order approved by the member who holds \"Approve orders\" and nothing else",
    data: "invented",
    rows: "`orders` 5, `reviewed_by` member 124",
    exercisedBy: issue(270),
    holds: (data) =>
      data.orders.some(
        (o) => o.status === "accepted" && data.scopes.some((s) => s.memberId === o.reviewedBy && s.target === "approve_orders"),
      ),
  },
  {
    area: "recruitment",
    case: "Recruitment is on",
    data: "invented",
    rows: "`recruitment_setting.is_open`",
    exercisedBy: issue(119),
    holds: (data) => data.recruitmentSetting.length === 1 && data.recruitmentSetting[0].isOpen === true,
  },
  {
    area: "recruitment",
    case: "Open and closed positions",
    data: "invented",
    rows: "`apply_positions.status`; closed: 13, 18 and 23",
    exercisedBy: `${issue(119)}, ${issue(171)}`,
    holds: (data) => [true, false].every((open) => data.positions.some((p) => p.status === open && !p.isDeleted)),
  },
  {
    area: "recruitment",
    case: "An application where each built-in status reads, withdrawn included, as the dashboard reads it",
    data: "invented",
    rows: "`applications`, `interview_slots`",
    exercisedBy: `${issue(169)}, ${issue(171)}, ${issue(748)}`,
    holds: (data) => BUILT_IN_STATUS_KEYS.every((status) => data.applications.some((a) => applicationStatusOf(data, a) === status)),
  },
  {
    area: "recruitment",
    case: "Every application references a status: each of the ten built-in statuses, and the added status \"Second interview\"",
    data: "invented",
    rows: "`application_statuses`, `applications.status_key`",
    exercisedBy: issue(748),
    holds: (data) => {
      const referenced = data.applications.map((a) => a.statusKey ?? null);
      const added = data.applicationStatuses.filter((s) => !isBuiltInStatusKey(s.key)).map((s) => s.key);
      return (
        referenced.every((key) => key !== null && data.applicationStatuses.some((s) => s.key === key)) &&
        BUILT_IN_STATUS_KEYS.every((key) => referenced.includes(key)) &&
        added.some((key) => referenced.includes(key))
      );
    },
  },
  {
    area: "recruitment",
    case: "An interview with times offered and none booked, and one the applicant booked",
    data: "invented",
    rows: "`interview_slots` of applications 5 and 6",
    exercisedBy: `${issue(169)}, ${issue(186)}`,
    holds: (data) => {
      const interviews = data.applications.filter((a) => applicationStatusOf(data, a) === "interview");
      const booked = (a: Application) => data.interviewSlots.some((s) => s.applicationId === a.id && s.chosen);
      return interviews.some(booked) && interviews.some((a) => !booked(a));
    },
  },
  {
    area: "recruitment",
    case: "Accepted applications waiting for the signed NDA, and with the NDA arrived",
    data: "invented",
    rows: "`applications` 3 and 1",
    exercisedBy: issue(171),
    holds: (data) => {
      const accepted = data.applications.filter((a) => ["accepted_email_to_be_sent", "accepted_email_sent", "nda_received"].includes(applicationStatusOf(data, a)));
      return accepted.some((a) => a.ndaArrivedAt == null) && accepted.some((a) => a.ndaArrivedAt != null);
    },
  },
  {
    area: "recruitment",
    case: "The applicant plain seat holds applications to act on",
    data: "invented",
    rows: "`applications` 24 and 25",
    exercisedBy: `${issue(129)}, ${issue(169)}`,
    holds: (data) => {
      const theirs = data.applications.filter((a) => a.userId === PLAIN_SEAT_PEOPLE["non-member"]);
      return theirs.some((a) => applicationStatusOf(data, a) === "interview") && theirs.some((a) => applicationStatusOf(data, a) === "new");
    },
  },
  {
    area: "recruitment",
    case: "Every application's CV and motivation letter point at the one shared sample PDF",
    data: "invented",
    rows: "the one `application_files` row, named by every `applications.cv_file_id` and `cover_letter_file_id`",
    exercisedBy: issue(406),
    holds: (data) => {
      const [sample, ...others] = data.applicationFiles;
      if (sample === undefined || others.length > 0) return false;
      const isPdf = sample.mimeType === "application/pdf" && sample.pathname.startsWith("applications/");
      return isPdf && data.applications.every((a) => a.cvFileId === sample.id && a.coverLetterFileId === sample.id);
    },
  },
  {
    area: "partners",
    case: "Main and media partners on the public pages",
    data: "public",
    rows: "`partner_versions.tier`",
    exercisedBy: issue(256),
    holds: (data) => (["main", "media"] as const).every((tier) => publicItems(partnerItemsOf(data)).some((p) => p.tier === tier)),
  },
  {
    area: "partners",
    case: "A published partner with draft changes",
    data: "invented",
    rows: "`partner_versions` of partner 3 (EvoMisure)",
    exercisedBy: issue(256),
    holds: (data) => partnerItemsOf(data).some((item) => statusOf(item.version) === "draft-changes"),
  },
  {
    area: "partners",
    case: "A draft partner, never published, so the public pages do not show it",
    data: "invented",
    rows: "`partner_versions` of partner 14",
    exercisedBy: issue(256),
    holds: (data) => {
      const shown = publicItems(partnerItemsOf(data)).map((p) => p.name);
      return partnerItemsOf(data).some((item) => item.version.state === "draft" && !shown.includes(item.version.draft.name));
    },
  },
  {
    area: "partners",
    case: "A published partner with no website",
    data: "public",
    rows: "`partner_versions` of partner 10 (Magicar)",
    exercisedBy: issue(256),
    holds: (data) => publicItems(partnerItemsOf(data)).some((p) => p.website === undefined),
  },
  {
    area: "partners",
    case: "A published partner with a dark logo, drawn white",
    data: "public",
    rows: "`partner_versions.logo_dark`, partners 11 and 12",
    exercisedBy: issue(256),
    holds: (data) => publicItems(partnerItemsOf(data)).some((p) => p.logo.darkLogo),
  },
  {
    area: "faq",
    case: "Published questions on /apply",
    data: "public",
    rows: "`faq_versions` version `published`",
    exercisedBy: issue(258),
    holds: (data) => publicItems(faqItemsOf(data)).length >= 2,
  },
  {
    area: "faq",
    case: "A published question with a draft change that /apply does not show",
    data: "invented",
    rows: "`faq_versions` of question 3",
    exercisedBy: issue(258),
    holds: (data) =>
      faqItemsOf(data).some(
        (item) =>
          item.version.state === "published" &&
          item.version.draft !== null &&
          item.version.draft.answer.join("\n") !== item.version.published.answer.join("\n"),
      ),
  },
  {
    area: "outreach",
    case: "Every tag in the tag list on at least one published post, Award the one award tag",
    data: "public",
    rows: "`outreach_tags`, `outreach_post_tags.tag_name`",
    exercisedBy: `${issue(287)}, ${issue(290)}`,
    holds: (data) => {
      const tags = outreachTagsOf(data);
      const used = new Set(publicItems(outreachItemsOf(data)).flatMap((p) => p.tags));
      const award = tags.filter((t) => t.award).map((t) => t.name);
      return tags.length > 0 && tags.every((t) => used.has(t.name)) && award.length === 1 && award[0] === "Award";
    },
  },
  {
    area: "outreach",
    case: "Every channel type on a published post: Instagram, LinkedIn, YouTube, Facebook, X, TikTok and Other link",
    data: "invented",
    rows: "`outreach_post_versions.channels` of post 14",
    exercisedBy: `${issue(290)}, ${issue(278)}`,
    holds: (data) => {
      const posts = publicItems(outreachItemsOf(data));
      return CHANNEL_NAMES.every((name) => posts.some((p) => p.channels[name] !== undefined));
    },
  },
  {
    area: "outreach",
    case: "A post first shared by another account",
    data: "public",
    rows: "`outreach_post_versions.channels` `account`, posts 3, 5 and 14",
    exercisedBy: issue(290),
    holds: (data) => publicItems(outreachItemsOf(data)).some((p) => Object.values(p.channels).some((c) => c?.account !== undefined)),
  },
  {
    area: "outreach",
    case: "Published posts enough for the home Track record's featured card and three news cards",
    data: "public",
    rows: "`outreach_post_versions` version `published`",
    exercisedBy: `${issue(293)}, ${issue(289)}`,
    holds: (data) => trackRecord(publicItems(outreachItemsOf(data)))?.news.length === 3,
  },
  {
    area: "outreach",
    case: "Every photo with alt text, and a post with several photos for the photo grid",
    data: "invented",
    rows: "`outreach_post_versions.photos`, post 14",
    exercisedBy: issue(291),
    holds: (data) =>
      outreachVersionsOf(data).every((p) => p.photos.every((photo) => photo.alt.trim() !== "")) &&
      publicItems(outreachItemsOf(data)).some((p) => p.photos.length > 1),
  },
  {
    area: "outreach",
    case: "A published post with draft changes that the public pages do not show",
    data: "invented",
    rows: "`outreach_post_versions` of post 4 (IAC 2024, Milan)",
    exercisedBy: `${issue(287)}, ${issue(290)}`,
    holds: (data) =>
      outreachItemsOf(data).some(
        (item) => item.version.state === "published" && item.version.draft !== null && item.version.draft.lead !== item.version.published.lead,
      ),
  },
  {
    area: "outreach",
    case: "A new post saved as a draft before it is whole, never published, so the public pages do not show it",
    data: "invented",
    rows: "`outreach_post_versions` of post 15",
    exercisedBy: issue(292),
    holds: (data) => {
      const shown = new Set(publicItems(outreachItemsOf(data)).map((p) => p.title));
      return outreachItemsOf(data).some(
        (item) => item.version.state === "draft" && outreachPostOf(item.version.draft) === null && !shown.has(item.version.draft.title),
      );
    },
  },
  {
    area: "outreach",
    case: "The summit's story, a published post featured at the top of /outreach",
    data: "public",
    rows: "`outreach_posts.featured_slot` 1, post 14",
    exercisedBy: `${issue(392)}, ${issue(496)}`,
    holds: (data) => {
      const featured = outreachFeaturedOf(data);
      const items = outreachItemsOf(data);
      return featured.length === 1 && featured.every((id) => items.some((item) => item.id === id && item.version.state === "published"));
    },
  },
  {
    area: "projects",
    case: "Published projects on /projects, the home Projects cards and their pages, in site order",
    data: "invented",
    rows: "`project_versions` version `published`, projects 1–4",
    exercisedBy: `${issue(295)}, ${issue(299)}`,
    holds: (data) =>
      JSON.stringify(publicItems(projectItemsOf(data)).map((p) => p.slug)) === JSON.stringify(["cavour", "ves", "efesto", "galileo"]),
  },
  {
    area: "projects",
    case: "A published project with draft changes that its pages do not show",
    data: "invented",
    rows: "`project_versions` of project 2 (VES)",
    exercisedBy: `${issue(297)}, ${issue(298)}`,
    holds: (data) =>
      projectItemsOf(data).some(
        (item) =>
          item.version.state === "published" &&
          item.version.draft !== null &&
          item.version.draft.hero.intro.text !== item.version.published.hero.intro.text &&
          publicItems([item])[0] === item.version.published,
      ),
  },
  {
    area: "projects",
    case: "A published project with no rocket model of its own, so its card and its page draw the placeholder rocket",
    data: "invented",
    rows: "`project_versions` of project 4 (Galileo)",
    exercisedBy: `${issue(296)}, ${issue(301)}`,
    holds: (data) =>
      publicItems(projectItemsOf(data)).some((p) => {
        const rockets = rocketsOf(p);
        return rockets.card === "placeholder" && rockets.page === "placeholder";
      }),
  },
  {
    area: "hand-overs",
    case: "A division lead's hand-over waiting for the head of their department, on the department-head plain seat's Overview",
    data: "invented",
    rows: "`hand_over_requests` 2, member 195 to member 140",
    exercisedBy: issue(262),
    holds: (data) => {
      const waiting = waitingHandOversOf(data);
      const team = teamOf(data);
      const org = orgOf(data);
      const head = memberOfUser(data, PLAIN_SEAT_PEOPLE["department-head"]);
      return (
        waiting.length === 1 &&
        waiting.every((r) => !hasLapsed(r, team) && successorsFor(r.role, r.fromId, team, org).some((s) => s.id === r.toId)) &&
        handOverAttentionFor(head, waiting, team, org, new Date()).length === 1
      );
    },
  },
  {
    area: "hand-overs",
    case: "A confirmed hand-over: the lead became an advisor in the division and their access ended",
    data: "invented",
    rows: "`hand_over_requests` 1, member 43 to member 10",
    exercisedBy: `${issue(253)}, ${issue(262)}`,
    holds: (data) => data.handOvers.some((row) => row.outcome === "advisor" && confirmedAsWritten(data, row)),
  },
  {
    area: "aliases",
    case: "An open alias request the division-lead plain seat sent, which they may cancel and each approver may decline or mark created",
    data: "invented",
    rows: "`alias_requests` 1, member 195 for member 134",
    exercisedBy: `${issue(541)}, ${issue(550)}`,
    holds: (data) => {
      const lead = memberOfUser(data, PLAIN_SEAT_PEOPLE["division-lead"]);
      const drawer = drawerAliasOf(data, lead, OPEN_REQUEST.member);
      const approvers = aliasApproversOf(data);
      return (
        lead === OPEN_REQUEST.by &&
        drawer?.kind === "requested" &&
        drawer.cancellable &&
        drawer.line.startsWith("by you") &&
        approvers.length === 3 &&
        approvers.every((a) => aliasRowsOf(data, a).some((r) => r.kind === "prt-email-request" && "answerAlias" in r.action && r.action.answerAlias === OPEN_REQUEST.id))
      );
    },
  },
  {
    area: "aliases",
    case: "An open alias request the site made by itself when someone became a division lead",
    data: "invented",
    rows: "`alias_requests` 2, member 13, no requester",
    exercisedBy: `${issue(543)}, ${issue(550)}`,
    holds: (data) => {
      const request = openAliasRequestsOf(data).find((r) => r.id === AUTOMATIC_REQUEST.id);
      const [leader] = aliasApproversOf(data);
      const row = leader === undefined ? undefined : aliasRowsOf(data, leader).find((r) => r.kind === "prt-email-request" && "answerAlias" in r.action && r.action.answerAlias === AUTOMATIC_REQUEST.id);
      return (
        request?.requesterId === null &&
        teamOf(data).some((p) => p.id === AUTOMATIC_REQUEST.member && p.memberships.some((m) => m.role === "lead")) &&
        row !== undefined &&
        row.title.endsWith("needs an email alias") &&
        row.detail.startsWith("Automatic · became")
      );
    },
  },
  {
    area: "aliases",
    case: "An alias marked created on the member plain seat's record and not yet set up, with the notice to the division lead who asked for it",
    data: "invented",
    rows: "`alias_requests` 3, `members` 140 `prt_email`, `dashboard_notices` `alias-created`",
    exercisedBy: `${issue(542)}, ${issue(550)}`,
    holds: (data) => {
      const member = memberOfUser(data, PLAIN_SEAT_PEOPLE.member);
      const standing = standingOfUser(data, PLAIN_SEAT_PEOPLE.member);
      const row = data.members.find((m) => m.memberId === member);
      const own = standing === null || row === undefined ? null : ownAliasOf({ kind: standing.kind, alias: row.prtEmail ?? null, setUpAt: row.emailAliasSetUpAt ?? null });
      const drawer = drawerAliasOf(data, CREATED_ALIAS.by, CREATED_ALIAS.member);
      return (
        member === CREATED_ALIAS.member &&
        showsAliasCard(own) &&
        own.address === CREATED_ALIAS.address &&
        data.aliasRequests.some((r) => r.id === CREATED_ALIAS.id && r.memberId === member && r.outcome === "created") &&
        drawer?.kind === "set" &&
        !aliasNoticeRowsOf(data, member).some((r) => r.title.includes("email alias")) &&
        aliasNoticeRowsOf(data, CREATED_ALIAS.by).some((r) => r.title.endsWith("'s email alias is ready"))
      );
    },
  },
  {
    area: "aliases",
    case: "A declined alias request, with the notice to the division lead who sent it, who may ask again",
    data: "invented",
    rows: "`alias_requests` 4, member 195 for member 168, `dashboard_notices` `alias-declined`",
    exercisedBy: `${issue(541)}, ${issue(550)}`,
    holds: (data) => {
      const drawer = drawerAliasOf(data, DECLINED_REQUEST.by, DECLINED_REQUEST.member);
      return (
        data.aliasRequests.some((r) => r.id === DECLINED_REQUEST.id && r.outcome === "declined" && r.answeredBy === DECLINED_REQUEST.declinedBy) &&
        drawer?.kind === "none" &&
        drawer.requestable &&
        aliasNoticeRowsOf(data, DECLINED_REQUEST.by).some((r) => r.title.includes("declined the email alias for"))
      );
    },
  },
  {
    area: "aliases",
    case: "Two team addresses the member plain seat holds, one that moves with the Logistics lead and one tied to no role, so their side view shows the Team addresses row",
    data: "invented",
    rows: "`team_addresses`, member 140, `logistics@prt.example.com` (division 15) and `recruitment@prt.example.com`",
    exercisedBy: issue(786),
    holds: (data) => {
      const lines = drawerTeamAddressesOf(data, memberOfUser(data, PLAIN_SEAT_PEOPLE.member) ?? -1);
      return lines.length === 2 && lines[0].movesWith === "Logistics Lead" && lines[1].movesWith === null;
    },
  },
  {
    area: "aliases",
    case: "Of the member plain seat's two team addresses, the Logistics one is set up and the recruitment one is not, so their Overview shows one team address ready card",
    data: "invented",
    rows: "`team_addresses` `set_up_at`, member 140, `logistics@prt.example.com` set up, `recruitment@prt.example.com` not",
    exercisedBy: issue(578),
    holds: (data) => {
      const member = memberOfUser(data, PLAIN_SEAT_PEOPLE.member);
      const standing = standingOfUser(data, PLAIN_SEAT_PEOPLE.member);
      if (standing === null) return false;
      const held = data.teamAddresses
        .filter((r) => r.holderId === member)
        .map((r, id) => ({ id, address: r.address, setUpAt: r.setUpAt ?? null }));
      const cards = teamAddressCardsOf(ownTeamAddressesOf({ kind: standing.kind, held }));
      return held.length === 2 && cards.length === 1 && cards[0].address.startsWith("recruitment@");
    },
  },
  {
    area: "team-page",
    case: "The team leader's circle shows his own photo, which the published layer leaves alone",
    data: "public",
    rows: "`members` 1 `picture`, `team_page_layer_versions` published with no `leader.photo`",
    exercisedBy: issue(390),
    holds: (data) => {
      const { layer, shown } = teamPageOfSeed(data);
      const own = teamRecord.orgChart.leader.photo;
      return own !== undefined && layer.leader.photo === undefined && shown.leader?.photo === own;
    },
  },
  {
    area: "team-page",
    case: "A head's role text changed on the page",
    data: "invented",
    rows: "`team_page_layer_versions` published, `spots` `head:4:0`, member 6",
    exercisedBy: `${issue(283)}, ${issue(285)}`,
    holds: (data) => {
      const { build, layer, shown } = teamPageOfSeed(data);
      const role = layer.spots[RENAMED_HEAD_SPOT]?.role;
      const built = build.departments.flatMap((d) => d.heads).find((h) => h.spot === RENAMED_HEAD_SPOT);
      const drawn = shown.departments.flatMap((d) => d.heads).find((h) => h.at === RENAMED_HEAD_SPOT);
      return role !== undefined && built !== undefined && built.title !== role && drawn?.shown.role === role;
    },
  },
  {
    area: "team-page",
    case: "A leader added on the arc between the Project Manager and the Chief Engineer",
    data: "public",
    rows: "`team_page_layer_versions` published, `addedLeaders` 1, member 3",
    exercisedBy: `${issue(283)}, ${issue(285)}`,
    holds: (data) => {
      const { build, layer, shown } = teamPageOfSeed(data);
      const added = layer.addedLeaders.find((l) => l.person === ADDED_LEADER_PERSON);
      const at = shown.leaders.map((l) => l.at);
      const i = added === undefined ? -1 : at.indexOf(`added:${added.id}`);
      return (
        i > 0 &&
        at[i - 1] === ADDED_LEADER_AFTER &&
        at[i + 1] === "arc:chief-engineer:0" &&
        !build.arc.some((l) => l.person.id === ADDED_LEADER_PERSON)
      );
    },
  },
  {
    area: "team-page",
    case: "A division lead hidden from the page",
    data: "invented",
    rows: "`team_page_layer_versions` published, `spots` `lead:9:0`, member 17",
    exercisedBy: `${issue(283)}, ${issue(285)}`,
    holds: (data) => {
      const { build, shown } = teamPageOfSeed(data);
      return (
        build.departments.some((d) => d.leads.some((l) => l.spot === HIDDEN_LEAD_SPOT)) &&
        !shown.departments.some((d) => d.leads.some((l) => l.at === HIDDEN_LEAD_SPOT))
      );
    },
  },
  {
    area: "team-page",
    case: "The intro text and the group photo's caption changed, which Reset to team keeps",
    data: "invented",
    rows: "`team_page_layer_versions` published, `intro` and `groupPhoto`",
    exercisedBy: `${issue(283)}, ${issue(284)}`,
    holds: (data) => {
      const { build, layer, shown } = teamPageOfSeed(data);
      const reset = resetLayer(layer);
      const roleBuild = JSON.stringify(applyLayer(build, NO_TEAM_LAYER).leaders);
      return (
        shown.intro !== null &&
        shown.intro !== teamRecord.header.intro &&
        shown.groupPhoto !== null &&
        shown.groupPhoto.alt !== teamRecord.coreMembers.groupPhoto.alt &&
        reset.intro === layer.intro &&
        reset.groupPhoto === layer.groupPhoto &&
        JSON.stringify(applyLayer(build, reset).leaders) === roleBuild
      );
    },
  },
  {
    area: "team-page",
    case: "Principal advisors and several specialists, each published",
    data: "public",
    rows: "`team_page_advisors` 1–11",
    exercisedBy: `${issue(286)}`,
    holds: (data) => {
      const items = teamAdvisorItemsOf(data);
      const shown = publicAdvisors(items);
      return (
        items.length === data.teamPageAdvisors.length &&
        items.every((item) => item.version.state === "published" && item.version.draft === null) &&
        shown.filter((a) => a.standing === "principal").length >= 1 &&
        shown.filter((a) => a.standing === "specialist").length >= 2
      );
    },
  },
];

/** The case's row in docs/seed-cases.md. */
export function caseDocRow(c: SeedCase): string {
  return `| ${c.area} | ${c.case} | ${c.data} | ${c.rows} | ${c.exercisedBy} |`;
}
