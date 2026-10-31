import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { afterWrite, failureReport } from "./failure";
import { readRoster } from "./roster";
import { runRepair, type RunResult } from "./run";
import type { RepairDb } from "./snapshot";

// `pnpm db:alumni-repair <source-dir> [--mode dry-run|repair] [--report <file>]
// [--database-url <url>]` (issue #913; README.md beside this file). The
// connection comes only from this run: the flag, or REPAIR_DATABASE_URL set
// for this one command. The tool loads no .env file and reads no DATABASE_URL,
// so it never reaches a database by accident.

const USAGE = `Usage: pnpm db:alumni-repair <source-dir> [--mode dry-run|repair] [--report <file>] [--database-url <url>]

  <source-dir>      The directory holding the roster workbook (exactly one .xlsx). Nothing else there is read.
  --mode            dry-run (the default) prints the report and writes nothing; repair writes it in one transaction.
  --report          Also write the report to this file.
  --database-url    The database to read and, with --mode repair, write. Or set REPAIR_DATABASE_URL
                    for this command only. Required for both modes.`;

type Args = { directory: string; mode: "dry-run" | "repair"; report?: string; url: string };

const FLAGS = ["mode", "report", "database-url"];

function parseArgs(argv: readonly string[]): Args | string {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return USAGE;
    if (a.startsWith("--")) {
      const [name, inline] = a.slice(2).split("=", 2);
      const value = inline ?? argv[++i];
      if (value === undefined) return `--${name} needs a value.\n\n${USAGE}`;
      if (!FLAGS.includes(name)) return `Unknown option --${name}.\n\n${USAGE}`;
      flags.set(name, value);
    } else {
      positional.push(a);
    }
  }
  if (positional.length !== 1) return USAGE;
  const mode = flags.get("mode") ?? "dry-run";
  if (mode !== "dry-run" && mode !== "repair") return `--mode is dry-run or repair.\n\n${USAGE}`;
  const url = flags.get("database-url") ?? (process.env.REPAIR_DATABASE_URL || undefined);
  if (url === undefined) return `The repair reads the database in both modes: give --database-url or REPAIR_DATABASE_URL.\n\n${USAGE}`;
  return { directory: resolve(positional[0]), mode, report: flags.get("report"), url };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") {
    console.error(args);
    return 2;
  }
  const { file, ...roster } = readRoster(args.directory);
  const client = postgres(args.url, { max: 1 });
  let result: RunResult;
  try {
    const db = drizzle(client, { schema }) as unknown as RepairDb;
    result = await runRepair({ mode: args.mode, file, roster, db });
  } catch (error) {
    // The run's own failure is the one to report; a failed close adds nothing to it.
    await client.end().catch(() => undefined);
    throw error;
  }
  // A real run's transaction has committed by now: a failure from here on says the repair was written.
  const step = <T>(name: string, act: () => T | Promise<T>) => (args.mode === "repair" ? afterWrite(name, act) : act());
  await step("printing the report", () => void process.stdout.write(result.report));
  const reportFile = args.report;
  if (reportFile !== undefined) await step("writing the report file", () => writeFileSync(resolve(reportFile), result.report));
  await step("closing the database connection", () => client.end());
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(failureReport(error));
    process.exit(1);
  },
);
