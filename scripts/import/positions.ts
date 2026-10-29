import { readdirSync } from "node:fs";
import { asc } from "drizzle-orm";
import { applyPositions, divisions as divisionsTable } from "@/db/schema";
import { DIVISIONS_CSV, POSITIONS_CSV, SUBTEAMS_CSV } from "./columns";
import { CONFLICT_TEXT, placeOf, type At, type Conflict } from "./conflicts";
import type { ImportDb } from "./snapshot";
import { CSV_FILES, POSITIONS_FILE, readCsv, type ReadLog, type Row } from "./sources";
import { codeKey, unitKey, unitsNamed, type Division } from "./units";

// The positions-only run (owner decision, issue #834): it reads the old
// positions export and imports each position, closed, into the production
// division its old division maps to. It imports nothing else: no person,
// role, unit, advisor, FAQ, order or photo, and it creates no unit. Like the
// full run it is insert-only, and a row the database already holds is
// counted as present, so a second run inserts nothing.
//
// A position's old `division` is an id of the old export: a
// `divisions_rows.csv` row, else a `subteams_rows.csv` row, which gives its
// name and code. That unit maps to a production division by code first, then
// by name through the fold every unit name goes through (./units.ts). The old
// test division is skipped; a unit that finds no division, or several, is not
// imported, and the report lists the row with the old name and code.

/** The old export's unit a position's `division` id names. */
export type OldUnit = { readonly file: string; readonly name: string; readonly code: string | null };

/** What a position row is imported as. `status` is not here: every imported position is closed. */
export type NewPosition = {
  readonly divisionId: number;
  readonly title: string;
  readonly description: string | null;
  readonly requiredSkills: readonly string[];
  readonly desirableSkills: readonly string[];
};

/** How an old unit found its production division. */
export type DivisionMatch =
  | { readonly kind: "found"; readonly division: Division; readonly by: "code" | "name" }
  | { readonly kind: "absent" }
  | { readonly kind: "several"; readonly divisions: readonly Division[] };

/** What the run does with one row of `positions_rows.csv`. */
export type PositionOutcome =
  | ({ readonly kind: "insert" } & Placed)
  | ({ readonly kind: "present" } & Placed)
  | ({ readonly kind: "duplicate"; readonly firstRow: number } & Placed)
  | { readonly kind: "test-division"; readonly at: At; readonly old: OldUnit }
  | { readonly kind: "no-division"; readonly at: At; readonly old: OldUnit }
  | { readonly kind: "several-divisions"; readonly at: At; readonly old: OldUnit; readonly divisions: readonly Division[] }
  | { readonly kind: "unknown-old-division"; readonly at: At }
  | { readonly kind: "no-title"; readonly at: At };

type Found = Extract<DivisionMatch, { kind: "found" }>;
/** A row whose old division found one production division. */
type Placed = { readonly at: At; readonly old: OldUnit; readonly match: Found; readonly position: NewPosition };

export type PositionSources = {
  readonly read: readonly string[];
  readonly skipped: readonly string[];
  readonly conflicts: readonly Conflict[];
  readonly positions: readonly Row<keyof typeof POSITIONS_CSV>[];
  readonly divisions: readonly Row<keyof typeof DIVISIONS_CSV>[];
  readonly subteams: readonly Row<keyof typeof SUBTEAMS_CSV>[];
};

/** What the database holds that the run reads first: every division, closed ones included, and every position's division and title. */
export type PositionSnapshot = {
  readonly divisions: readonly Division[];
  readonly positions: readonly { readonly divisionId: number | null; readonly title: string | null }[];
};

export type PositionPlan = { readonly outcomes: readonly PositionOutcome[] };

/** The three files the run reads; every other file of the directory is listed as not read. */
const READ_FILES: ReadonlySet<string> = new Set([POSITIONS_FILE, CSV_FILES.divisions, CSV_FILES.subteams]);

export function readPositionSources(directory: string): PositionSources {
  const log: ReadLog = { read: [], skipped: [], conflicts: [] };
  const positions = readCsv(directory, POSITIONS_FILE, POSITIONS_CSV, log);
  const divisions = readCsv(directory, CSV_FILES.divisions, DIVISIONS_CSV, log);
  const subteams = readCsv(directory, CSV_FILES.subteams, SUBTEAMS_CSV, log);
  const others = readdirSync(directory)
    .filter((n) => !n.startsWith("~$") && !n.startsWith(".") && !READ_FILES.has(n))
    .sort();
  for (const name of others) log.skipped.push(`${name}: not read by the positions-only run`);
  return { ...log, positions, divisions, subteams };
}

