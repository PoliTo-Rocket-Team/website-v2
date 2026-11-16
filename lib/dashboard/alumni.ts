import { shortAcademicYearLabel } from "@/lib/about/academic-year-copy";
import {
  ADVISORS,
  addedGroup,
  changesNothing,
  type AddedYear,
  type Alumnus,
  type AlumnusKey,
  type LineSource,
  type Mark,
  type Rank,
  type RecordUnits,
  type RoleFix,
  type UnitRef,
} from "@/lib/about/alumni-record";
import type { FounderMark } from "@/lib/about/alumni-types";
import { refused, written, type WriteResult } from "./write";

// The dashboard's Alumni page (boards 78, 78b and 78c, issue #257): everyone
// the public Alumni page can list, current members in their past years
// included (#982), filled in from the team's roles, the one-time import and
// the advisors added here. An editor fixes how someone
// shows (name, founder mark, photo, per-year role text, years the record
// lacks, shown or hidden) or adds an external advisor. A fix is an alumni entry: it never writes a
// role, a division or access (lib/about/alumni-record.ts).

/** One person in one group of one year, as the fix panel lists them (board 78b). */
export type AlumnusYear = {
  /** The year the page lists it in. */
  readonly year: number;
  /** The group the page lists it in. */
  readonly group: string;
  /** What the record prints. */
  readonly recordRole: string;
  /** What the page prints. */
  readonly role: string;
  /** How the page marks them (issue #1006): the record's rank, or the mark an editor chose. */
  readonly rank: Rank;
  /**
   * A record line, with what the record says and the fix over it: its text,
   * year, unit and mark are edited, and an undo returns it to the record
   * (issue #1006). Or a year added for the page only (issue #981), edited the
   * same way and removed.
   */
  readonly source: LineSource;
};

/** A department or division, current or closed, that "+ Add a year" offers (issue #981). */
export type AlumniUnit = {
  readonly ref: UnitRef;
  readonly name: string;
  /** The department a division sits in; null for a department, or a division in none. */
  readonly under: string | null;
  readonly closed: boolean;
  /** The group a year in this unit sits in on the page: a division's department. */
  readonly group: string;
};

/** A row of board 78. */
export type AlumnusRow = {
  readonly key: AlumnusKey;
  readonly kind: Alumnus["kind"];
  readonly name: string;
  /** The name on the record, under "Name on the page" in the fix panel. */
  readonly recordName: string;
  readonly email: string | null;
  readonly photo: string | null;
  readonly founder: FounderMark | null;
  /** The page shows another name than the record's: the "Name fixed" tag. */
  readonly nameFixed: boolean;
  /** A year's text, year, unit or mark was fixed: the "Role fixed" tag. */
  readonly roleFixed: boolean;
  readonly shown: boolean;
  /** The record's title in their latest year: "Head of Structures". */
  readonly lastRole: string;
  /** Under it: the division, department or group. */
  readonly lastUnit: string;
  /** "2021 – 2023": the first academic year's start and the last one's end. */
  readonly from: number;
  /** Null while they still hold a role: a current member, listed in their past years (#982). */
  readonly to: number | null;
  /** The academic years they are listed in, newest first. */
  readonly years: readonly number[];
  /** The groups they are in, any year: the department filter. */
  readonly groups: readonly string[];
  /** Newest year first. */
  readonly lines: readonly AlumnusYear[];
};

export type AlumniDirectory = {
  readonly rows: readonly AlumnusRow[];
  /** Every finished year someone is listed in, newest first: the year tabs. */
  readonly years: readonly number[];
  readonly groups: readonly string[];
  /** This academic year: the last one Add advisor offers. */
  readonly thisYear: number;
  /** The units "+ Add a year" offers: the departments, then the divisions. */
  readonly units: readonly AlumniUnit[];
};

/** Every department, then every division, closed ones included, as "+ Add a year" offers them. */
export function alumniUnits(units: RecordUnits): AlumniUnit[] {
  const departmentName = (id: number | null) => units.departments.find((d) => d.id === id)?.name ?? null;
  const unit = (ref: UnitRef, name: string, under: string | null, closed: boolean | undefined): AlumniUnit[] => {
    const group = addedGroup(ref, units);
    return group === null ? [] : [{ ref, name, under, closed: closed === true, group }];
  };
  return [
    ...units.departments.flatMap((d) => unit({ kind: "department", id: d.id }, d.name, null, d.closed)),
    ...units.divisions.flatMap((d) => unit({ kind: "division", id: d.id }, d.name, departmentName(d.departmentId), d.closed)),
  ];
}

