import { randomUUID } from "node:crypto";
import {
  applyPositions,
  departments,
  divisions,
  faqs,
  faqVersions,
  members,
  orders,
  roles,
  teamLeaves,
  teamPageAdvisors,
  teamPageAdvisorVersions,
  users,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Plan, PersonRef, Table } from "./plan";
import type { PhotoUploads } from "./photos";
import type { ImportDb } from "./snapshot";
import type { UnitRef } from "./unit-book";

// Writes a plan (issues #677, #816): inserts only, never an update or a
// delete, in the caller's transaction. The closed past units go in first, so a
// role or an order can name them. A new person is a `members` row and a `users` row keyed
// `imported:<uuid>` that holds their sign-in email: the `sync_auth_users`
// trigger (drizzle/0001) finds a users row by id or by email when a Better
// Auth account is created, and gives the row the account's id, so their first
// Google sign-in with that email lands on this row and its member. A photo
// file uploaded here and then left by a run that fails afterwards stays in the
// store unlinked; it costs storage only, and the rolled-back run wrote no row.

/** The prefix of an imported person's `users.id` until their first sign-in replaces it. */
export const IMPORTED_USER_PREFIX = "imported:";

export type Written = Readonly<Record<Table, number>>;

/** The photos an import uploaded, and those it did not because the run gave no storage credential. */
export type Uploaded = { readonly members: number; readonly advisors: number; readonly skipped: number };

type Tx = Parameters<Parameters<ImportDb["transaction"]>[0]>[0];

/** The next `members.member_id`, taken from its sequence before the row is written, so the photo's pathname can name it and the row is inserted with its picture. */
async function reserveMemberId(tx: Tx): Promise<number> {
  const result: unknown = await tx.execute(sql`select nextval(pg_get_serial_sequence('members', 'member_id'))::int as id`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { id: number }[];
  return Number(rows[0].id);
}

/**
 * Writes the plan. With `uploads`, each photo the plan links is uploaded as
 * its row is inserted: a member's URL goes into the new `members` row's
 * `picture`, an advisor's into the new version's `photo`. No row is written
 * twice, so nothing is ever updated. Without `uploads` no photo is uploaded,
 * and the rows go in without one.
 */
export async function writePlan(tx: Tx, plan: Plan, uploads: PhotoUploads | null): Promise<{ written: Written; uploaded: Uploaded }> {
  const written = {
    departments: 0,
    divisions: 0,
    users: 0,
    members: 0,
    roles: 0,
    team_leaves: 0,
    team_page_advisors: 0,
    team_page_advisor_versions: 0,
    apply_positions: 0,
    faqs: 0,
    faq_versions: 0,
    orders: 0,
  };
  const uploaded = { members: 0, advisors: 0, skipped: 0 };

  const departmentIds: number[] = [];
  // A unit's roster spellings are for the report only: no column holds them.
  for (const { spellings: _, ...d } of plan.departments) {
    const [row] = await tx.insert(departments).values(d).returning({ id: departments.id });
    departmentIds.push(row.id);
    written.departments++;
  }
  const idIn = (ids: readonly number[]) => (ref: UnitRef | null): number | null => {
    if (ref === null) return null;
    if (ref.kind === "existing") return ref.id;
    const id = ids[ref.index];
    if (id === undefined) throw new Error("a planned row names a unit the plan does not create");
    return id;
  };
  const departmentId = idIn(departmentIds);
  const divisionIds: number[] = [];
  for (const { dept, spellings: _, ...d } of plan.divisions) {
    const [row] = await tx
      .insert(divisions)
      .values({ ...d, deptId: departmentId(dept) })
      .returning({ id: divisions.id });
    divisionIds.push(row.id);
    written.divisions++;
  }
  const divisionId = idIn(divisionIds);

  const memberOf = new Map<number, number>();
  for (const person of plan.people) {
    let values: typeof members.$inferInsert = person.member;
    if (person.photo !== null && uploads === null) uploaded.skipped++;
    if (person.photo !== null && uploads !== null) {
      const memberId = await reserveMemberId(tx);
      values = { ...person.member, memberId, picture: await uploads.member(memberId, person.photo) };
      uploaded.members++;
    }
    const [member] = await tx.insert(members).values(values).returning({ id: members.memberId });
    await tx.insert(users).values({ id: `${IMPORTED_USER_PREFIX}${randomUUID()}`, ...person.user, member: member.id });
    memberOf.set(person.person, member.id);
    written.members++;
    written.users++;
  }
  const idOf = (ref: PersonRef): number => {
    if (ref.kind === "existing") return ref.memberId;
    const id = memberOf.get(ref.person);
    if (id === undefined) throw new Error("a planned row names a person the plan does not insert");
    return id;
  };

  if (plan.roles.length > 0) {
    const rows = await tx
      .insert(roles)
      .values(plan.roles.map(({ who, dept, division, ...role }) => ({ ...role, deptId: departmentId(dept), divisionId: divisionId(division), memberId: idOf(who) })))
      .returning({ id: roles.id });
    written.roles = rows.length;
  }
  if (plan.leaves.length > 0) {
    const rows = await tx
      .insert(teamLeaves)
      .values(plan.leaves.map((l) => ({ memberId: idOf(l.who), leftAt: l.leftAt, reason: null })))
      .returning({ id: teamLeaves.id });
    written.team_leaves = rows.length;
  }
  for (const a of plan.advisors) {
    let advisor = a.advisor;
    if (a.photo !== null && uploads === null) uploaded.skipped++;
    if (a.photo !== null && uploads !== null) {
      advisor = { ...advisor, photo: await uploads.advisor(a.photo) };
      uploaded.advisors++;
    }
    const [row] = await tx.insert(teamPageAdvisors).values({ siteOrder: a.siteOrder }).returning({ id: teamPageAdvisors.id });
    await tx.insert(teamPageAdvisorVersions).values({ advisorId: row.id, version: "published", advisor });
    written.team_page_advisors++;
    written.team_page_advisor_versions++;
  }
  if (plan.positions.length > 0) {
    const rows = await tx
      .insert(applyPositions)
      .values(plan.positions.map((p) => ({ ...p, requiredSkills: [...p.requiredSkills], desirableSkills: [...p.desirableSkills] })))
      .returning({ id: applyPositions.id });
    written.apply_positions = rows.length;
  }
  for (const f of plan.faqs) {
    const [row] = await tx.insert(faqs).values({ siteOrder: f.siteOrder }).returning({ id: faqs.id });
    await tx.insert(faqVersions).values({ faqId: row.id, version: "published", question: f.question, answer: [...f.answer] });
    written.faqs++;
    written.faq_versions++;
  }
  if (plan.orders.length > 0) {
    const rows = await tx
      .insert(orders)
      .values(plan.orders.map(({ requester, division, ...o }) => ({ ...o, divisionId: divisionId(division), requester: idOf(requester) })))
      .returning({ id: orders.id });
    written.orders = rows.length;
  }
  return { written, uploaded };
}