export async function readPositionSnapshot(db: ImportDb): Promise<PositionSnapshot> {
  const divisions = await db
    .select({ id: divisionsTable.id, name: divisionsTable.name, code: divisionsTable.code, deptId: divisionsTable.deptId })
    .from(divisionsTable)
    .orderBy(asc(divisionsTable.id));
  const positions = await db.select({ divisionId: applyPositions.divisionId, title: applyPositions.title }).from(applyPositions);
  return { divisions, positions };
}

/** The old test division, by its name or its code (owner decision, issue #834). */
const TEST_DIVISION = { name: "test-division-website", code: "TDW" };

export function isTestDivision(old: OldUnit): boolean {
  return unitKey(old.name) === unitKey(TEST_DIVISION.name) || (old.code !== null && codeKey(old.code) === codeKey(TEST_DIVISION.code));
}

/** The production division an old unit maps to: by its code first, then by its name as any unit name is compared (name, code, plural "s"). */
export function matchDivision(divisions: readonly Division[], old: OldUnit): DivisionMatch {
  const byCode = old.code === null ? [] : divisions.filter((d) => d.code !== null && codeKey(d.code) === codeKey(old.code!));
  const [hits, by] = byCode.length > 0 ? [byCode, "code" as const] : [unitsNamed(divisions, old.name), "name" as const];
  if (hits.length === 1) return { kind: "found", division: hits[0], by };
  return hits.length === 0 ? { kind: "absent" } : { kind: "several", divisions: hits };
}

const orNull = (text: string) => (text.trim() === "" ? null : text.trim());

/** A list cell from the old export: a JSON array, a Postgres array literal, or one item per line. */
export function listOf(text: string): string[] {
  const t = text.trim();
  if (t === "") return [];
  if (t.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter((s) => s !== "");
    } catch {
      // read as lines below
    }
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    return [...t.slice(1, -1).matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2]).replace(/\\(.)/g, "$1").trim()).filter((s) => s !== "");
  }
  return t
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter((s) => s !== "");
}

/** Two titles are one position's when they differ only in case and spacing. */
const titleKey = (title: string) => title.replace(/\s+/g, " ").trim().toLowerCase();
const positionKey = (divisionId: number | null, title: string) => `${divisionId ?? ""}\u0000${titleKey(title)}`;

export function planPositions(sources: PositionSources, snapshot: PositionSnapshot): PositionPlan {
  const oldUnits = new Map<string, OldUnit>();
  for (const [rows, file] of [[sources.subteams, CSV_FILES.subteams], [sources.divisions, CSV_FILES.divisions]] as const) {
    for (const r of rows) oldUnits.set(r.value.id.trim(), { file, name: r.value.name.trim(), code: orNull(r.value.code) });
  }
  const present = new Set(snapshot.positions.map((p) => positionKey(p.divisionId, p.title ?? "")));
  /** The first row of each division and title: a later row with both is a duplicate. */
  const firstRows = new Map<string, number>();
  const outcomes = sources.positions.map((row): PositionOutcome => {
    const at = row.at;
    const title = row.value.name.trim();
    if (title === "") return { kind: "no-title", at };
    const old = oldUnits.get(row.value.division.trim());
    if (old === undefined) return { kind: "unknown-old-division", at };
    if (isTestDivision(old)) return { kind: "test-division", at, old };
    const match = matchDivision(snapshot.divisions, old);
    if (match.kind === "absent") return { kind: "no-division", at, old };
    if (match.kind === "several") return { kind: "several-divisions", at, old, divisions: match.divisions };
    const position: NewPosition = {
      divisionId: match.division.id,
      title,
      description: orNull(row.value.description),
      requiredSkills: listOf(row.value.required),
      desirableSkills: listOf(row.value.desirable),
    };
    const key = positionKey(position.divisionId, title);
    const firstRow = firstRows.get(key);
    if (firstRow !== undefined) return { kind: "duplicate", at, old, match, position, firstRow };
    firstRows.set(key, at.row);
    return present.has(key) ? { kind: "present", at, old, match, position } : { kind: "insert", at, old, match, position };
  });
  return { outcomes };
}