export function alumnusRow(a: Alumnus): AlumnusRow {
  const newestFirst = [...a.lines].reverse();
  const last = newestFirst[0]!;
  const years = [...new Set(newestFirst.map((l) => l.year))];
  return {
    key: a.key,
    kind: a.kind,
    name: a.name,
    recordName: a.recordName,
    email: a.email,
    photo: a.photo,
    founder: a.founder,
    nameFixed: a.name !== a.recordName,
    roleFixed: a.lines.some((l) => l.source.kind === "record" && l.source.fix !== null),
    shown: a.shown,
    lastRole: last.title,
    lastUnit: last.unit,
    from: a.lines[0].year,
    to: a.onTeam ? null : last.year + 1,
    years,
    groups: [...new Set(a.lines.map((l) => l.group))],
    lines: newestFirst.map(({ year, group, recordRole, role, rank, source }) => ({ year, group, recordRole, role, rank, source })),
  };
}

/** "2021 – 2024", or "2022 – now" for someone still on the team. */
export function spanOf(row: Pick<AlumnusRow, "from" | "to">): string {
  return `${row.from} – ${row.to ?? "now"}`;
}

/**
 * Whether board 78 lists them: never someone who asked to be removed. Anyone
 * who left the team is listed, even if they left during this year and the
 * page shows none of their years yet. A current member is listed when the
 * public page can show them (#982): in a finished year, as `alumniYears`
 * lists them, or in The founders, as `foundersOf` does.
 */
export function inAlumniDirectory(a: Alumnus, thisYear: number): boolean {
  if (a.removed) return false;
  return !a.onTeam || a.founder !== null || a.lines.some((line) => line.year < thisYear);
}

/**
 * Board 78's rows, as one list with no pages (#982): everyone
 * `inAlumniDirectory` keeps, shown or hidden. The latest years first, then by
 * name. The year and group filters come from these rows only. The year filter
 * offers finished years only, as the public page's tabs do (#391): someone
 * who left during this year stays in the list, under All years.
 */
export function alumniDirectory(alumni: readonly Alumnus[], thisYear: number, units: RecordUnits): AlumniDirectory {
  const rows = alumni
    .filter((a) => inAlumniDirectory(a, thisYear))
    .map(alumnusRow)
    .sort((a, b) => b.years[0]! - a.years[0]! || b.from - a.from || a.name.localeCompare(b.name));
  return {
    rows,
    years: [...new Set(rows.flatMap((r) => r.years))].filter((year) => year < thisYear).sort((a, b) => b - a),
    groups: [...new Set(rows.flatMap((r) => r.groups))].sort((a, b) => a.localeCompare(b)),
    thisYear,
    units: alumniUnits(units),
  };
}

/** "2024–25", as the year tabs print a year: the shared short label (issue #515). */
export function yearTab(start: number): string {
  return shortAcademicYearLabel(start);
}

/** How many years get their own tab beside "All years"; the older ones sit under "Earlier". */
export const RECENT_YEAR_TABS = 2;

export type AlumniFilter = {
  /** An academic year they are listed in, or null for all years. */
  readonly year: number | null;
  /** A group they are in, or null for all. */
  readonly group: string | null;
  readonly query: string;
};

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** The rows that match: in the year, in the group (that year, when a year is picked), and every word of the search in a name or the email. */
export function alumniRowsFor(rows: readonly AlumnusRow[], filter: AlumniFilter): AlumnusRow[] {
  const words = fold(filter.query).split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.year !== null && !row.years.includes(filter.year)) return false;
    if (filter.group !== null && !row.lines.some((l) => l.group === filter.group && (filter.year === null || l.year === filter.year))) return false;
    const text = fold([row.name, row.recordName, row.email ?? ""].join(" "));
    return words.every((w) => text.includes(w));
  });
}

// The fix panel (board 78b)

/** What Save in the fix panel asks for. Leaving a field as the record has it keeps no fix. */
export type AlumnusFix = {
  readonly shown: boolean;
  /** Null shows the record's name. */
  readonly name: string | null;
  readonly founder: FounderMark | null;
  /** Only the years whose text differs from the record. */
  readonly fixes: readonly RoleFix[];
  /** Every year added for the page only (issue #981): the whole list replaces the stored one. */
  readonly added: readonly AddedYear[];
};

/** What the fix panel's added years are checked against: the record's units and this academic year. */
export type AddedYearGround = { readonly units: RecordUnits; readonly thisYear: number };

export const MAX_ALUMNI_NAME = 120;
export const MAX_ALUMNI_ROLE = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function founderOf(value: unknown): FounderMark | null | undefined {
  if (value === null || value === "no") return null;
  return value === "founder" || value === "co-founder" ? value : undefined;
}

