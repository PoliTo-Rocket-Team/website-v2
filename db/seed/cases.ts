// The cases the typed seed holds (issue #304), each with the check that
// proves it from the seeded rows. docs/seed-cases.md lists the same cases; a
// test runs every check and fails when the page and this list differ.

import type { InferInsertModel } from "drizzle-orm";
import type { alumniEntries, departments, divisions, members, roles, scopes, users } from "@/db/schema";
import { academicYearOfDay, alumniOf, listed, type AlumniRecord, type Alumnus } from "@/lib/about/alumni-record";
import { UNIT_TARGETS } from "@/lib/dashboard/division-access";
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
import { MEMBER_ROWS, ROLE_ROWS, TEST_VIEWER_PEOPLE, USER_ROWS } from "./people";
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
};

export const SEED_DATA: SeedData = {
  departments: DEPARTMENT_ROWS.rows,
  divisions: DIVISION_ROWS.rows,
  members: MEMBER_ROWS.rows,
  users: USER_ROWS.rows,
  roles: ROLE_ROWS.rows,
  scopes: SCOPE_ROWS.rows,
  alumniEntries: ALUMNI_ENTRY_ROWS.rows,
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

export type SeedArea = "structure" | "people" | "alumni" | "access";

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
];

/** The case's row in docs/seed-cases.md. */
export function caseDocRow(c: SeedCase): string {
  return `| ${c.area} | ${c.case} | ${c.rows} | ${c.exercisedBy} |`;
}
