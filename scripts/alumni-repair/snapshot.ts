import { asc } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { departments, divisions, members, projectVersions, roles, users } from "@/db/schema";
import type * as schema from "@/db/schema";
import { rowRecordOf } from "@/lib/project-content/row";
import { unitKey, type Units } from "./units";

// What the repair reads from the database before it plans (issue #913): the
// units, the accounts and member addresses a Quitters row's emails find a
// member by, every role (to skip a year a person already has a role in, and to
// find the lineage's roles), and the projects' names (a Division value that
// names a project is no unit). Only selects.

export type RepairDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ExistingRole = {
  readonly id: number;
  readonly memberId: number | null;
  readonly deptId: number | null;
  readonly divisionId: number | null;
  readonly startedAt: string;
  readonly leavedAt: string | null;
};

export type Snapshot = {
  readonly units: Units;
  /** The member each address belongs to, in lower case: an account's email, or a member's PRT address. */
  readonly memberEmails: readonly { readonly email: string; readonly memberId: number }[];
  readonly roles: readonly ExistingRole[];
  /** The unit keys of every project's name, in any version. */
  readonly projects: ReadonlySet<string>;
};

export async function readSnapshot(db: RepairDb): Promise<Snapshot> {
  const departmentRows = await db.select({ id: departments.id, name: departments.name, code: departments.code }).from(departments).orderBy(asc(departments.id));
  const divisionRows = await db
    .select({ id: divisions.id, name: divisions.name, code: divisions.code, deptId: divisions.deptId })
    .from(divisions)
    .orderBy(asc(divisions.id));
  const userRows = await db.select({ email: users.email, member: users.member }).from(users);
  const memberRows = await db.select({ memberId: members.memberId, prtEmail: members.prtEmail }).from(members);
  const roleRows = await db
    .select({ id: roles.id, memberId: roles.memberId, deptId: roles.deptId, divisionId: roles.divisionId, startedAt: roles.startedAt, leavedAt: roles.leavedAt })
    .from(roles)
    .orderBy(asc(roles.id));
  const projectRows = await db.select({ page: projectVersions.page }).from(projectVersions);
  const lower = (e: string) => e.trim().toLowerCase();
  return {
    units: { departments: departmentRows, divisions: divisionRows },
    memberEmails: [
      ...userRows.flatMap((u) => (u.member === null ? [] : [{ email: lower(u.email), memberId: u.member }])),
      ...memberRows.flatMap((m) => (m.prtEmail === null || m.prtEmail.trim() === "" ? [] : [{ email: lower(m.prtEmail), memberId: m.memberId }])),
    ],
    roles: roleRows,
    projects: new Set(
      projectRows.flatMap((r) => {
        const name = rowRecordOf(r)?.name;
        return typeof name === "string" && unitKey(name) !== "" ? [unitKey(name)] : [];
      }),
    ),
  };
}