function unitRefOf(value: unknown): UnitRef | null {
  if (!isRecord(value) || !Number.isInteger(value.id)) return null;
  const id = value.id as number;
  return value.kind === "department" || value.kind === "division" ? { kind: value.kind, id } : null;
}

/** The marks the fix panel offers (issue #1006), in its order. */
export const MARKS: readonly Mark[] = ["member", "lead", "head"];

function markOf(value: unknown): Mark | undefined {
  return MARKS.find((mark) => mark === value);
}

const CHECK_THE_FORM = refused("Check the form.");

/** A year the panel's year selects offer, or the refusal when it is not one. */
function yearRefusal(year: number, ground: AddedYearGround): string | null {
  return year >= FIRST_ALUMNI_YEAR && year <= ground.thisYear ? null : `Pick a year from ${yearTab(FIRST_ALUMNI_YEAR)} to this one.`;
}

const UNKNOWN_UNIT = "That department or division is not on the team record.";

/** The years and groups the page lists someone in, so no two of their lines share one. */
class Slots {
  private readonly taken = new Set<string>();

  /** Takes the slot; the refusal when a line already holds it. */
  take(year: number, group: string): string | null {
    const key = `${year}\u0000${group}`;
    if (this.taken.has(key)) return `They already have ${yearTab(year)} in ${group}.`;
    this.taken.add(key);
    return null;
  }
}

/**
 * One record row of the fix panel's form, keyed by the year and group the
 * record gives it. Text equal to the record's, or empty, keeps no text fix;
 * the record's year, or the record's rank as the mark, keeps none either.
 * A unit moves the line into that department or division (issue #1006).
 */
function checkRecordRow(raw: unknown, recordLines: readonly AlumnusYear[], ground: AddedYearGround): WriteResult<RoleFix | null> {
  if (!isRecord(raw) || !Number.isInteger(raw.year) || typeof raw.group !== "string" || typeof raw.role !== "string") return CHECK_THE_FORM;
  const line = recordLines.find((l) => l.source.kind === "record" && l.source.year === raw.year && l.source.group === raw.group);
  if (line === undefined || line.source.kind !== "record") return refused("That year is not on their record.");
  const { source } = line;
  const role = raw.role.trim().replace(/\s+/g, " ");
  if (role.length > MAX_ALUMNI_ROLE) return refused(`A role can be at most ${MAX_ALUMNI_ROLE} characters.`);
  const toYear = raw.toYear ?? null;
  if (toYear !== null && !Number.isInteger(toYear)) return CHECK_THE_FORM;
  const toYearRefusal = toYear === null || toYear === source.year ? null : yearRefusal(toYear as number, ground);
  if (toYearRefusal !== null) return refused(toYearRefusal);
  const toUnit = raw.toUnit === undefined || raw.toUnit === null ? null : unitRefOf(raw.toUnit);
  if (raw.toUnit !== undefined && raw.toUnit !== null && toUnit === null) return CHECK_THE_FORM;
  if (toUnit !== null && addedGroup(toUnit, ground.units) === null) return refused(UNKNOWN_UNIT);
  const mark = raw.mark === undefined || raw.mark === null ? null : markOf(raw.mark);
  if (mark === undefined) return refused("Pick Member, Lead or Head.");
  const fix: RoleFix = {
    year: source.year,
    group: source.group,
    role: role === "" || role === line.recordRole ? null : role,
    toYear: toYear === source.year ? null : (toYear as number | null),
    toUnit,
    mark: mark === source.rank ? null : mark,
  };
  return written(changesNothing(fix) ? null : fix);
}

/**
 * The added years in the fix panel's form (issue #981). Each sits in a
 * department or division the record has, in a year from 2021–22 to this one,
 * with its text and its mark (issue #1006; Member when none is sent).
 */
function checkAddedYear(raw: unknown, ground: AddedYearGround): WriteResult<{ added: AddedYear; group: string }> {
  const unit = isRecord(raw) ? unitRefOf(raw.unit) : null;
  if (!isRecord(raw) || unit === null || !Number.isInteger(raw.year) || typeof raw.role !== "string") return CHECK_THE_FORM;
  const year = raw.year as number;
  const yearRefused = yearRefusal(year, ground);
  if (yearRefused !== null) return refused(yearRefused);
  const group = addedGroup(unit, ground.units);
  if (group === null) return refused(UNKNOWN_UNIT);
  const role = raw.role.trim().replace(/\s+/g, " ");
  if (role === "") return refused("Enter the title for each added year.");
  if (role.length > MAX_ALUMNI_ROLE) return refused(`A role can be at most ${MAX_ALUMNI_ROLE} characters.`);
  const mark = raw.mark === undefined ? "member" : markOf(raw.mark);
  if (mark === undefined) return refused("Pick Member, Lead or Head.");
  return written({ added: { year, unit, role, mark }, group });
}

