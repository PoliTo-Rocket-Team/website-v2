import { and, eq, isNull, type SQL } from "drizzle-orm";
import { divisions, roles } from "@/db/schema";
import type { DivisionRef } from "./lineage";
import type { Plan } from "./plan";
import type { RepairDb } from "./snapshot";

// Writes a plan (issue #913) in the caller's transaction: the closed divisions
// first, so a role can name them; then Part 1's roles, inserted; then Part 2's
// moves, each an update of one role's `dept_id` and `division_id` only, and
// only while the role still sits where the plan read it. A role that moved
// since fails the run, so the transaction writes nothing. Never a delete.

export type Written = { readonly divisions: number; readonly roles: number; readonly moves: number };

type Tx = Parameters<Parameters<RepairDb["transaction"]>[0]>[0];

const is = <T>(column: Parameters<typeof eq>[0], value: T | null): SQL => (value === null ? isNull(column) : eq(column, value));

export async function writePlan(tx: Tx, plan: Plan): Promise<Written> {
  const created: number[] = [];
  for (const d of plan.divisions) {
    const [row] = await tx.insert(divisions).values(d).returning({ id: divisions.id });
    created.push(row.id);
  }
  const divisionId = (ref: DivisionRef | null): number | null => {
    if (ref === null) return null;
    if (ref.kind === "existing") return ref.id;
    const id = created[ref.index];
    if (id === undefined) throw new Error("a planned role names a division the plan does not create");
    return id;
  };

  let inserted = 0;
  if (plan.roles.length > 0) {
    const rows = await tx
      .insert(roles)
      .values(
        plan.roles.map((r) => ({
          memberId: r.memberId,
          deptId: r.deptId,
          divisionId: divisionId(r.division),
          title: r.title,
          type: r.type,
          fullAccess: null,
          startedAt: r.startedAt,
          leavedAt: r.leavedAt,
        })),
      )
      .returning({ id: roles.id });
    inserted = rows.length;
  }

  let moved = 0;
  for (const m of plan.moves) {
    const rows = await tx
      .update(roles)
      .set({ deptId: m.deptId, divisionId: divisionId(m.division) })
      .where(and(eq(roles.id, m.roleId), is(roles.deptId, m.from.deptId), is(roles.divisionId, m.from.divisionId)))
      .returning({ id: roles.id });
    if (rows.length !== 1) throw new Error("a role the plan moves no longer sits where the plan read it");
    moved++;
  }
  return { divisions: created.length, roles: inserted, moves: moved };
}
