import { afterWrite } from "./failure";
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
//
// Everything a real run does after its transaction commits runs here, as one
// of its finishing steps: rendering the report, then the caller's own steps
// (printing it, writing the report file, closing the connection). Each runs
// under `afterWrite`, so whichever of them fails, the failure says the repair
// was written. The caller does nothing after the run but return.

export type RunOptions = {
  readonly mode: "dry-run" | "repair";
  /** The roster workbook's file name, and what it holds. */
  readonly file: string;
  readonly roster: Roster;
  readonly db: RepairDb;
};

export type RunResult = { readonly plan: Plan; readonly written?: Written; readonly report: string };

/** A step the caller runs once the run has its report: named, so a failure after a real run's commit says which step failed. */
export type FinishStep = { readonly name: string; readonly act: (result: RunResult) => unknown };

export async function runRepair({ mode, file, roster, db }: RunOptions, finish: readonly FinishStep[] = []): Promise<RunResult> {
  if (mode === "dry-run") {
    const plan = planRepair(roster, await readSnapshot(db));
    const result = { plan, report: renderReport({ mode, file, roster, plan }) };
    for (const step of finish) await step.act(result);
    return result;
  }
  const { plan, written } = await db.transaction(async (tx) => {
    const plan = planRepair(roster, await readSnapshot(tx as unknown as RepairDb));
    return { plan, written: await writePlan(tx, plan) };
  });
  // The transaction has committed: from here on, every failure says the repair was written.
  const report = await afterWrite("rendering the report", () => renderReport({ mode, file, roster, plan, written }));
  const result = { plan, written, report };
  for (const step of finish) await afterWrite(step.name, () => step.act(result));
  return result;
}
