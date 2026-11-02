import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { failureReport } from "./failure";
import { LedgerError, readLedger, writeLedger, writeNewLedger, type Ledger } from "./ledger";
import { blobPhotoStore, blobTokenOf, BlobTokenError, exportPhotos, type BlobToken } from "./photos";
import { runImport, type FinishStep, type RunResult } from "./run";
import { FirstRoundError, readFirstRound, renderSeed, seedLedger, type FirstRound } from "./seed";
import { readSnapshot, type ImportDb, type Snapshot } from "./snapshot";
import { readSource, SourceError, type Source } from "./source";

// `pnpm db:outreach-instagram <source-file> --ledger <file> [--photos
// <export-dir>] [--mode dry-run|import|seed-ledger] [--first-round-report
// <file>] [--report <file>] [--database-url <url>] [--blob-token <token>]`
// (issue #886; README.md beside this file). The connection and the store token
// come only from this run: the flags, or IMPORT_DATABASE_URL and
// IMPORT_BLOB_TOKEN set for this one command. The tool loads no .env file and
// reads neither DATABASE_URL nor BLOB_READ_WRITE_TOKEN, so it never reaches a
// database or a store by accident. Each database keeps its own ledger: the
// preview's and production's are two files.

const USAGE = `Usage: pnpm db:outreach-instagram <source-file> --ledger <file> [--photos <export-dir>] [--mode dry-run|import|seed-ledger] [--first-round-report <file>] [--report <file>] [--database-url <url>] [--blob-token <token>]

  <source-file>         The import source: the drafted texts and the chosen photos (JSON, kept outside the repo).
  --ledger              What earlier runs on this database wrote (JSON, kept outside the repo; one file per database).
                        Read by dry-run and import; created or updated by import; created by seed-ledger, which never replaces one.
  --photos              The Instagram export's directory; the source names each photo by its path inside it. Read as data only.
                        Needed by dry-run and import.
  --mode                dry-run (the default) prints the list and writes and uploads nothing; import uploads the photos and writes
                        in one transaction; seed-ledger writes a new ledger from the first round's report, reading the database only.
  --first-round-report  For seed-ledger: the report the first round's real run wrote.
  --report              Also write the report to this file.
  --database-url        The database to read and, with --mode import, write. Or set IMPORT_DATABASE_URL for this command only.
                        Every mode needs it.
  --blob-token          The public Blob store's read-write token (vercel_blob_rw_...), for --mode import. Or set IMPORT_BLOB_TOKEN
                        for this command only.`;

type Common = { source: string; ledger: string; report?: string; url: string };

/** What one run is asked to do: each mode with exactly the inputs it reads. */
type Args =
  | (Common & { mode: "dry-run"; photos: string; blobToken?: BlobToken })
  | (Common & { mode: "import"; photos: string; blobToken: BlobToken })
  | (Common & { mode: "seed-ledger"; firstRoundReport: string });

const FLAGS = ["photos", "ledger", "mode", "first-round-report", "report", "database-url", "blob-token"];

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
  const ledger = flags.get("ledger");
  if (ledger === undefined) return `--ledger names this database's ledger file; a first run names a file that does not exist yet.\n\n${USAGE}`;
  const url = flags.get("database-url") ?? (process.env.IMPORT_DATABASE_URL || undefined);
  if (url === undefined) return `The import reads the database in every mode: give --database-url or IMPORT_DATABASE_URL.\n\n${USAGE}`;
  const common: Common = { source: resolve(positional[0]), ledger: resolve(ledger), report: flags.get("report"), url };
  const mode = flags.get("mode") ?? "dry-run";
  const given = flags.get("blob-token") ?? (process.env.IMPORT_BLOB_TOKEN || undefined);
  const firstRoundReport = flags.get("first-round-report");

  if (mode === "seed-ledger") {
    if (firstRoundReport === undefined) return `--mode seed-ledger reads the first round's report: give --first-round-report.\n\n${USAGE}`;
    if (flags.has("photos") || given !== undefined) return `--mode seed-ledger reads no photo and uploads nothing: drop --photos and the Blob token.\n\n${USAGE}`;
    return { ...common, mode, firstRoundReport: resolve(firstRoundReport) };
  }
  if (mode !== "dry-run" && mode !== "import") return `--mode is dry-run, import or seed-ledger.\n\n${USAGE}`;
  if (firstRoundReport !== undefined) return `--first-round-report is for --mode seed-ledger only.\n\n${USAGE}`;
  const photos = flags.get("photos");
  if (photos === undefined) return `--photos names the export directory.\n\n${USAGE}`;
  let blobToken: BlobToken | undefined;
  try {
    blobToken = given === undefined ? undefined : blobTokenOf(given);
  } catch (error) {
    if (!(error instanceof BlobTokenError)) throw error;
    return error.message;
  }
  if (mode === "dry-run") return { ...common, mode, photos: resolve(photos), blobToken };
  if (blobToken === undefined) return `An import uploads the photos: give --blob-token or IMPORT_BLOB_TOKEN.\n\n${USAGE}`;
  return { ...common, mode, photos: resolve(photos), blobToken };
}