/** The positions a plan inserts. */
export const toInsert = (plan: PositionPlan): NewPosition[] => plan.outcomes.flatMap((o) => (o.kind === "insert" ? [o.position] : []));

type Tx = Parameters<Parameters<ImportDb["transaction"]>[0]>[0];

/** Inserts the plan's positions, every one closed, in the caller's transaction; returns how many. Nothing else is written. */
export async function writePositions(tx: Tx, plan: PositionPlan): Promise<number> {
  const rows = toInsert(plan);
  if (rows.length === 0) return 0;
  const inserted = await tx
    .insert(applyPositions)
    .values(rows.map((p) => ({ ...p, status: false, requiredSkills: [...p.requiredSkills], desirableSkills: [...p.desirableSkills] })))
    .returning({ id: applyPositions.id });
  return inserted.length;
}

const coded = (unit: { readonly name: string; readonly code: string | null }) => (unit.code === null ? unit.name : `${unit.name} (${unit.code})`);

/**
 * The positions-only report: what was read and left out, the counts, then
 * every row with the production division it maps to, or why it is not
 * imported with its old division's name and code. Titles and unit names are
 * no personal value; nothing else of a row is printed.
 */
export function renderPositionsReport({ mode, sources, plan, written }: { mode: "dry-run" | "import"; sources: PositionSources; plan: PositionPlan; written?: number }): string {
  const lines: string[] = [];
  lines.push(`Positions-only import: ${mode === "dry-run" ? "dry run, nothing written" : "import"}`);
  lines.push("Only positions_rows.csv is imported, every position closed; no unit is created and nothing else is written.");
  lines.push("");
  lines.push("Read:");
  for (const r of sources.read) lines.push(`  ${r}`);
  if (sources.skipped.length > 0) {
    lines.push("Skipped:");
    for (const s of sources.skipped) lines.push(`  ${s}`);
  }
  lines.push("");
  const count = (kind: PositionOutcome["kind"]) => plan.outcomes.filter((o) => o.kind === kind).length;
  lines.push(`Positions ${written === undefined ? `to insert, closed: ${count("insert")}` : `inserted, closed: ${written}`}`);
  lines.push(`Already present: ${count("present")}`);
  lines.push(`Duplicates of an earlier row (same division and title): ${count("duplicate")}`);
  lines.push(`Test division, skipped: ${count("test-division")}`);
  lines.push(`Not imported, no production division: ${count("no-division")}`);
  lines.push(`Not imported, several production divisions: ${count("several-divisions")}`);
  lines.push(`Not imported, old division not in the export: ${count("unknown-old-division")}`);
  lines.push(`Not imported, no title: ${count("no-title")}`);
  lines.push("");
  lines.push(`Positions, by row: ${plan.outcomes.length}`);
  const inserted = written === undefined ? "to insert" : "inserted";
  for (const o of plan.outcomes) {
    const place = placeOf(o.at);
    switch (o.kind) {
      case "insert":
      case "present":
      case "duplicate": {
        const target = `"${o.position.title}" → ${coded(o.match.division)}, by ${o.match.by}, from old division ${coded(o.old)}`;
        const what = o.kind === "insert" ? inserted : o.kind === "present" ? "already present" : `duplicate of row ${o.firstRow}, not imported`;
        lines.push(`  ${place}: ${target}: ${what}`);
        break;
      }
      case "test-division":
        lines.push(`  ${place}: test division ${coded(o.old)}: skipped`);
        break;
      case "no-division":
        lines.push(`  ${place}: old division ${coded(o.old)} matches no production division: not imported`);
        break;
      case "several-divisions":
        lines.push(`  ${place}: old division ${coded(o.old)} matches ${o.divisions.length} production divisions (${o.divisions.map(coded).join("; ")}): not imported`);
        break;
      case "unknown-old-division":
        lines.push(`  ${place}: its division id is on no row of ${CSV_FILES.divisions} or ${CSV_FILES.subteams}: not imported`);
        break;
      case "no-title":
        lines.push(`  ${place} › field name: no title: not imported`);
        break;
    }
  }
  if (sources.conflicts.length > 0) {
    lines.push("");
    lines.push(`Conflicts, by row: ${sources.conflicts.length}`);
    for (const c of sources.conflicts) lines.push(`  [${c.kind}] ${placeOf(c.at)}: ${CONFLICT_TEXT[c.kind]}`);
  }
  return `${lines.join("\n")}\n`;
}
