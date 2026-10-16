// The cases the typed seed holds (issues #304, #305 and #308), each with the check that
// proves it from the seeded rows. docs/seed-cases.md lists the same cases; a
// test runs every check and fails when the page and this list differ.

import type { InferInsertModel } from "drizzle-orm";
import {
  applicationStatusEnum,
  orderStatusEnum,
  type alumniEntries,
  type applications,
  type applyPositions,
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
  type outreachSummitVersions,
  type outreachTags,
  type partners,
  type partnerVersions,
  type recruitmentSetting,
  type roles,
  type scopes,
  type users,
} from "@/db/schema";
import { academicYearOfDay, alumniOf, listed, type AlumniRecord, type Alumnus } from "@/lib/about/alumni-record";
import { publicItems, statusOf, versionedFromRows, type ContentItem, type VersionKind } from "@/lib/content/versioned";
import { APPLICATION_STAGES, type ApplicationStage } from "@/lib/dashboard/application-flow";
import { storedApplicationState } from "@/lib/dashboard/stored-application";
import type { FaqVersion } from "@/lib/faq/faq";
import { trackRecord } from "@/lib/outreach";
import type { SummitVersions } from "@/lib/outreach-editor";
import { draftFromColumns, outreachPostOf, postFromColumns, summitFromColumns } from "@/lib/outreach-rows";
import { CHANNEL_NAMES, type OutreachDraft, type OutreachTag, type PostItem, type PostVersions } from "@/lib/outreach-types";
import type { Partner } from "@/lib/partners";
import { partnerFromColumns } from "@/lib/partners-rows";
import { UNIT_TARGETS } from "@/lib/dashboard/division-access";
import type { TeamPerson } from "@/lib/dashboard/division-edit";
import { steppingDown } from "@/lib/dashboard/hand-over";
import { handOverAttentionFor, hasLapsed, successorsFor, type HandOverRequest, type RequestedRole } from "@/lib/dashboard/hand-over-request";
import { membershipsOfRoles, roleBeyondDivisions, type OrgChart, type RoleSeat } from "@/lib/dashboard/team";
import {
  kindOfTestViewer,
  seatOf,
  SEAT_OF_FLAG,
  TEST_VIEWERS,
  testDeveloperStanding,
  unitRowsOf,
  viewerStandingOf,
  type ScopeKind,
  type TestViewer,
  type ViewerStanding,
} from "@/lib/dashboard/viewer";
import { ALUMNI_ENTRY_ROWS } from "./alumni";
import { SCOPE_ROWS } from "./access";
import { FAQ_ROWS, FAQ_VERSION_ROWS } from "./faq";
import { HAND_OVER_ROWS } from "./hand-overs";
import { ORDER_ROWS } from "./orders";
import {
  OUTREACH_POST_ROWS,
  OUTREACH_POST_TAG_ROWS,
  OUTREACH_POST_VERSION_ROWS,
  OUTREACH_SUMMIT_ROWS,
  OUTREACH_TAG_ROWS,
} from "./outreach";
import { PARTNER_ROWS, PARTNER_VERSION_ROWS } from "./partners";
import { MEMBER_ROWS, ROLE_ROWS, TEST_VIEWER_PEOPLE, USER_ROWS } from "./people";
import { APPLICATION_ROWS, POSITION_ROWS, RECRUITMENT_SETTING_ROWS, SLOT_ROWS } from "./recruitment";
import { DEPARTMENT_ROWS, DIVISION_ROWS } from "./structure";

