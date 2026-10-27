import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { blobPhotoStore } from "./photos";
import { runImport } from "./run";
import type { ImportDb } from "./snapshot";

// `pnpm db:import <source-dir> [--mode dry-run|import] [--year YYYY-YYYY]
// [--report <file>] [--database-url <url>] [--blob-token <token>]` (issue
// #677; README.md beside this file). The connection and the storage
// credential come only from this run: the flags, or the IMPORT_DATABASE_URL
// and IMPORT_BLOB_TOKEN variables set for this one command. This tool loads
// no .env file and reads no DATABASE_URL or BLOB_READ_WRITE_TOKEN, so it never
// reaches a database or a store by accident.

const USAGE = `Usage: pnpm db:import <source-dir> [--mode dry-run|import] [--year YYYY-YYYY] [--report <file>] [--database-url <url>] [--blob-token <token>]

  <source-dir>      The directory holding the roster workbook (.xlsx), the CSV exports and, if any, the photos/ folder
                    and the overrides.csv input (README.md, "The override input").
  --mode            dry-run (the default) prints the report and writes and uploads nothing; import writes.
  --year            The current academic year's sheet, e.g. 2026-2027; by default the newest one.
  --report          Also write the report to this file.
  --database-url    The database to read (dry-run) or write (import). Or set IMPORT_DATABASE_URL
                    for this command only. Required for import.
  --blob-token      The public Vercel Blob store's read-write token, to upload photos on import. Or set
                    IMPORT_BLOB_TOKEN for this command only. Without it an import uploads no photo
                    and reports the photos as skipped.`;

type Args = { directory: string; mode: "dry-run" | "import"; year?: number; report?: string; url?: string; blobToken?: string };

const FLAGS = ["mode", "year", "report", "database-url", "blob-token"];

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
  if (mode !== "dry-run" && mode !== "import") return `--mode is dry-run or import.\n\n${USAGE}`;
  const yearText = flags.get("year");
  const year = yearText === undefined ? undefined : /^(\d{4})-(\d{4})$/.exec(yearText);
  if (year === null || (year !== undefined && Number(year[2]) !== Number(year[1]) + 1)) return `--year is an academic year like 2026-2027.\n\n${USAGE}`;
  const url = flags.get("database-url") ?? (process.env.IMPORT_DATABASE_URL || undefined);
  if (mode === "import" && url === undefined) return `An import needs --database-url or IMPORT_DATABASE_URL.\n\n${USAGE}`;
  const blobToken = flags.get("blob-token") ?? (process.env.IMPORT_BLOB_TOKEN || undefined);
  return { directory: resolve(positional[0]), mode, year: year === undefined ? undefined : Number(year[1]), report: flags.get("report"), url, blobToken };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") {
    console.error(args);
    return 2;
  }
  const client = args.url === undefined ? null : postgres(args.url, { max: 1 });
  try {
    const db = client === null ? undefined : (drizzle(client, { schema }) as unknown as ImportDb);
    const result =
      args.mode === "import"
        ? await runImport({
            mode: "import",
            directory: args.directory,
            year: args.year,
            db: db!,
            photoStore: args.blobToken === undefined ? undefined : await blobPhotoStore(args.blobToken),
          })
        : await runImport({ mode: "dry-run", directory: args.directory, year: args.year, db });
    process.stdout.write(result.report);
    if (args.report !== undefined) writeFileSync(resolve(args.report), result.report);
    return 0;
  } finally {
    await client?.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`Import failed; nothing was written. ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
