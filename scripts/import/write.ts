import { randomUUID } from "node:crypto";
import {
  applyPositions,
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
import type { Plan, PersonRef, Table } from "./plan";
import type { ImportDb } from "./snapshot";

// Writes a plan (issue #677): inserts only, never an update or a delete, in the
// caller's transaction. A new person is a `members` row and a `users` row keyed
// `imported:<uuid>` that holds their sign-in email: the `sync_auth_users`
// trigger (drizzle/0001) finds a users row by id or by email when a Better
// Auth account is created, and gives the row the account's id, so their first
// Google sign-in with that email lands on this row and its member.

/** The prefix of an imported person's `users.id` until their first sign-in replaces it. */
export const IMPORTED_USER_PREFIX = "imported:";

export type Written = Readonly<Record<Table, number>>;

type Tx = Parameters<Parameters<ImportDb["transaction"]>[0]>[0];

export async function writePlan(tx: Tx, plan: Plan): Promise<Written> {
  const written = { users: 0, members: 0, roles: 0, team_leaves: 0, team_page_advisors: 0, team_page_advisor_versions: 0, apply_positions: 0, faqs: 0, faq_versions: 0, orders: 0 };
  const memberOf = new Map<number, number>();
  for (const person of plan.people) {
    const [member] = await tx.insert(members).values(person.member).returning({ id: members.memberId });
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
      .values(plan.roles.map(({ who, ...role }) => ({ ...role, memberId: idOf(who) })))
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
    const [row] = await tx.insert(teamPageAdvisors).values({ siteOrder: a.siteOrder }).returning({ id: teamPageAdvisors.id });
    await tx.insert(teamPageAdvisorVersions).values({ advisorId: row.id, version: "published", advisor: a.advisor });
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
      .values(plan.orders.map(({ requester, ...o }) => ({ ...o, requester: idOf(requester) })))
      .returning({ id: orders.id });
    written.orders = rows.length;
  }
  return written;
}
