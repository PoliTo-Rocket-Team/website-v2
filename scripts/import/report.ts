import { CONFLICT_TEXT, placeOf, UNCLEAR_QUITTER_KINDS } from "./conflicts";
import { TABLES, type Plan } from "./plan";
import type { Sources } from "./sources";
import type { Written } from "./write";

// The report a run prints (issue #677): what was read, then per table the
// rows to insert, already present and refused, then the people counts, then
// every conflict and unclear quitter with its file, sheet, row and field. It
// prints counts and places only, never a value from a source: no name, email,
// phone or ID.

export type ReportInput = {
  readonly mode: "dry-run" | "import";
  readonly database: boolean;
  readonly sources: Sources;
  readonly plan: Plan;
  /** What an import wrote; absent on a dry run. */
  readonly written?: Written;
};

export function renderReport({ mode, database, sources, plan, written }: ReportInput): string {
  const lines: string[] = [];
  lines.push(`Team data import: ${mode === "dry-run" ? "dry run, nothing written" : "import"}`);
  lines.push(
    database
      ? "Database: given; units, existing rows and seat holders were read from it."
      : "Database: not given; units, existing rows and seat holders were not checked.",
  );
  lines.push(`Current academic year: ${plan.currentYear === null ? "none (no year sheet)" : `${plan.currentYear}-${plan.currentYear + 1}`}`);
  lines.push("");
  lines.push("Read:");
  for (const r of sources.read) lines.push(`  ${r}`);
  if (sources.skipped.length > 0) {
    lines.push("Skipped:");
    for (const s of sources.skipped) lines.push(`  ${s}`);
  }
  lines.push("");
  const head = written === undefined ? ["table", "to insert", "already present", "refused"] : ["table", "inserted", "already present", "refused"];
  const rows = TABLES.map((t) => {
    const c = plan.counts[t];
    return [t, String(written === undefined ? c.insert : written[t]), String(c.present), String(c.refused)];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: readonly string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  lines.push(line(head));
  for (const r of rows) lines.push(line(r));
  lines.push(`FAQs skipped as not visible: ${plan.hiddenFaqs}`);
  lines.push("");
  lines.push(`Alumni: ${plan.alumni}`);
  lines.push(`People found in more than one year sheet: ${plan.multiYear}`);
  lines.push(`Unclear quitters: ${plan.unclearQuitters}`);
  lines.push("");
  const quitters = plan.conflicts.filter((c) => UNCLEAR_QUITTER_KINDS.includes(c.kind));
  const others = plan.conflicts.filter((c) => !UNCLEAR_QUITTER_KINDS.includes(c.kind));
  lines.push(`Conflicts, by row: ${others.length}`);
  for (const c of others) lines.push(`  [${c.kind}] ${placeOf(c.at)}${c.field === undefined ? "" : ` › field ${c.field}`}: ${CONFLICT_TEXT[c.kind]}`);
  lines.push(`Unclear quitters, by row: ${quitters.length}`);
  for (const c of quitters) lines.push(`  [${c.kind}] ${placeOf(c.at)}: ${CONFLICT_TEXT[c.kind]}`);
  return `${lines.join("\n")}\n`;
}
