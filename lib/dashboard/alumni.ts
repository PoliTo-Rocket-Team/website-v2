import { shortAcademicYearLabel } from "@/lib/about/academic-year-copy";
import {
  ADVISORS,
  addedGroup,
  type AddedYear,
  type Alumnus,
  type AlumnusKey,
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
  readonly year: number;
  /** The group from the record, read-only. */
  readonly group: string;
  /** What the record prints. */
  readonly recordRole: string;
  /** What the page prints. */
  readonly role: string;
  /**
   * A year added for the page only (issue #981): the unit it was added in.
   * Its text is edited and the row removed in the fix panel. Null for a year
   * from the record, which can only be retitled.
   */
  readonly added: UnitRef | null;
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
  /** A year's role text was fixed: the "Role fixed" tag. */
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
    roleFixed: a.lines.some((l) => l.fixed),
    shown: a.shown,
    lastRole: last.title,
    lastUnit: last.unit,
    from: a.lines[0].year,
    to: a.onTeam ? null : last.year + 1,
    years,
    groups: [...new Set(a.lines.map((l) => l.group))],
    lines: newestFirst.map(({ year, group, recordRole, role, added }) => ({ year, group, recordRole, role, added })),
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

/**
 * The added years in the fix panel's form (issue #981). Each sits in a
 * department or division the record has, in a year from 2021–22 to this one,
 * with its text. A year may not stand in a group the person already has that
 * year, from the record or added twice: the page would list them twice.
 */
function checkAddedYears(input: unknown, recordLines: readonly AlumnusYear[], ground: AddedYearGround): WriteResult<AddedYear[]> {
  if (!Array.isArray(input)) return refused("Check the form.");
  const taken = new Set(recordLines.map((l) => `${l.year}\u0000${l.group}`));
  const added: AddedYear[] = [];
  for (const raw of input) {
    const unit = isRecord(raw) ? unitRefOf(raw.unit) : null;
    if (!isRecord(raw) || unit === null || !Number.isInteger(raw.year) || typeof raw.role !== "string") return refused("Check the form.");
    const year = raw.year as number;
    if (year < FIRST_ALUMNI_YEAR || year > ground.thisYear) return refused(`Pick a year from ${yearTab(FIRST_ALUMNI_YEAR)} to this one.`);
    const group = addedGroup(unit, ground.units);
    if (group === null) return refused("That department or division is not on the team record.");
    const role = raw.role.trim().replace(/\s+/g, " ");
    if (role === "") return refused("Enter the title for each added year.");
    if (role.length > MAX_ALUMNI_ROLE) return refused(`A role can be at most ${MAX_ALUMNI_ROLE} characters.`);
    const key = `${year}\u0000${group}`;
    if (taken.has(key)) return refused(`They already have ${yearTab(year)} in ${group}.`);
    taken.add(key);
    added.push({ year, unit, role });
  }
  return written(added);
}

/**
 * Checks the fix panel's form against the person it was opened on. Each
 * year's role must be one of theirs from the record; text equal to the
 * record's, or empty, keeps no fix. The group is never taken from the form:
 * it is the record's. The added years are the whole list the page keeps.
 */
export function checkAlumnusFix(input: unknown, person: Pick<AlumnusRow, "recordName" | "lines">, ground: AddedYearGround): WriteResult<AlumnusFix> {
  if (!isRecord(input) || typeof input.shown !== "boolean" || typeof input.name !== "string" || !Array.isArray(input.roles)) {
    return refused("Check the form.");
  }
  const founder = founderOf(input.founder);
  if (founder === undefined) return refused("Pick No, Co-founder or Founder.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length > MAX_ALUMNI_NAME) return refused(`The name can be at most ${MAX_ALUMNI_NAME} characters.`);
  const recordLines = person.lines.filter((l) => l.added === null);
  const fixes: RoleFix[] = [];
  for (const raw of input.roles) {
    if (!isRecord(raw) || !Number.isInteger(raw.year) || typeof raw.group !== "string" || typeof raw.role !== "string") {
      return refused("Check the form.");
    }
    const line = recordLines.find((l) => l.year === raw.year && l.group === raw.group);
    if (line === undefined) return refused("That year is not on their record.");
    const role = raw.role.trim().replace(/\s+/g, " ");
    if (role.length > MAX_ALUMNI_ROLE) return refused(`A role can be at most ${MAX_ALUMNI_ROLE} characters.`);
    if (role !== "" && role !== line.recordRole) fixes.push({ year: line.year, group: line.group, role });
  }
  const added = checkAddedYears(input.added, recordLines, ground);
  if (!added.ok) return added;
  return written({ shown: input.shown, name: name === "" || name === person.recordName ? null : name, founder, fixes, added: added.value });
}

// Add alumni (board 78c)

/** The first academic year a year select offers: the Team's first, 2021–22. */
export const FIRST_ALUMNI_YEAR = 2021;

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
