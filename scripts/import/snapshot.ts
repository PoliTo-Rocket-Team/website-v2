import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  alumniEntries,
  alumniImportedRoles,
  applyPositions,
  departments,
  divisions,
  faqs,
  faqVersions,
  orders,
  roles,
  teamLeaves,
  teamPageAdvisors,
  teamPageAdvisorVersions,
  users,
} from "@/db/schema";
import type * as schema from "@/db/schema";
import type { FullAccessSeat, PositionType } from "./titles";
import type { Units } from "./units";

// What the database holds that the import reads before it plans (issue
// #677): the units roles resolve against, the accounts and roles already
// there (so a second run finds everything present and a seat clash with a row
// already in the database is caught), the imported Alumni entries from
// migration 0021, and the content rows the CSVs might duplicate. Only selects.

export type ImportDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ExistingRole = {
  readonly memberId: number;
  readonly deptId: number | null;
  readonly divisionId: number | null;
  readonly title: string;
  readonly type: PositionType | null;
  readonly fullAccess: FullAccessSeat | null;
  readonly startedAt: string;
  readonly leavedAt: string | null;
};

export type Snapshot = {
  /** Null when no database was given (a dry run on the files alone): units and existing rows are not checked. */
  readonly units: Units | null;
  /** Every account, by email in lower case. */
  readonly users: readonly { readonly id: string; readonly email: string; readonly member: number | null }[];
  readonly roles: readonly ExistingRole[];
  /** Members with a `team_leaves` row. */
  readonly leftMembers: ReadonlySet<number>;
  /** The `imported` Alumni entries (migration 0021): the name each gives and the academic years its lines list. */
  readonly importedAlumni: readonly { readonly name: string; readonly years: readonly number[] }[];
  /** Every advisor version's name. */
  readonly advisorNames: readonly string[];
  /** How many published advisors each standing has, and the highest site order. */
  readonly advisorPlaces: Readonly<Record<"principal" | "specialist", number>>;
  readonly advisorOrder: number;
  readonly faqQuestions: readonly string[];
  readonly faqOrder: number;
  readonly positions: readonly { readonly title: string | null; readonly divisionId: number | null }[];
  readonly orders: readonly { readonly requester: number | null; readonly name: string | null; readonly createdAt: string }[];
};

/** The snapshot of a database that holds nothing: a dry run given no database plans against it. */
export const NO_DATABASE: Snapshot = {
  units: null,
  users: [],
  roles: [],
  leftMembers: new Set(),
  importedAlumni: [],
  advisorNames: [],
  advisorPlaces: { principal: 0, specialist: 0 },
  advisorOrder: 0,
  faqQuestions: [],
  faqOrder: 0,
  positions: [],
  orders: [],
};

export async function readSnapshot(db: ImportDb): Promise<Snapshot> {
  const departmentRows = await db.select({ id: departments.id, name: departments.name, code: departments.code }).from(departments).orderBy(asc(departments.id));
  const divisionRows = await db
    .select({ id: divisions.id, name: divisions.name, code: divisions.code, deptId: divisions.deptId })
    .from(divisions)
    .orderBy(asc(divisions.id));
  const userRows = await db.select({ id: users.id, email: users.email, member: users.member }).from(users);
  const roleRows = await db
    .select({
      memberId: roles.memberId,
      deptId: roles.deptId,
      divisionId: roles.divisionId,
      title: roles.title,
      type: roles.type,
      fullAccess: roles.fullAccess,
      startedAt: roles.startedAt,
      leavedAt: roles.leavedAt,
    })
    .from(roles);
  const leaveRows = await db.select({ memberId: teamLeaves.memberId }).from(teamLeaves);
  const importedRows = await db
    .select({ id: alumniEntries.id, name: alumniEntries.recordName, year: alumniImportedRoles.year })
    .from(alumniEntries)
    .leftJoin(alumniImportedRoles, eq(alumniImportedRoles.entryId, alumniEntries.id))
    .where(eq(alumniEntries.kind, "imported"));
  const advisorRows = await db
    .select({ version: teamPageAdvisorVersions.version, advisor: teamPageAdvisorVersions.advisor, order: teamPageAdvisors.siteOrder })
    .from(teamPageAdvisors)
    .leftJoin(teamPageAdvisorVersions, eq(teamPageAdvisorVersions.advisorId, teamPageAdvisors.id));
  const faqRows = await db.select({ question: faqVersions.question, order: faqs.siteOrder }).from(faqs).leftJoin(faqVersions, eq(faqVersions.faqId, faqs.id));
  const positionRows = await db.select({ title: applyPositions.title, divisionId: applyPositions.divisionId }).from(applyPositions);
  const orderRows = await db.select({ requester: orders.requester, name: orders.name, createdAt: orders.createdAt }).from(orders);

  const imported = new Map<number, { name: string; years: number[] }>();
  for (const r of importedRows) {
    if (r.name === null) continue;
    const entry = imported.get(r.id) ?? { name: r.name, years: [] };
    if (r.year !== null) entry.years.push(r.year);
    imported.set(r.id, entry);
  }
  const advisor = (value: unknown) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});
  const published = advisorRows.filter((r) => r.version === "published").map((r) => advisor(r.advisor));
  const placesOf = (standing: string) => Math.max(0, ...published.filter((a) => a.standing === standing).map((a) => Number(a.place) || 0));

  return {
    units: { departments: departmentRows, divisions: divisionRows },
    users: userRows.map((u) => ({ ...u, email: u.email.trim().toLowerCase() })),
    roles: roleRows.flatMap((r) => (r.memberId === null ? [] : [{ ...r, memberId: r.memberId }])),
    leftMembers: new Set(leaveRows.map((r) => r.memberId)),
    importedAlumni: [...imported.values()],
    advisorNames: advisorRows.flatMap((r) => {
      const name = advisor(r.advisor).name;
      return typeof name === "string" ? [name] : [];
    }),
    advisorPlaces: { principal: placesOf("principal"), specialist: placesOf("specialist") },
    advisorOrder: Math.max(0, ...advisorRows.map((r) => r.order)),
    faqQuestions: faqRows.flatMap((r) => (r.question === null ? [] : [r.question])),
    faqOrder: Math.max(0, ...faqRows.map((r) => r.order)),
    positions: positionRows,
    orders: orderRows,
  };
}