/** Every row the typed modules insert, by table. */
export type SeedData = {
  readonly departments: readonly InferInsertModel<typeof departments>[];
  readonly divisions: readonly InferInsertModel<typeof divisions>[];
  readonly members: readonly InferInsertModel<typeof members>[];
  readonly users: readonly InferInsertModel<typeof users>[];
  readonly roles: readonly InferInsertModel<typeof roles>[];
  readonly scopes: readonly InferInsertModel<typeof scopes>[];
  readonly alumniEntries: readonly InferInsertModel<typeof alumniEntries>[];
  readonly orders: readonly InferInsertModel<typeof orders>[];
  readonly positions: readonly InferInsertModel<typeof applyPositions>[];
  readonly applications: readonly InferInsertModel<typeof applications>[];
  readonly interviewSlots: readonly InferInsertModel<typeof interviewSlots>[];
  readonly recruitmentSetting: readonly InferInsertModel<typeof recruitmentSetting>[];
  readonly partners: readonly InferInsertModel<typeof partners>[];
  readonly partnerVersions: readonly InferInsertModel<typeof partnerVersions>[];
  readonly faqs: readonly InferInsertModel<typeof faqs>[];
  readonly faqVersions: readonly InferInsertModel<typeof faqVersions>[];
  readonly handOvers: readonly InferInsertModel<typeof handOverRequests>[];
  readonly outreachTags: readonly InferInsertModel<typeof outreachTags>[];
  readonly outreachPosts: readonly InferInsertModel<typeof outreachPosts>[];
  readonly outreachPostVersions: readonly InferInsertModel<typeof outreachPostVersions>[];
  readonly outreachPostTags: readonly InferInsertModel<typeof outreachPostTags>[];
  readonly outreachSummitVersions: readonly InferInsertModel<typeof outreachSummitVersions>[];
};

export const SEED_DATA: SeedData = {
  departments: DEPARTMENT_ROWS.rows,
  divisions: DIVISION_ROWS.rows,
  members: MEMBER_ROWS.rows,
  users: USER_ROWS.rows,
  roles: ROLE_ROWS.rows,
  scopes: SCOPE_ROWS.rows,
  alumniEntries: ALUMNI_ENTRY_ROWS.rows,
  orders: ORDER_ROWS.rows,
  positions: POSITION_ROWS.rows,
  applications: APPLICATION_ROWS.rows,
  interviewSlots: SLOT_ROWS.rows,
  recruitmentSetting: RECRUITMENT_SETTING_ROWS.rows,
  partners: PARTNER_ROWS.rows,
  partnerVersions: PARTNER_VERSION_ROWS.rows,
  faqs: FAQ_ROWS.rows,
  faqVersions: FAQ_VERSION_ROWS.rows,
  handOvers: HAND_OVER_ROWS.rows,
  outreachTags: OUTREACH_TAG_ROWS.rows,
  outreachPosts: OUTREACH_POST_ROWS.rows,
  outreachPostVersions: OUTREACH_POST_VERSION_ROWS.rows,
  outreachPostTags: OUTREACH_POST_TAG_ROWS.rows,
  outreachSummitVersions: OUTREACH_SUMMIT_ROWS.rows,
};

/** The academic year the Alumni page counts as current when the seed was written (2026–27). */
export const SEED_CURRENT_YEAR = 2026;

type Role = SeedData["roles"][number];

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
    .map((s) => ({ scope: s.scope as ScopeKind, target: s.target, divisionId: s.divisionId ?? null, deptId: s.deptId ?? null }));
  const activeRoles = data.roles
    .filter((r) => r.memberId === memberId && isActive(r))
    .map((r) => ({
      type: r.type ?? null,
      divisionId: r.divisionId ?? null,
      fullAccess: r.fullAccess == null ? null : SEAT_OF_FLAG[r.fullAccess],
    }));
  const onAlumniRecord = activeRoles.length === 0 && alumnusOf(data, memberId) !== undefined;
  return viewerStandingOf({ scopes: unitRowsOf(scopeRows, openDepartmentIds).map((s) => s.scope), activeRoles, onAlumniRecord });
}

