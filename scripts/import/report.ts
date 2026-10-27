import { CONFLICT_TEXT, PHOTO_KINDS, placeOf, UNCLEAR_QUITTER_KINDS } from "./conflicts";
import { PHOTO_FOLDER } from "./photos";
import { TABLES, type Plan } from "./plan";
import type { Sources } from "./sources";
import type { Uploaded, Written } from "./write";

// The report a run prints (issue #677): what was read, then per table the
// rows to insert, already present and refused, then the people counts, then
// every conflict and unclear quitter with its file, sheet, row and field. It
// prints counts and places, and the names of the units it would create (issue
// #816); never a personal value from a source: no person's name, email, phone
// or ID.

export type ReportInput = {
  readonly mode: "dry-run" | "import";
  readonly database: boolean;
  readonly sources: Sources;
  readonly plan: Plan;
  /** What an import wrote; absent on a dry run. */
  readonly written?: Written;
  /** The photos an import uploaded; absent on a dry run. */
  readonly uploaded?: Uploaded;
};

export function renderReport({ mode, database, sources, plan, written, uploaded }: ReportInput): string {
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
  lines.push(
    `Units ${written === undefined ? "to create" : "created"}: ${written?.departments ?? plan.departments.length} departments, ${written?.divisions ?? plan.divisions.length} divisions`,
  );
  // A unit's name is no personal value: each one to create is listed, open or closed.
  const span = (u: (typeof plan.departments)[number]) => (u.closedAt === null ? `open, from ${u.startedAt}` : `closed, ${u.startedAt} to ${u.closedAt}`);
  const coded = (u: (typeof plan.departments)[number]) => (u.code === null ? u.name : `${u.name} (${u.code})`);
  for (const d of plan.departments) lines.push(`  department ${coded(d)}: ${span(d)}`);
  for (const d of plan.divisions) {
    const under = d.dept === null ? "" : d.dept.kind === "new" ? ` under ${plan.departments[d.dept.index].name}` : " under an existing department";
    lines.push(`  division ${coded(d)}${under}: ${span(d)}`);
  }
  lines.push(`FAQs skipped as not visible: ${plan.hiddenFaqs}`);
  lines.push("");
  lines.push(`Alumni: ${plan.alumni}`);
  lines.push(`People found in more than one year sheet: ${plan.multiYear}`);
  lines.push(`Unclear quitters: ${plan.unclearQuitters}`);
  lines.push(`Sheet rows with no name, skipped: ${sources.namelessRows}`);
  lines.push(`Seat handovers applied (overrides.csv): ${plan.handovers}`);
  lines.push(`Quitter years applied (overrides.csv): ${plan.quitterYears}`);
  lines.push(
    `Distinct unresolved unit names (subteam and division cells): ${plan.unresolvedUnits === null ? "not checked (no database given)" : plan.unresolvedUnits}`,
  );
  lines.push("");
  const p = plan.photos;
  if (p === null) {
    lines.push(`Photos: no ${PHOTO_FOLDER} folder; no photo read.`);
  } else {
    lines.push(`Photos (${PHOTO_FOLDER}; a photo's row is its place in the sorted file list):`);
    const counts: [string, number][] = [
      ["found", p.found],
      ["matched to members", p.matchedMembers],
      ["matched to advisors", p.matchedAdvisors],
      ["id found, surname differs (held)", p.surnameDiffers],
      ["id on no people_rows.csv row", p.noIdMatch],
      ["surname only, no advisor has it", p.noSurnameMatch],
      ["surname only, more than one advisor has it", p.surnameAmbiguous],
      ["skipped, person or advisor already in the database", p.alreadyPresent],
      ["matched person or advisor not imported by this run", p.notImported],
      ["failed the photo check", p.unfit],
      ["has_pp with no file", p.missing],
      [written === undefined ? "to upload" : "uploaded", uploaded === undefined ? p.toUpload : uploaded.members + uploaded.advisors],
    ];
    if (uploaded !== undefined) counts.push(["skipped, no storage credential given", uploaded.skipped]);
    for (const [label, n] of counts) lines.push(`  ${label}: ${n}`);
  }
  lines.push("");
  const quitters = plan.conflicts.filter((c) => UNCLEAR_QUITTER_KINDS.includes(c.kind));
  const photos = plan.conflicts.filter((c) => PHOTO_KINDS.includes(c.kind));
  const others = plan.conflicts.filter((c) => !UNCLEAR_QUITTER_KINDS.includes(c.kind) && !PHOTO_KINDS.includes(c.kind));
  const place = (c: (typeof plan.conflicts)[number]) => `${placeOf(c.at)}${c.field === undefined ? "" : ` › field ${c.field}`}`;
  lines.push(`Conflicts, by row: ${others.length}`);
  for (const c of others) lines.push(`  [${c.kind}] ${place(c)}: ${CONFLICT_TEXT[c.kind]}`);
  lines.push(`Unclear quitters, by row: ${quitters.length}`);
  for (const c of quitters) lines.push(`  [${c.kind}] ${placeOf(c.at)}: ${CONFLICT_TEXT[c.kind]}`);
  lines.push(`Photo problems, by row: ${photos.length}`);
  for (const c of photos) lines.push(`  [${c.kind}] ${place(c)}: ${CONFLICT_TEXT[c.kind]}`);
  return `${lines.join("\n")}\n`;
}
