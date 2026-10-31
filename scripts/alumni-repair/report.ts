import { yearName } from "./academic-year";
import type { DivisionRef, LeftReason } from "./lineage";
import type { Plan, SkipKind } from "./plan";
import type { Roster } from "./roster";
import type { Written } from "./write";

// The report a run prints (issue #913): what was read, every role Part 1 adds
// by its Quitters row and unit, every Quitters row it skips and why, and every
// role Part 2 moves, by academic year and unit, with the counts. It prints
// sheet names, row numbers, academic years and unit names only: never a
// person's name, email, phone or ID, and no database id.

const SKIP_TEXT: Readonly<Record<SkipKind, string>> = {
  "no-leave-date": "no leave date",
  "date-unreadable": "a date that does not read, or a join day after the leave day",
  "after-current-year": "the leave date falls after the current academic year",
  "ambiguous-match": "the row matches two people on the year sheets",
  duplicate: "a second Quitters row for one person",
  "no-member": "no member in the database has the row's emails",
  "ambiguous-member": "the row's emails find two members in the database",
  "has-role": "the person already has a role in that year",
  "unknown-unit": "a unit cell names no unit the database holds, or two",
  "no-unit": "the unit cells name no unit, and the title is not a board seat",
  "ambiguous-division": "the target department has, or would get, two divisions that match",
  "division-outside-lineage": "the division sits under a department outside the lineage",
};

const LEFT_TEXT: Readonly<Record<LeftReason, string>> = {
  "ambiguous-division": SKIP_TEXT["ambiguous-division"],
  "division-outside-lineage": SKIP_TEXT["division-outside-lineage"],
};

export type ReportInput = {
  readonly mode: "dry-run" | "repair";
  readonly file: string;
  readonly roster: Roster;
  readonly plan: Plan;
  /** What a real run wrote; absent on a dry run. */
  readonly written?: Written;
};

export function renderReport({ mode, file, roster, plan, written }: ReportInput): string {
  const dry = written === undefined;
  const departmentName = (id: number | null) => (id === null ? "no unit" : (plan.units.departments.find((d) => d.id === id)?.name ?? "an unknown department"));
  const divisionName = (ref: DivisionRef | null) =>
    ref === null
      ? null
      : ref.kind === "existing"
        ? (plan.units.divisions.find((d) => d.id === ref.id)?.name ?? "an unknown division")
        : `${plan.divisions[ref.index].name} (new)`;
  const unit = (deptId: number | null, division: DivisionRef | null) => {
    const d = divisionName(division);
    return d === null ? departmentName(deptId) : `${departmentName(deptId)} › ${d}`;
  };

  const lines: string[] = [];
  lines.push(`Alumni repair (issue #913): ${dry ? "dry run, nothing written" : "real run"}`);
  lines.push(`Workbook: ${file}`);
  lines.push(`Current academic year: ${plan.currentYear === null ? "none (no year sheet)" : yearName(plan.currentYear)}`);
  lines.push(`Read: ${roster.read.join(", ")}`);
  if (roster.skipped.length > 0) lines.push(`Not read: ${roster.skipped.join("; ")}`);
  lines.push(`Sheet rows with no name, left out: ${roster.namelessRows}`);

  lines.push("", "Part 1: missing last-year roles");
  const rowsAdded = new Set(plan.roles.map((r) => r.at.row)).size;
  lines.push(`Quitters rows: ${plan.quitterRows}`);
  lines.push(`  on no year sheet (the import placed them): ${plan.quitterOnly}`);
  lines.push(`  on the year sheet of their leave year: ${plan.onYearSheet}`);
  lines.push(`  on no year sheet before their leave year: ${plan.noEarlierSheet}`);
  lines.push(`  given their last-year role: ${rowsAdded}`);
  lines.push(`  skipped: ${plan.skipped.length}`);
  lines.push(`Roles ${dry ? "to add" : "added"}: ${written?.roles ?? plan.roles.length}`);
  for (const r of plan.roles) lines.push(`  ${r.at.sheet} row ${r.at.row}: ${yearName(r.year)}, ${unit(r.deptId, r.division)}`);
  lines.push(`Rows skipped, by row: ${plan.skipped.length}`);
  for (const s of plan.skipped) lines.push(`  [${s.kind}] ${s.at.sheet} row ${s.at.row}${s.field === undefined ? "" : ` › field ${s.field}`}: ${SKIP_TEXT[s.kind]}`);
  lines.push(`Dates read with day and month swapped: ${plan.swapped.length}`);
  for (const s of plan.swapped) lines.push(`  ${s.at.sheet} row ${s.at.row} › field ${s.field}`);

  lines.push("", "Part 2: propulsion lineage");
  lines.push(
    `Lineage departments: ${plan.lineage.departments.map((d) => d.name).join(", ")}; up to 2023-2024 under ${plan.lineage.early.name}, from 2024-2025 under ${plan.lineage.late.name}`,
  );
  lines.push(`Roles ${dry ? "to move" : "moved"}: ${written?.moves ?? plan.moves.length}`);
  const groups = new Map<string, number>();
  for (const m of plan.moves) {
    const key = `${yearName(m.year)}: ${unit(m.from.deptId, m.from.divisionId === null ? null : { kind: "existing", id: m.from.divisionId })} → ${unit(m.deptId, m.division)}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...groups].sort(([a], [b]) => a.localeCompare(b))) lines.push(`  ${key}: ${n} ${n === 1 ? "role" : "roles"}`);
  lines.push(`Divisions ${dry ? "to create" : "created"}, closed: ${written?.divisions ?? plan.divisions.length}`);
  for (const d of plan.divisions) {
    lines.push(`  division ${d.code === null ? d.name : `${d.name} (${d.code})`} under ${departmentName(d.deptId)}: closed, ${d.startedAt} to ${d.closedAt}`);
  }
  lines.push(`Lineage roles left where they are: ${plan.left.length}`);
  const left = new Map<string, number>();
  for (const l of plan.left) {
    const key = `[${l.reason}] ${yearName(l.year)}: ${LEFT_TEXT[l.reason]}`;
    left.set(key, (left.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...left].sort(([a], [b]) => a.localeCompare(b))) lines.push(`  ${key}: ${n}`);
  return `${lines.join("\n")}\n`;
}