/** A refusal before the database opens: printed, and the run ends having written nothing. */
function refuse(message: string): number {
  console.error(`Outreach Instagram import failed; nothing was written.\n${message}`);
  return 1;
}

/** A file read before the database opens that is not what it should be: its message, for `refuse`. Anything else is thrown on. */
function refusalOf(error: unknown): string {
  if (error instanceof SourceError || error instanceof LedgerError || error instanceof FirstRoundError) return error.message;
  throw error;
}

function connect(url: string) {
  const client = postgres(url, { max: 1 });
  return { client, db: drizzle(client, { schema }) as unknown as ImportDb };
}

const writeReportFile = (file: string | undefined, report: string) => (file === undefined ? undefined : writeFileSync(resolve(file), report));

/** --mode seed-ledger: the ledger the first round would have written, from its report and one read of the database, to a new file. */
async function seed(args: Extract<Args, { mode: "seed-ledger" }>): Promise<number> {
  let source: Source;
  let firstRound: FirstRound;
  try {
    source = readSource(args.source);
    firstRound = readFirstRound(args.firstRoundReport);
  } catch (error) {
    return refuse(refusalOf(error));
  }
  if (existsSync(args.ledger)) return refuse(`The ledger ${args.ledger} already exists; seeding writes a new ledger only.`);
  const { client, db } = connect(args.url);
  let snapshot: Snapshot;
  try {
    snapshot = await readSnapshot(db);
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  // The database is only read, and closed before any file is written.
  await client.end();
  const result = seedLedger(firstRound, source, snapshot);
  writeNewLedger(args.ledger, result.ledger);
  const report = renderSeed(args.firstRoundReport, args.ledger, result);
  await print(report);
  writeReportFile(args.report, report);
  return 0;
}

/** --mode dry-run or import: the run itself (./run.ts). */
async function run(args: Exclude<Args, { mode: "seed-ledger" }>): Promise<number> {
  let source: Source;
  let ledger: Ledger;
  try {
    source = readSource(args.source);
    ledger = readLedger(args.ledger);
  } catch (error) {
    return refuse(refusalOf(error));
  }
  const store = args.blobToken === undefined ? undefined : await blobPhotoStore(args.blobToken);
  const { client, db } = connect(args.url);
  const { report: reportFile, ledger: ledgerFile } = args;
  // These run inside the run, after a real run's commit: a failure in any of them says the import was written.
  // The ledger goes first: without it, the next run would take this run's drafts for someone else's.
  const finish: FinishStep[] = [
    ...(args.mode === "import" ? [{ name: "writing the ledger", act: (result: RunResult) => writeLedger(ledgerFile, result.ledger) }] : []),
    { name: "printing the report", act: ({ report }) => print(report) },
    ...(reportFile === undefined ? [] : [{ name: "writing the report file", act: ({ report }: RunResult) => writeReportFile(reportFile, report) }]),
    { name: "closing the database connection", act: () => client.end() },
  ];
  try {
    await runImport({ mode: args.mode, sourceFile: args.source, source, ledger, photos: exportPhotos(args.photos), db, store }, finish);
  } catch (error) {
    // The run's own failure is the one to report; a failed close adds nothing to it.
    await client.end().catch(() => undefined);
    throw error;
  }
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") {
    console.error(args);
    return 2;
  }
  return args.mode === "seed-ledger" ? seed(args) : run(args);
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