/**
 * Checks the fix panel's form against the person it was opened on. Each
 * record row must be one of theirs from the record, by the year and group
 * the record gives it; a row left out keeps no fix. The added years are the
 * whole list the page keeps. No two lines may then stand in one group of one
 * year, a record line moved there or an added one: the page would list them
 * twice.
 */
export function checkAlumnusFix(input: unknown, person: Pick<AlumnusRow, "recordName" | "lines">, ground: AddedYearGround): WriteResult<AlumnusFix> {
  if (!isRecord(input) || typeof input.shown !== "boolean" || typeof input.name !== "string" || !Array.isArray(input.roles) || !Array.isArray(input.added)) {
    return CHECK_THE_FORM;
  }
  const founder = founderOf(input.founder);
  if (founder === undefined) return refused("Pick No, Co-founder or Founder.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length > MAX_ALUMNI_NAME) return refused(`The name can be at most ${MAX_ALUMNI_NAME} characters.`);
  const recordLines = person.lines.filter((l) => l.source.kind === "record");
  const fixes: RoleFix[] = [];
  for (const raw of input.roles) {
    const checked = checkRecordRow(raw, recordLines, ground);
    if (!checked.ok) return checked;
    if (checked.value !== null) fixes.push(checked.value);
  }
  const slots = new Slots();
  for (const line of recordLines) {
    if (line.source.kind !== "record") continue;
    const { year, group } = line.source;
    const fix = fixes.find((f) => f.year === year && f.group === group);
    const taken = slots.take(fix?.toYear ?? year, fix?.toUnit ? addedGroup(fix.toUnit, ground.units)! : group);
    if (taken !== null) return refused(taken);
  }
  const added: AddedYear[] = [];
  for (const raw of input.added) {
    const checked = checkAddedYear(raw, ground);
    if (!checked.ok) return checked;
    const taken = slots.take(checked.value.added.year, checked.value.group);
    if (taken !== null) return refused(taken);
    added.push(checked.value.added);
  }
  return written({ shown: input.shown, name: name === "" || name === person.recordName ? null : name, founder, fixes, added });
}

// Add alumni (board 78c)

/** The first academic year a year select offers: the Team's first, 2021–22. */
export const FIRST_ALUMNI_YEAR = 2021;

/**
 * The year "+ Add a year" opens its draft on (issue #992): the year before the
 * earliest one the panel lists, the record's years and the added ones alike,
 * or the year before this one when none is listed. When that falls before
 * 2021–22, the newest year not listed; with every year listed, this year.
 */
export function nextDraftYear(listed: readonly number[], thisYear: number): number {
  const before = Math.min(thisYear, ...listed) - 1;
  if (before >= FIRST_ALUMNI_YEAR) return before;
  for (let year = thisYear; year >= FIRST_ALUMNI_YEAR; year--) if (!listed.includes(year)) return year;
  return thisYear;
}

/** An external advisor, as Add advisor sends them. Always in the Advisors group. */
export type NewAdvisor = {
  readonly name: string;
  readonly role: string;
  readonly from: number;
  readonly to: number;
};

/**
 * Checks Add advisor's form. It adds to the Advisors group and no other:
 * students and former members show from their roles, so a request naming any
 * other group is refused here, on the server, whatever the form sent.
 */
export function checkAdvisor(input: unknown, currentYear: number): WriteResult<NewAdvisor> {
  if (!isRecord(input)) return refused("Check the form.");
  if (input.group !== ADVISORS) return refused("Add alumni adds external advisors to the Advisors group only.");
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const role = typeof input.role === "string" ? input.role.trim().replace(/\s+/g, " ") : "";
  if (name === "") return refused("Enter their full name.");
  if (name.length > MAX_ALUMNI_NAME) return refused(`The name can be at most ${MAX_ALUMNI_NAME} characters.`);
  if (role === "") return refused("Enter their role on the page.");
  if (role.length > MAX_ALUMNI_ROLE) return refused(`The role can be at most ${MAX_ALUMNI_ROLE} characters.`);
  const { from, to } = input;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return refused("Pick the academic years.");
  if ((from as number) < FIRST_ALUMNI_YEAR || (to as number) > currentYear || (from as number) > (to as number)) {
    return refused("Pick years from 2021–22 to this one, the first no later than the last.");
  }
  return written({ name, role, from: from as number, to: to as number });
}
