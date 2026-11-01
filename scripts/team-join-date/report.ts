import type { Plan, SkipKind } from "./plan";
import type { Roster } from "./roster";
import type { Written } from "./write";

// The report a run prints (issue #948): what was read, every join day to store
// by the rows that gave it (month and year only), every row skipped and why,
// and the counts. It prints sheet names, row numbers, months and years only:
// never a person's name, email, phone or ID, and no database id.

const SKIP_TEXT: Readonly<Record<SkipKind, string>> = {
  "date-unreadable": "a date that does not read",
  "dates-out-of-order": "the join day falls after the leave day, and no swap of day and month fixes it",
  "no-email": "the row has no email",
  "no-member": "no member in the database has the row's emails",
  "ambiguous-member": "the row's emails find two members in the database",
  "stored-differs": "the member already has a different join day stored; it is kept",
};

export type ReportInput = {
  readonly mode: "dry-run" | "backfill";
  readonly file: string;
  readonly roster: Roster;
  readonly plan: Plan;
  /** What a real run wrote; absent on a dry run. */
  readonly written?: Written;
};

/** "2023-11" for "2023-11-15": the month and year the Overview shows. */
const monthOf = (day: string) => day.slice(0, 7);

export function renderReport({ file, roster, plan, written }: ReportInput): string {
  const dry = written === undefined;
  const lines: string[] = [];
  lines.push(`Team join date backfill (issue #948): ${dry ? "dry run, nothing written" : "real run"}`);
  lines.push(`Workbook: ${file}`);
  lines.push(`Read (sheets with a "Joined the Team on" column): ${roster.read.length === 0 ? "none" : roster.read.join(", ")}`);
  if (roster.skipped.length > 0) lines.push(`Not read: ${roster.skipped.join("; ")}`);
  lines.push(`Sheet rows with no name, left out: ${roster.namelessRows}`);
  lines.push(`Rows read: ${roster.rows.length}`);
  lines.push(`  with no join date: ${plan.noJoinDate}`);
  lines.push(`  whose member already holds that join day: ${plan.alreadyStored}`);
  lines.push(`  skipped: ${plan.skipped.length}`);
  lines.push(`Members ${dry ? "to date" : "dated"}: ${written?.members ?? plan.sets.length}`);
  for (const s of plan.sets) lines.push(`  ${s.rows.map((at) => `${at.sheet} row ${at.row}`).join(", ")}: ${monthOf(s.day)}`);
  lines.push(`Members several rows with different join days find (the earliest kept): ${plan.severalDays}`);
  lines.push(`Rows skipped, by row: ${plan.skipped.length}`);
  for (const s of plan.skipped) lines.push(`  [${s.kind}] ${s.at.sheet} row ${s.at.row}${s.field === undefined ? "" : ` › field ${s.field}`}: ${SKIP_TEXT[s.kind]}`);
  lines.push(`Join days read with day and month swapped: ${plan.swapped.length}`);
  for (const at of plan.swapped) lines.push(`  ${at.sheet} row ${at.row} › field joinedOn`);
  return `${lines.join("\n")}\n`;
}
