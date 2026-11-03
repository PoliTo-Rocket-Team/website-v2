import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { failureReport } from "./failure";
import { readRoster } from "./roster";
import { runRepair, type FinishStep, type RunResult } from "./run";
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
  const reportFile = args.report;
  // These run inside the run, after a real run's commit: a failure in any of them says the repair was written.
  const finish: FinishStep[] = [
    { name: "printing the report", act: ({ report }) => print(report) },
    ...(reportFile === undefined ? [] : [{ name: "writing the report file", act: ({ report }: RunResult) => writeFileSync(resolve(reportFile), report) }]),
    { name: "closing the database connection", act: () => client.end() },
  ];
  try {
    const db = drizzle(client, { schema }) as unknown as RepairDb;
    await runRepair({ mode: args.mode, file, roster, db }, finish);
  } catch (error) {
    // The run's own failure is the one to report; a failed close adds nothing to it.
    await client.end().catch(() => undefined);
    throw error;
  }
  return 0;
}

/** Writes `text` to stdout and settles once it is written, so a failed write (a closed pipe) fails this step rather than a later event. */
function print(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.on("error", reject);
    process.stdout.write(text, (error) => (error ? reject(error) : resolve()));
  });
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(failureReport(error));
    process.exit(1);
  },
);
