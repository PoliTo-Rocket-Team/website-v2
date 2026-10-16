import { ADVISORS, type Alumnus, type AlumnusKey, type RoleFix } from "@/lib/about/alumni-record";
import type { FounderMark } from "@/lib/about/alumni-types";
import { refused, written, type WriteResult } from "./write";

// The dashboard's Alumni page (boards 78, 78b and 78c, issue #257): everyone
// the public Alumni page can list, filled in from the team's roles, the
// one-time import and the advisors added here. An editor fixes how someone
// shows (name, founder mark, photo, per-year role text, shown or hidden) or
// adds an external advisor. A fix is an alumni entry: it never writes a
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
  readonly to: number;
  /** The academic years they are listed in, newest first. */
  readonly years: readonly number[];
  /** The groups they are in, any year: the department filter. */
  readonly groups: readonly string[];
  /** Newest year first. */
  readonly lines: readonly AlumnusYear[];
};

export type AlumniDirectory = {
  readonly rows: readonly AlumnusRow[];
  /** Every year someone is listed in, newest first. */
  readonly years: readonly number[];
  readonly groups: readonly string[];
  /** This academic year: the last one Add advisor offers. */
  readonly thisYear: number;
};

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
    to: last.year + 1,
    years,
    groups: [...new Set(a.lines.map((l) => l.group))],
    lines: newestFirst.map(({ year, group, recordRole, role }) => ({ year, group, recordRole, role })),
  };
}

/**
 * Board 78's rows: everyone the page can list, but never someone who asked to
 * be removed. The latest years first, then by name.
 */
export function alumniDirectory(alumni: readonly Alumnus[], thisYear: number): AlumniDirectory {
  const rows = alumni
    .filter((a) => !a.removed)
    .map(alumnusRow)
    .sort((a, b) => b.to - a.to || b.from - a.from || a.name.localeCompare(b.name));
  return {
    rows,
    years: [...new Set(rows.flatMap((r) => r.years))].sort((a, b) => b - a),
    groups: [...new Set(rows.flatMap((r) => r.groups))].sort((a, b) => a.localeCompare(b)),
    thisYear,
  };
}

/** "2024–25", as the year tabs print a year. */
export function yearTab(start: number): string {
  return `${start}–${String((start + 1) % 100).padStart(2, "0")}`;
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
};

export const MAX_ALUMNI_NAME = 120;
export const MAX_ALUMNI_ROLE = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function founderOf(value: unknown): FounderMark | null | undefined {
  if (value === null || value === "no") return null;
  return value === "founder" || value === "co-founder" ? value : undefined;
}

/**
 * Checks the fix panel's form against the person it was opened on. Each
 * year's role must be one of theirs; text equal to the record's, or empty,
 * keeps no fix. The group is never taken from the form: it is the record's.
 */
export function checkAlumnusFix(input: unknown, person: Pick<AlumnusRow, "recordName" | "lines">): WriteResult<AlumnusFix> {
  if (!isRecord(input) || typeof input.shown !== "boolean" || typeof input.name !== "string" || !Array.isArray(input.roles)) {
    return refused("Check the form.");
  }
  const founder = founderOf(input.founder);
  if (founder === undefined) return refused("Pick No, Co-founder or Founder.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length > MAX_ALUMNI_NAME) return refused(`The name can be at most ${MAX_ALUMNI_NAME} characters.`);
  const fixes: RoleFix[] = [];
  for (const raw of input.roles) {
    if (!isRecord(raw) || !Number.isInteger(raw.year) || typeof raw.group !== "string" || typeof raw.role !== "string") {
      return refused("Check the form.");
    }
    const line = person.lines.find((l) => l.year === raw.year && l.group === raw.group);
    if (line === undefined) return refused("That year is not on their record.");
    const role = raw.role.trim().replace(/\s+/g, " ");
    if (role.length > MAX_ALUMNI_ROLE) return refused(`A role can be at most ${MAX_ALUMNI_ROLE} characters.`);
    if (role !== "" && role !== line.recordRole) fixes.push({ year: line.year, group: line.group, role });
  }
  return written({ shown: input.shown, name: name === "" || name === person.recordName ? null : name, founder, fixes });
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
