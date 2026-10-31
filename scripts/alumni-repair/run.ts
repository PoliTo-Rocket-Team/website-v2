import { planRepair, type Plan } from "./plan";
import { renderReport } from "./report";
import type { Roster } from "./roster";
import { readSnapshot, type RepairDb } from "./snapshot";
import { writePlan, type Written } from "./write";

// One run of the alumni repair (issue #913), whatever opened the database: the
// CLI (./cli.ts) on the connection the owner gives, the tests on the in-memory
// PGlite. A dry run reads the roster and the database and writes nothing. A
// real run reads, plans and writes in one transaction, so a failure leaves the
// database as it was.

export type RunOptions = {
  readonly mode: "dry-run" | "repair";
  /** The roster workbook's file name, and what it holds. */
  readonly file: string;
  readonly roster: Roster;
  readonly db: RepairDb;
};

export type RunResult = { readonly plan: Plan; readonly written?: Written; readonly report: string };

export async function runRepair({ mode, file, roster, db }: RunOptions): Promise<RunResult> {
  if (mode === "dry-run") {
    const plan = planRepair(roster, await readSnapshot(db));
    return { plan, report: renderReport({ mode, file, roster, plan }) };
  }
  const { plan, written } = await db.transaction(async (tx) => {
    const plan = planRepair(roster, await readSnapshot(tx as unknown as RepairDb));
    return { plan, written: await writePlan(tx, plan) };
  });
  return { plan, written, report: renderReport({ mode, file, roster, plan, written }) };
}
