import { and, eq, isNull } from "drizzle-orm";
import { members } from "@/db/schema";
import type { Plan } from "./plan";
import type { BackfillDb } from "./snapshot";

// Writes a plan (issue #948) in the caller's transaction: one update of
// `members.joined_team_on` per member, and only while that member still has no
// join day. A member whose day was stored since the plan read it fails the
// run, so the transaction writes nothing. No other column, no insert, no
// delete.

export type Written = { readonly members: number };

type Tx = Parameters<Parameters<BackfillDb["transaction"]>[0]>[0];

export async function writePlan(tx: Tx, plan: Plan): Promise<Written> {
  let written = 0;
  for (const set of plan.sets) {
    const rows = await tx
      .update(members)
      .set({ joinedTeamOn: set.day })
      .where(and(eq(members.memberId, set.memberId), isNull(members.joinedTeamOn)))
      .returning({ memberId: members.memberId });
    if (rows.length !== 1) throw new Error("a member the plan dates no longer exists, or got a join day after the plan read it");
    written++;
  }
  return { members: written };
}
