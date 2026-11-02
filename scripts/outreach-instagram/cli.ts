import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { failureReport } from "./failure";
import { blobPhotoStore, exportPhotos } from "./photos";
import { runImport, type FinishStep, type RunResult } from "./run";
import type { ImportDb } from "./snapshot";
import { readSource, SourceError, type Source } from "./source";

// `pnpm db:outreach-instagram <source-file> --photos <export-dir> [--mode
// dry-run|import] [--report <file>] [--database-url <url>] [--blob-token
// <token>]` (issue #886; README.md beside this file). The connection and the
// store token come only from this run: the flags, or IMPORT_DATABASE_URL and
// IMPORT_BLOB_TOKEN set for this one command. The tool loads no .env file and
// reads neither DATABASE_URL nor BLOB_READ_WRITE_TOKEN, so it never reaches a
// database or a store by accident.

const USAGE = `Usage: pnpm db:outreach-instagram <source-file> --photos <export-dir> [--mode dry-run|import] [--report <file>] [--database-url <url>] [--blob-token <token>]

  <source-file>     The import source: the drafted texts and the chosen photos (JSON, kept outside the repo).
  --photos          The Instagram export's directory; the source names each photo by its path inside it. Read as data only.
  --mode            dry-run (the default) prints the list and writes and uploads nothing; import uploads the photos and writes in one transaction.
  --report          Also write the report to this file.
  --database-url    The database to read and, with --mode import, write. Or set IMPORT_DATABASE_URL for this command only. Required for both modes.
  --blob-token      The public Blob store's read-write token, for --mode import. Or set IMPORT_BLOB_TOKEN for this command only.`;

type Args = { source: string; photos: string; mode: "dry-run" | "import"; report?: string; url: string; blobToken?: string };

const FLAGS = ["photos", "mode", "report", "database-url", "blob-token"];

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
  const photos = flags.get("photos");
  if (photos === undefined) return `--photos names the export directory.\n\n${USAGE}`;
  const mode = flags.get("mode") ?? "dry-run";
  if (mode !== "dry-run" && mode !== "import") return `--mode is dry-run or import.\n\n${USAGE}`;
  const url = flags.get("database-url") ?? (process.env.IMPORT_DATABASE_URL || undefined);
  if (url === undefined) return `The import reads the database in both modes: give --database-url or IMPORT_DATABASE_URL.\n\n${USAGE}`;
  const blobToken = flags.get("blob-token") ?? (process.env.IMPORT_BLOB_TOKEN || undefined);
  if (mode === "import" && blobToken === undefined) return `An import uploads the photos: give --blob-token or IMPORT_BLOB_TOKEN.\n\n${USAGE}`;
  return { source: resolve(positional[0]), photos: resolve(photos), mode, report: flags.get("report"), url, blobToken };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") {
    console.error(args);
    return 2;
  }
  let source: Source;
  try {
    source = readSource(args.source);
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    console.error(`Outreach Instagram import failed; nothing was written.\n${error.message}`);
    return 1;
  }
  const store = args.blobToken === undefined ? undefined : await blobPhotoStore(args.blobToken);
  const client = postgres(args.url, { max: 1 });
  const reportFile = args.report;
  // These run inside the run, after a real run's commit: a failure in any of them says the import was written.
  const finish: FinishStep[] = [
    { name: "printing the report", act: ({ report }) => print(report) },
    ...(reportFile === undefined ? [] : [{ name: "writing the report file", act: ({ report }: RunResult) => writeFileSync(resolve(reportFile), report) }]),
    { name: "closing the database connection", act: () => client.end() },
  ];
  try {
    const db = drizzle(client, { schema }) as unknown as ImportDb;
    await runImport({ mode: args.mode, sourceFile: args.source, source, photos: exportPhotos(args.photos), db, store }, finish);
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