/** Whether the seeded person reads as the test viewer: the same kind and the same full-access seat. */
export function resolvesTo(data: SeedData, viewer: TestViewer): boolean {
  const standing = standingOfUser(data, TEST_VIEWER_PEOPLE[viewer]);
  if (standing === null) return false;
  const expected = testDeveloperStanding(viewer);
  return standing.kind === kindOfTestViewer(viewer) && seatOf(standing) === seatOf(expected);
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
    entries: data.alumniEntries.flatMap((e) =>
      e.kind !== "member" || e.memberId == null
        ? []
        : [
            {
              id: e.id!,
              who: { kind: "member" as const, memberId: e.memberId, keptName: e.recordName ?? null },
              name: e.name ?? null,
              founder: e.founder == null ? null : e.founder === "founder" ? ("founder" as const) : ("co-founder" as const),
              photo: e.photo ?? null,
              shown: e.shown ?? true,
              removed: (e.removedAt ?? null) !== null,
              fixes: [],
            },
          ],
    ),
    imported: [],
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

/** Where a seeded application stands, as the dashboard reads it: withdrawn first, then ./stored-application.ts. */
export function stageOf(data: SeedData, application: Application): ApplicationStage {
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
  return storedApplicationState(
    {
      status: application.status ?? "received",
      applied_at: application.appliedAt!,
      accepted_at: application.acceptedAt ?? null,
      nda_arrived_at: application.ndaArrivedAt ?? null,
      joined_at: application.joinedAt ?? null,
    },
    slots,
  ).stage;
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

// Hand-overs (issue #308), read through the hand-over rules
// (lib/dashboard/hand-over-request.ts) the way the database source reads them.

/** The open org chart, as the team snapshot reads it (lib/dashboard/team-database.ts). */
export function orgOf(data: SeedData): OrgChart {
  return {
    departments: data.departments.filter((d) => (d.closedAt ?? null) === null).map((d) => ({ id: d.id!, name: d.name, code: d.code ?? null })),
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
      .map((r): RoleSeat => ({ type: r.type ?? null, divisionId: r.divisionId ?? null, since: r.startedAt!, departmentId: r.deptId ?? null, title: r.title }));
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
        .map((v) => ({ ...v, place: v.place ?? null, summaryPhone: v.summaryPhone ?? null }));
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

/** The summit's versions, or null when it has no published one, which the public read refuses. */
export function outreachSummitOf(data: SeedData): SummitVersions | null {
  const summit = versionedFromRows(data.outreachSummitVersions.map((row) => ({ kind: row.version, content: summitFromColumns({ ...row, storyPhone: row.storyPhone ?? null }) })));
  return summit?.state === "published" ? summit : null;
}

/** Every version of every post, published or draft. */
function outreachVersionsOf(data: SeedData): OutreachDraft[] {
  return outreachItemsOf(data).flatMap((item) =>
    item.version.state === "draft" ? [item.version.draft] : [item.version.published, ...(item.version.draft === null ? [] : [item.version.draft])],
  );
}

export type SeedArea = "structure" | "people" | "alumni" | "access" | "orders" | "recruitment" | "partners" | "faq" | "outreach" | "hand-overs";

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
  "hand-overs",
];

export type SeedCase = {
  readonly area: SeedArea;
  /** The situation in plain words. */
  readonly case: string;
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
    rows: "`divisions` code `HYB`",
    exercisedBy: `${issue(251)}, ${issue(257)}`,
    holds: (data) =>
      data.divisions.some(
        (d) => d.closedAt != null && activeIn(data, d.id!).length === 0 && data.roles.some((r) => r.divisionId === d.id),
      ),
  },
  {
    area: "structure",
    case: "An open division with nobody in it",
    rows: "`divisions` code `PLI`",
    exercisedBy: issue(251),
    holds: (data) => openDivisions(data).some((d) => !data.roles.some((r) => r.divisionId === d.id)),
  },
  {
    area: "people",
    case: "One team leader",
    rows: "`roles` type `president`, member 1",
    exercisedBy: `${issue(247)}, ${issue(252)}`,
    holds: (data) => data.roles.filter((r) => r.type === "president" && isActive(r)).length === 1,
  },
  {
    area: "people",
    case: "One operations lead and one IT lead, the two full-access seats",
    rows: "`roles.full_access`, members 903 and 11",
    exercisedBy: `${issue(238)}, ${issue(252)}`,
    holds: (data) =>
      (["operations_lead", "it_lead"] as const).every(
        (seat) => data.roles.filter((r) => r.fullAccess === seat && isActive(r)).length === 1,
      ),
  },
  {
    area: "people",
    case: "A head in every open department",
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
    rows: "`roles` type `core`",
    exercisedBy: issue(252),
    holds: (data) => data.roles.filter((r) => r.type === "core" && isActive(r)).length >= 10,
  },
  {
    area: "people",
    case: "A member in two divisions at once",
    rows: "`roles` of member 15",
    exercisedBy: `${issue(251)}, ${issue(252)}`,
    holds: (data) =>
      [...onTeam(data)].some(
        (m) => new Set(data.roles.filter((r) => r.memberId === m && isActive(r) && r.divisionId != null).map((r) => r.divisionId)).size >= 2,
      ),
  },
  {
    area: "people",
    case: "An advisor in a division, a former lead who stayed",
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
    case: "One seeded person per test viewer, read as that viewer",
    rows: "`TEST_VIEWER_PEOPLE` in `db/seed/people.ts`",
    exercisedBy: issue(247),
    holds: (data) => TEST_VIEWERS.every((viewer) => resolvesTo(data, viewer)),
  },
  {
    area: "alumni",
    case: "People who left in each year from 2021–22 to 2025–26",
    rows: "`roles.leaved_at`, members 40–51",
    exercisedBy: `${issue(257)}, ${issue(271)}`,
    holds: (data) => {
      const years = new Set(leftInYear(data).values());
      return [2021, 2022, 2023, 2024, 2025].every((y) => years.has(y));
    },
  },
  {
    area: "alumni",
    case: "A founder and a co-founder mark",
    rows: "`alumni_entries.founder`, members 41 and 42",
    exercisedBy: issue(257),
    holds: (data) => {
      const marks = alumniOfSeed(data).map((a) => a.founder);
      return marks.includes("founder") && marks.includes("co-founder");
    },
  },
  {
    area: "alumni",
    case: "A hidden alumnus",
    rows: "`alumni_entries` member 47, `shown` false",
    exercisedBy: issue(257),
    holds: (data) => alumniOfSeed(data).some((a) => !a.shown && !a.removed && !listed(a)),
  },
  {
    area: "alumni",
    case: "An alumnus whose account is deleted and anonymized, with the Alumni entry kept",
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
    rows: "`alumni_entries` member 49, `removed_at` set",
    exercisedBy: issue(257),
    holds: (data) => alumniOfSeed(data).some((a) => a.removed && !listed(a)),
  },
  {
    area: "alumni",
    case: "A name fixed for the Alumni page",
    rows: "`alumni_entries` member 50, `name` set",
    exercisedBy: issue(257),
    holds: (data) => alumniOfSeed(data).some((a) => listed(a) && a.name !== a.recordName),
  },
  {
    area: "alumni",
    case: "A former member read as the alumni test viewer: every role ended, an Alumni entry kept",
    rows: "`TEST_VIEWER_PEOPLE` alumni, member 50",
    exercisedBy: issue(317),
    holds: (data) => {
      const user = data.users.find((u) => u.id === TEST_VIEWER_PEOPLE.alumni);
      const memberId = user?.member ?? null;
      if (memberId === null) return false;
      const roles = data.roles.filter((r) => r.memberId === memberId);
      return roles.length > 0 && !roles.some(isActive) && entryOf(data, memberId) !== undefined && resolvesTo(data, "alumni");
    },
  },
  {
    area: "access",
    case: "Grants across the whole team",
    rows: "`scopes` scope `team`, members 7 and 9",
    exercisedBy: issue(247),
    holds: (data) => data.scopes.some((s) => s.scope === "team" && (UNIT_TARGETS as readonly string[]).includes(s.target)),
  },
  {
    area: "access",
    case: "Grants in one department",
    rows: "`scopes` scope `department`, members 14 and 30",
    exercisedBy: issue(247),
    holds: (data) => data.scopes.some((s) => s.scope === "department" && s.deptId != null),
  },
  {
    area: "access",
    case: "Grants in one division",
    rows: "`scopes` scope `division`, members 28 and 22",
    exercisedBy: issue(247),
    holds: (data) => data.scopes.some((s) => s.scope === "division" && s.divisionId != null),
  },
  {
    area: "access",
    case: "Grants at view and at edit",
    rows: "`scopes.access_level`",
    exercisedBy: issue(247),
    holds: (data) => (["view", "edit"] as const).every((level) => data.scopes.some((s) => (s.accessLevel ?? "view") === level)),
  },
  {
    area: "access",
    case: "A member who holds \"Approve orders\" and nothing else",
    rows: "`scopes` target `approve_orders`, member 24",
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
    case: "Alumni access, given across the whole team",
    rows: "`scopes` scope `website`, member 36",
    exercisedBy: `${issue(247)}, ${issue(257)}`,
    holds: (data) => data.scopes.some((s) => s.scope === "website"),
  },
  {
    area: "orders",
    case: "An order in every status: waiting, changes requested, rejected, approved, ordered and cancelled",
    rows: "`orders` 1–7",
    exercisedBy: `${issue(172)}, ${issue(247)}`,
    holds: (data) => orderStatusEnum.enumValues.every((status) => data.orders.some((o) => o.status === status)),
  },
  {
    area: "orders",
    case: "Orders made for divisions in different departments",
    rows: "`orders.division_id`",
    exercisedBy: `${issue(233)}, ${issue(247)}`,
    holds: (data) => orderDepartments(data).size >= 5,
  },
  {
    area: "orders",
    case: "An order approved by the member who holds \"Approve orders\" and nothing else",
    rows: "`orders` 5, `reviewed_by` member 24",
    exercisedBy: issue(270),
    holds: (data) =>
      data.orders.some(
        (o) => o.status === "accepted" && data.scopes.some((s) => s.memberId === o.reviewedBy && s.target === "approve_orders"),
      ),
  },
  {
    area: "recruitment",
    case: "Recruitment is on",
    rows: "`recruitment_setting.is_open`",
    exercisedBy: issue(119),
    holds: (data) => data.recruitmentSetting.length === 1 && data.recruitmentSetting[0].isOpen === true,
  },
  {
    area: "recruitment",
    case: "Open and closed positions",
    rows: "`apply_positions.status`; closed: 13, 18 and 23",
    exercisedBy: `${issue(119)}, ${issue(171)}`,
    holds: (data) => [true, false].every((open) => data.positions.some((p) => p.status === open && !p.isDeleted)),
  },
  {
    area: "recruitment",
    case: "An application in every stage: new, in review, interview, accepted, joined, rejected and withdrawn",
    rows: "`applications`, `interview_slots`",
    exercisedBy: `${issue(169)}, ${issue(171)}`,
    holds: (data) => APPLICATION_STAGES.every((stage) => data.applications.some((a) => stageOf(data, a) === stage)),
  },
  {
    area: "recruitment",
    case: "An application in every stored status, \"accepted by another team\" among them",
    rows: "`applications.status`",
    exercisedBy: issue(171),
    holds: (data) => applicationStatusEnum.enumValues.every((status) => data.applications.some((a) => a.status === status)),
  },
  {
    area: "recruitment",
    case: "An interview with times offered and none booked, and one the applicant booked",
    rows: "`interview_slots` of applications 5 and 6",
    exercisedBy: `${issue(169)}, ${issue(186)}`,
    holds: (data) => {
      const interviews = data.applications.filter((a) => stageOf(data, a) === "interview");
      const booked = (a: Application) => data.interviewSlots.some((s) => s.applicationId === a.id && s.chosen);
      return interviews.some(booked) && interviews.some((a) => !booked(a));
    },
  },
  {
    area: "recruitment",
    case: "Accepted applications waiting for the signed NDA, and with the NDA arrived",
    rows: "`applications` 3 and 1",
    exercisedBy: issue(171),
    holds: (data) => {
      const accepted = data.applications.filter((a) => stageOf(data, a) === "accepted");
      return accepted.some((a) => a.ndaArrivedAt == null) && accepted.some((a) => a.ndaArrivedAt != null);
    },
  },
  {
    area: "recruitment",
    case: "The local applicant tester holds applications to act on",
    rows: "`applications` 24 and 25",
    exercisedBy: `${issue(129)}, ${issue(169)}`,
    holds: (data) => {
      const theirs = data.applications.filter((a) => a.userId === TEST_VIEWER_PEOPLE["non-member"]);
      return theirs.some((a) => stageOf(data, a) === "interview") && theirs.some((a) => stageOf(data, a) === "new");
    },
  },
  {
    area: "partners",
    case: "Main and media partners on the public pages",
    rows: "`partner_versions.tier`",
    exercisedBy: issue(256),
    holds: (data) => (["main", "media"] as const).every((tier) => publicItems(partnerItemsOf(data)).some((p) => p.tier === tier)),
  },
  {
    area: "partners",
    case: "A published partner with draft changes",
    rows: "`partner_versions` of partner 3 (EvoMisure)",
    exercisedBy: issue(256),
    holds: (data) => partnerItemsOf(data).some((item) => statusOf(item.version) === "draft-changes"),
  },
  {
    area: "partners",
    case: "A draft partner, never published, so the public pages do not show it",
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
    rows: "`partner_versions` of partner 10 (Magicar)",
    exercisedBy: issue(256),
    holds: (data) => publicItems(partnerItemsOf(data)).some((p) => p.website === undefined),
  },
  {
    area: "partners",
    case: "A published partner with a dark logo, drawn white",
    rows: "`partner_versions.logo_dark`, partners 11 and 12",
    exercisedBy: issue(256),
    holds: (data) => publicItems(partnerItemsOf(data)).some((p) => p.logo.darkLogo),
  },
  {
    area: "faq",
    case: "Published questions on /apply",
    rows: "`faq_versions` version `published`",
    exercisedBy: issue(258),
    holds: (data) => publicItems(faqItemsOf(data)).length >= 2,
  },
  {
    area: "faq",
    case: "A published question with a draft change that /apply does not show",
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
    rows: "`outreach_post_versions.channels` `account`, posts 3, 5 and 14",
    exercisedBy: issue(290),
    holds: (data) => publicItems(outreachItemsOf(data)).some((p) => Object.values(p.channels).some((c) => c?.account !== undefined)),
  },
  {
    area: "outreach",
    case: "Published posts enough for the home Track record's featured card and three news cards",
    rows: "`outreach_post_versions` version `published`",
    exercisedBy: `${issue(293)}, ${issue(289)}`,
    holds: (data) => trackRecord(publicItems(outreachItemsOf(data)))?.news.length === 3,
  },
  {
    area: "outreach",
    case: "Every photo with alt text, and a post with several photos for the photo grid",
    rows: "`outreach_post_versions.photos`, post 14",
    exercisedBy: issue(291),
    holds: (data) =>
      outreachVersionsOf(data).every((p) => p.photos.every((photo) => photo.alt.trim() !== "")) &&
      publicItems(outreachItemsOf(data)).some((p) => p.photos.length > 1),
  },
  {
    area: "outreach",
    case: "A published post with draft changes that the public pages do not show",
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
    case: "The featured summit, published, with its editions",
    rows: "`outreach_summit_versions` version `published`",
    exercisedBy: `${issue(287)}, ${issue(289)}`,
    holds: (data) => (outreachSummitOf(data)?.published.editions.length ?? 0) >= 1,
  },
  {
    area: "hand-overs",
    case: "A division lead's hand-over waiting for the head of their department, on the department-head test viewer's Overview",
    rows: "`hand_over_requests` 2, member 20 to member 29",
    exercisedBy: issue(262),
    holds: (data) => {
      const waiting = waitingHandOversOf(data);
      const team = teamOf(data);
      const org = orgOf(data);
      const head = memberOfUser(data, TEST_VIEWER_PEOPLE["department-head"]);
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
    rows: "`hand_over_requests` 1, member 43 to member 16",
    exercisedBy: `${issue(253)}, ${issue(262)}`,
    holds: (data) => data.handOvers.some((row) => row.outcome === "advisor" && confirmedAsWritten(data, row)),
  },
];

/** The case's row in docs/seed-cases.md. */
export function caseDocRow(c: SeedCase): string {
  return `| ${c.area} | ${c.case} | ${c.rows} | ${c.exercisedBy} |`;
}
