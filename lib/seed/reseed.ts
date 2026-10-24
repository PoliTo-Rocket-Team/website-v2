// The on-demand re-seed of the shared `preview` branch (issue #595, ADR 0016
// amendment of 2026-10-24). The owner asks for one by setting the Vercel
// Preview variable `PREVIEW_RESEED_REQUEST` to a new value and redeploying a
// preview. That preview build, under its lock and after its migration,
// empties every table of the `public` and `better_auth` schemas and loads the
// dummy set again, in one transaction that also records the value in
// `preview_reseeds`. A later build that sees the same value finds it recorded
// and leaves the rows in place, so one request re-seeds once. Nobody holds a
// database credential for it: the build reads the Preview connection strings
// Vercel gives it. It calls no Neon API, so it never resets a branch from its
// parent (the `preview` branch's parent is production).

import { runSeed, type SeedConnection, type SeedModule, type SeedReport } from "./runner";
import { SHARED_PREVIEW_BRANCH, type ApprovedSeedTarget, type GuardVerdict } from "./target";

/** The Vercel Preview variable whose new value asks for one re-seed. */
export const RESEED_REQUEST_VARIABLE = "PREVIEW_RESEED_REQUEST";

/** The table that remembers the requests already served; the re-seed keeps it. */
export const RESEED_LEDGER_TABLE = "preview_reseeds";

/** The schemas the re-seed empties: the app's tables and Better Auth's. */
export const RESEED_SCHEMAS = ["public", "better_auth"] as const;

// A short name an owner can type: a date, or a date and a counter.
const REQUEST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/** What the variable asked for: nothing, one re-seed, or a value the build refuses. */
export type ReseedRequestRead =
  | { readonly kind: "none" }
  | { readonly kind: "requested"; readonly request: ReseedRequest }
  | { readonly kind: "invalid"; readonly why: string };

/** One re-seed the owner asked for, named by the variable's value. Only `ReseedRequest.read` makes one. */
export class ReseedRequest {
  private constructor(readonly id: string) {}

  static read(raw: string | undefined): ReseedRequestRead {
    const value = raw?.trim() ?? "";
    if (value === "") return { kind: "none" };
    if (!REQUEST_PATTERN.test(value)) {
      return { kind: "invalid", why: `${RESEED_REQUEST_VARIABLE} must be 1 to 64 letters, digits, dots, dashes, colons or underscores, such as 2026-10-25` };
    }
    return { kind: "requested", request: new ReseedRequest(value) };
  }
}

/** The re-seed's verdict on a target: the seed guard's approval, narrowed to the `preview` branch. */
export type ReseedVerdict =
  | { readonly ok: true; readonly target: ApprovedSeedTarget }
  | { readonly ok: false; readonly why: string };

/**
 * Whether the re-seed may empty the target the seed guard (`guardSeedTarget`)
 * judged. Only an approved target passes, and only the `preview` branch's:
 * the guard also approves a local database, which `pnpm db:seed` resets by
 * itself, so the re-seed refuses it.
 */
export function reseedVerdictOf(verdict: GuardVerdict): ReseedVerdict {
  if (!verdict.ok) return { ok: false, why: `the seed guard refused (${verdict.refusal.reason}): ${verdict.refusal.detail}` };
  if (verdict.target.kind !== "preview") {
    return { ok: false, why: `the re-seed empties only the "${SHARED_PREVIEW_BRANCH}" branch, and ${verdict.target.label} is a ${verdict.target.kind} database` };
  }
  return verdict;
}

/**
 * Empties every table of `RESEED_SCHEMAS` but the ledger, and restarts their
 * ids, in one statement. It reads the table list from the database itself,
 * so a table no seed module owns (the audit table `logs`, sign-in sessions,
 * a table a later migration adds) is emptied too. TRUNCATE fires no row
 * trigger, so it writes no audit row. Drizzle's own migration journal lives
 * in the `drizzle` schema, which it leaves alone.
 */
export const RESEED_WIPE = `DO $wipe$
DECLARE targets text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY schemaname, tablename) INTO targets
  FROM pg_tables
  WHERE schemaname IN (${RESEED_SCHEMAS.map((s) => `'${s}'`).join(", ")})
    AND NOT (schemaname = 'public' AND tablename = '${RESEED_LEDGER_TABLE}');
  IF targets IS NOT NULL THEN
    EXECUTE 'TRUNCATE ' || targets || ' RESTART IDENTITY CASCADE';
  END IF;
END
$wipe$`;

/** Records the request as served; inside the re-seed's transaction, so it lands only with the new rows. */
export const RESEED_RECORD = `INSERT INTO ${RESEED_LEDGER_TABLE} (request) VALUES ($1)`;

/** Reads, and never writes, whether the request was already served. */
export const RESEED_SERVED = `SELECT EXISTS (SELECT 1 FROM ${RESEED_LEDGER_TABLE} WHERE request = $1) AS served`;

/** Runs one statement in the seed's transaction. */
export type RunStatement<Tx> = (tx: Tx, sql: string, params: readonly unknown[]) => Promise<void>;

/**
 * The re-seed's own module, put first in the runner's list: the runner resets
 * in reverse order, so its reset (the wipe) runs after every module's own
 * reset, and its insert (the record) runs before every module's rows.
 */
export function reseedModule<Tx>(request: ReseedRequest, run: RunStatement<Tx>): SeedModule<Tx> {
  return {
    name: "reseed",
    reset: (tx) => run(tx, RESEED_WIPE, []),
    insert: (tx) => run(tx, RESEED_RECORD, [request.id]),
  };
}

/**
 * Empties the `preview` branch and loads the dummy set, in one transaction.
 * The target comes from the seed guard, by way of `reseedVerdictOf`; a target
 * that is not the `preview` branch's throws before any connection opens.
 */
export async function runReseed<Tx>(
  target: ApprovedSeedTarget,
  request: ReseedRequest,
  modules: readonly SeedModule<Tx>[],
  run: RunStatement<Tx>,
  connect: (connectionString: string) => SeedConnection<Tx>,
): Promise<SeedReport> {
  if (target.kind !== "preview") throw new Error(`the re-seed empties only the "${SHARED_PREVIEW_BRANCH}" branch, not ${target.label}`);
  return runSeed(target, [reseedModule(request, run), ...modules], connect);
}
