import type { AcademicYear, Entry, Founder, FounderMark, NonEmpty, ShownGroup, Tag } from "./alumni-types";
import { leadsByRole } from "./alumni-year";

// The Alumni page built from the team record (issue #257). Each academic
// year lists who held which role in which department or division, from each
// role's start and end dates; closed divisions and departments stay as names.
// The years before the record held roles come from a one-time import
// (./alumni-import.ts). An alumni entry holds only how someone shows on the
// page: a fixed name, the founder mark, a photo, per-year role text, year,
// unit and mark (#1006), years added for the page only (#981), shown or
// hidden, and whether they asked to be removed. Nothing here changes a role,
// a division or access: a fix is an entry, laid over the record at read time.
// Both data sides hand an AlumniRecord to these functions.

/** The role types the `roles` table holds; an `advisor` (issue #253) ranks as a member. */
export type RoleType = "president" | "head" | "lead" | "core" | "advisor" | null;

/** One `roles` row, active or ended. */
export type RecordRole = {
  readonly memberId: number;
  readonly type: RoleType;
  readonly title: string;
  /** "2024-10-01" */
  readonly startedAt: string;
  /** The day it ended; null while it is held. */
  readonly leftAt: string | null;
  readonly departmentId: number | null;
  readonly divisionId: number | null;
};

/** Every department and division, closed ones included: a closed one stays as a name. */
export type RecordUnits = {
  /** In the order the page draws them. */
  readonly departments: readonly { readonly id: number; readonly name: string; readonly closed?: boolean }[];
  readonly divisions: readonly { readonly id: number; readonly name: string; readonly departmentId: number | null; readonly closed?: boolean }[];
};

/** One department or division of the record, current or closed, by its id. */
export type UnitRef = { readonly kind: "department"; readonly id: number } | { readonly kind: "division"; readonly id: number };

/**
 * How the page marks someone in one group of one year (issue #1006): a
 * Head or Lead gets the tag beside the name and the title in accent.
 */
export type Mark = "member" | "lead" | "head";

/**
 * A year an editor added for the Alumni page only (issue #981): the record
 * holds no role for it, as for an early year that was never imported. It
 * lists the person in `unit` that year with `role` as the text and `mark` as
 * the mark, and changes no role, date or division.
 */
export type AddedYear = { readonly year: number; readonly unit: UnitRef; readonly role: string; readonly mark: Mark };

/**
 * A member's name and email on the team record; the name is null once their
 * account was anonymized. `picture` is the photo they stored on their member
 * row (`members.picture`), absent when they have none.
 */
export type RecordPerson = {
  readonly memberId: number;
  readonly name: string | null;
  readonly email: string | null;
  readonly picture?: string;
};

/**
 * How the page shows one record line: one person's role in one group of one
 * year, keyed by the `year` and `group` the record gives it (board 78b). Each
 * part left null shows what the record says: `role` is the text, `toYear` and
 * `toUnit` move the line to another academic year or unit, and `mark` sets
 * the mark (issue #1006). None of it changes a role.
 */
export type RoleFix = {
  readonly year: number;
  readonly group: string;
  readonly role: string | null;
  readonly toYear: number | null;
  readonly toUnit: UnitRef | null;
  readonly mark: Mark | null;
};

/** A line fix with every part as the record has it: what a fix that changes nothing would be. */
export function changesNothing(fix: Pick<RoleFix, "role" | "toYear" | "toUnit" | "mark">): boolean {
  return fix.role === null && fix.toYear === null && fix.toUnit === null && fix.mark === null;
}

/** Who an alumni entry is about. */
export type EntryWho =
  /** A member of the team record. `keptName` is the record's name, kept when their account was anonymized. */
  | { readonly kind: "member"; readonly memberId: number; readonly keptName: string | null }
  /** Someone from the one-time import, by the name it gave. */
  | { readonly kind: "imported"; readonly name: string }
  /** An external advisor added on board 78c: always in the Advisors group, from `from` to `to`. */
  | { readonly kind: "advisor"; readonly name: string; readonly role: string; readonly from: number; readonly to: number };

/** How one person shows on the Alumni page. */
export type AlumniEntry = {
  readonly id: number;
  readonly who: EntryWho;
  /** The name an editor fixed for the page; null shows the record's. */
  readonly name: string | null;
  readonly founder: FounderMark | null;
  /** A photo in public/team/, or a public store URL. */
  readonly photo: string | null;
  readonly shown: boolean;
  /** They ticked "Remove my name from the Alumni page" (boards 55b, 55c). */
  readonly removed: boolean;
  readonly fixes: readonly RoleFix[];
  /** Years added for the page only (issue #981). */
  readonly added: readonly AddedYear[];
};

/** One line of an imported year, in the import's own group. `position` keeps the import's order. */
export type ImportedLine = {
  readonly entryId: number;
  readonly year: number;
  readonly group: string;
  readonly role: string;
  readonly position: number;
};

export type AlumniRecord = {
  readonly units: RecordUnits;
  readonly roles: readonly RecordRole[];
  readonly people: readonly RecordPerson[];
  readonly entries: readonly AlumniEntry[];
  readonly imported: readonly ImportedLine[];
};

export const LEADERSHIP = "Leadership";
export const ADVISORS = "Advisors";

/** A person's key: `m12` is member 12, whether or not they have an entry yet; `e5` is the imported or added entry 5. */
export type AlumnusKey = `m${number}` | `e${number}`;

export function parseAlumnusKey(value: unknown): AlumnusKey | null {
  return typeof value === "string" && /^[me][1-9]\d{0,9}$/.test(value) ? (value as AlumnusKey) : null;
}

/** What kind of group a line sits in: departments count their people, Advisors fold after two rows. */
export type GroupKind = "leadership" | "department" | "imported" | "advisors";

/** `leader` is the team leader (a `president` role): always first under Leadership (#391). */
export type Rank = "leader" | "head" | "lead" | "member";

/**
 * Where a line comes from. A record line keeps the year, group, kind of
 * group, unit and rank the record gives it, which its fix is keyed by and an
 * undo returns it to, and the fix laid over it, if any. A year added for the
 * page only (issue #981) keeps the unit it was added in.
 */
export type LineSource =
  | {
      readonly kind: "record";
      readonly year: number;
      readonly group: string;
      readonly groupKind: GroupKind;
      readonly unit: string;
      readonly rank: Rank;
      readonly fix: RoleFix | null;
    }
  | { readonly kind: "added"; readonly unit: UnitRef };

/**
 * The mark the page shows a record line when no mark is chosen (issue #1006):
 * in a department, the record's rank; in any other group none of the three,
 * since the title decides who leads there. A line moved into a unit sits in a
 * department group. A mark the editor picks that differs from this one is
 * kept, so the page always shows it.
 */
export function unchosenMark(source: Pick<Extract<LineSource, { kind: "record" }>, "groupKind" | "rank">, toUnit: UnitRef | null): Mark | null {
  const kind = toUnit === null ? source.groupKind : "department";
  return kind === "department" && source.rank !== "leader" ? source.rank : null;
}

/** One person in one group of one academic year. */
export type AlumnusLine = {
  /** The year the page lists it in: the record's, or the one an editor moved it to. */
  readonly year: number;
  readonly group: string;
  readonly kind: GroupKind;
  /** Where the group sits in its year: lower first. */
  readonly order: number;
  /** The record's rank, or the mark an editor chose (issue #1006). */
  readonly rank: Rank;
  /** An editor chose the mark, so the page shows it in any group, not only a department. */
  readonly marked: boolean;
  /** The record's title that year: "Head of Structures". Several roles in one group read "A · B". */
  readonly title: string;
  /** The unit under the title on the dashboard: the division, else the department or group. */
  readonly unit: string;
  /** What the page prints from the record: a division lead's division, else the title. */
  readonly recordRole: string;
  /** What the page prints: the fixed text, else `recordRole`. */
  readonly role: string;
  readonly source: LineSource;
};

/** One person as the page and the dashboard read them: the record with their entry laid over it. */
export type Alumnus = {
  readonly key: AlumnusKey;
  readonly kind: EntryWho["kind"];
  /** The name on the team record, or the import's, or the one the advisor was added with. */
  readonly recordName: string;
  /** The name on the page. */
  readonly name: string;
  readonly email: string | null;
  readonly founder: FounderMark | null;
  readonly photo: string | null;
  /** The photo a member stored on their member row; null for anyone else, or a member with none. */
  readonly picture: string | null;
  readonly shown: boolean;
  readonly removed: boolean;
  /**
   * A member who still holds a role (one with no `leftAt`). The public page
   * lists them in their finished years like anyone else, and so does the
   * dashboard's Alumni list, marked as still on the team (#982).
   * Imported people and advisors are never on the team.
   */
  readonly onTeam: boolean;
  /** Oldest year first, then in group order. */
  readonly lines: NonEmpty<AlumnusLine>;
  /**
   * Lines the page cannot list: a moved line or an added year that stands in
   * a group of a year where another of their lines already does, for example
   * once the record gains a role there. The fix panel still lists them, so
   * the editor can move or undo them (issue #1006).
   */
  readonly clashing: readonly AlumnusLine[];
};

/** The academic year a day falls in: it runs from 1 October, so "2026-10-01" is 2026–27. */
export function academicYearOfDay(day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  return month >= 10 ? year : year - 1;
}

const RANK_ORDER: Readonly<Record<Rank, number>> = { leader: 0, head: 1, lead: 2, member: 3 };
const LEADERSHIP_ORDER = 0;
const IMPORTED_ORDER = 100;
const DEPARTMENT_ORDER = 1000;
const ADVISORS_ORDER = 1_000_000;

type LineBase = Omit<AlumnusLine, "year" | "role" | "marked" | "source">;

/**
 * Where one role puts its holder on the page, every year it was held. An
 * advisor sits in the department or division they advised that year; one
 * with neither sits in Advisors (#391).
 */
function roleBase(role: Pick<RecordRole, "type" | "title" | "departmentId" | "divisionId">, units: RecordUnits): LineBase {
  const division = units.divisions.find((d) => d.id === role.divisionId);
  const departmentId = role.departmentId ?? division?.departmentId ?? null;
  const departmentAt = units.departments.findIndex((d) => d.id === departmentId);
  const department = units.departments[departmentAt];
  const rank: Rank = role.type === "president" ? "leader" : role.type === "head" ? "head" : role.type === "lead" ? "lead" : "member";
  const title = role.title.trim() || "Member";
  const inNoUnit = department === undefined && division === undefined;
  if (role.type === "advisor" && inNoUnit) {
    return { group: ADVISORS, kind: "advisors", order: ADVISORS_ORDER, rank, title, unit: ADVISORS, recordRole: title };
  }
  if (role.type === "president" || inNoUnit) {
    return { group: LEADERSHIP, kind: "leadership", order: LEADERSHIP_ORDER, rank, title, unit: "Board", recordRole: title };
  }
  const group = department?.name ?? division!.name;
  const order =
    department !== undefined
      ? DEPARTMENT_ORDER + departmentAt
      : DEPARTMENT_ORDER + units.departments.length + units.divisions.indexOf(division!);
  const recordRole = rank === "lead" && division !== undefined ? division.name : title;
  return { group, kind: "department", order, rank, title, unit: division?.name ?? group, recordRole };
}

/** The academic years a role was held in, up to this one. */
function yearsOf(role: RecordRole, currentYear: number): number[] {
  const from = academicYearOfDay(role.startedAt);
  const to = Math.min(role.leftAt === null ? currentYear : academicYearOfDay(role.leftAt), currentYear);
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/** Two of one person's roles in one group of one year read as one line: the higher rank, both titles. */
function merged(a: LineBase, b: LineBase): LineBase {
  const [high, low] = RANK_ORDER[b.rank] < RANK_ORDER[a.rank] ? [b, a] : [a, b];
  const join = (x: string, y: string) => (x.split(" · ").includes(y) ? x : `${x} · ${y}`);
  return { ...high, title: join(high.title, low.title), recordRole: join(high.recordRole, low.recordRole), order: Math.min(a.order, b.order) };
}

/** One line as the record gives it, before any fix. */
type RecordLine = { readonly year: number; readonly base: LineBase };

/**
 * A record line with its fix laid over it: the text, the year and unit it was
 * moved to, and the mark (issue #1006). A moved line keeps the record's rank,
 * title and text; it takes the group, order and unit of where it moved.
 */
function withFix({ year, base }: RecordLine, fixes: readonly RoleFix[], units: RecordUnits): AlumnusLine {
  const fix = fixes.find((f) => f.year === year && f.group === base.group) ?? null;
  const moved = fix === null || fix.toUnit === null ? null : addedBase(fix.toUnit, base.title, units);
  const placed: LineBase = moved === null ? base : { ...base, group: moved.group, kind: moved.kind, order: moved.order, unit: moved.unit };
  return {
    ...placed,
    year: fix?.toYear ?? year,
    rank: fix?.mark ?? base.rank,
    marked: fix !== null && fix.mark !== null,
    role: fix?.role ?? base.recordRole,
    source: { kind: "record", year, group: base.group, groupKind: base.kind, unit: base.unit, rank: base.rank, fix },
  };
}

/**
 * Where an added year's unit puts the person: as a member of that department
 * or division, in the group its record roles would sit in. Null once the
 * record no longer has the unit.
 */
function addedBase(unit: UnitRef, title: string, units: RecordUnits): LineBase | null {
  const known = unit.kind === "department" ? units.departments.some((d) => d.id === unit.id) : units.divisions.some((d) => d.id === unit.id);
  if (!known) return null;
  const at = unit.kind === "department" ? { departmentId: unit.id, divisionId: null } : { departmentId: null, divisionId: unit.id };
  return roleBase({ type: null, title, ...at }, units);
}

/** The group an added year in `unit` sits in on the page; null when the record has no such unit. */
export function addedGroup(unit: UnitRef, units: RecordUnits): string | null {
  return addedBase(unit, "", units)?.group ?? null;
}

function moved(line: AlumnusLine): boolean {
  return line.source.kind === "record" && (line.year !== line.source.year || line.group !== line.source.group);
}

/** A person's lines: what the page lists, and the ones it cannot (`Alumnus.clashing`). */
type Layout = { readonly lines: AlumnusLine[]; readonly clashing: AlumnusLine[] };

/**
 * The record's lines with their fixes, then the added years (issue #981).
 * A line an editor moved, or a year added, never stands in a group of a year
 * where a line before it already lists them: the record's own line wins, then
 * a moved one, so a role added to the record later is never listed twice.
 * The line that loses is kept apart, never dropped, so its fix stays in reach.
 */
function laidOut(record: readonly RecordLine[], fixes: readonly RoleFix[], added: readonly AddedYear[], units: RecordUnits): Layout {
  const fixed = record.map((line) => withFix(line, fixes, units));
  const staying = fixed.filter((line) => !moved(line));
  const taken = new Set(staying.map((l) => `${l.year}\u0000${l.group}`));
  const extra = [
    ...fixed.filter(moved),
    ...added.flatMap((a): AlumnusLine[] => {
      const base = addedBase(a.unit, a.role, units);
      return base === null ? [] : [{ ...base, year: a.year, rank: a.mark, marked: true, role: a.role, source: { kind: "added", unit: a.unit } }];
    }),
  ];
  const placed: AlumnusLine[] = [];
  const clashing: AlumnusLine[] = [];
  for (const line of extra) {
    const key = `${line.year}\u0000${line.group}`;
    (taken.has(key) ? clashing : placed).push(line);
    taken.add(key);
  }
  return { lines: [...staying, ...placed].sort(byYearAndOrder), clashing: clashing.sort(byYearAndOrder) };
}

function byYearAndOrder(a: AlumnusLine, b: AlumnusLine): number {
  return a.year - b.year || a.order - b.order || a.group.localeCompare(b.group);
}

function nonEmpty<T>(list: readonly T[]): NonEmpty<T> | null {
  const [first, ...rest] = list;
  return first === undefined ? null : [first, ...rest];
}

function memberLines(roles: readonly RecordRole[], units: RecordUnits, currentYear: number): RecordLine[] {
  const lines = new Map<string, RecordLine>();
  for (const role of roles) {
    const base = roleBase(role, units);
    for (const year of yearsOf(role, currentYear)) {
      const key = `${year}\u0000${base.group}`;
      const seen = lines.get(key);
      lines.set(key, { year, base: seen === undefined ? base : merged(seen.base, base) });
    }
  }
  return [...lines.values()];
}

function importedLines(lines: readonly ImportedLine[]): RecordLine[] {
  return lines.map((line) => {
    const advisors = line.group === ADVISORS;
    const base: LineBase = {
      group: line.group,
      kind: advisors ? "advisors" : "imported",
      order: advisors ? ADVISORS_ORDER : IMPORTED_ORDER + Math.min(line.position, 899),
      rank: "member",
      title: line.role,
      unit: line.group,
      recordRole: line.role,
    };
    return { year: line.year, base };
  });
}

function advisorLines(who: Extract<EntryWho, { kind: "advisor" }>): RecordLine[] {
  const base: LineBase = { group: ADVISORS, kind: "advisors", order: ADVISORS_ORDER, rank: "member", title: who.role, unit: ADVISORS, recordRole: who.role };
  return Array.from({ length: Math.max(0, who.to - who.from + 1) }, (_, i) => ({ year: who.from + i, base }));
}

const NO_ENTRY = { name: null, founder: null, photo: null, shown: true, removed: false, fixes: [], added: [] } as const;

/**
 * Everyone the record can list, with their entries laid over it: each member
 * who held a role, each imported person and each added advisor. A member with
 * no name left (anonymized, with nothing kept) is not anyone the page can name.
 */
export function alumniOf(record: AlumniRecord, currentYear: number): Alumnus[] {
  const people = new Map(record.people.map((p) => [p.memberId, p]));
  const entryOfMember = new Map(record.entries.flatMap((e) => (e.who.kind === "member" ? [[e.who.memberId, e] as const] : [])));
  const rolesOf = new Map<number, RecordRole[]>();
  for (const role of record.roles) rolesOf.set(role.memberId, [...(rolesOf.get(role.memberId) ?? []), role]);

  const members = [...rolesOf].flatMap(([memberId, roles]): Alumnus[] => {
    const entry = entryOfMember.get(memberId);
    const person = people.get(memberId);
    const kept = entry?.who.kind === "member" ? entry.who.keptName : null;
    const recordName = person?.name ?? kept;
    const fromRecord = memberLines(roles, record.units, currentYear);
    const layout = fromRecord.length === 0 ? null : laidOut(fromRecord, entry?.fixes ?? [], entry?.added ?? [], record.units);
    const lines = layout === null ? null : nonEmpty(layout.lines);
    if (!recordName || layout === null || lines === null) return [];
    const onTeam = roles.some((r) => r.leftAt === null);
    return [alumnus(`m${memberId}`, "member", recordName, person?.email ?? null, person?.picture ?? null, entry ?? NO_ENTRY, lines, layout.clashing, onTeam)];
  });

  const others = record.entries.flatMap((entry): Alumnus[] => {
    const { who } = entry;
    if (who.kind === "member") return [];
    const fromRecord = who.kind === "imported" ? importedLines(record.imported.filter((l) => l.entryId === entry.id)) : advisorLines(who);
    const layout = fromRecord.length === 0 ? null : laidOut(fromRecord, entry.fixes, entry.added, record.units);
    const lines = layout === null ? null : nonEmpty(layout.lines);
    return layout === null || lines === null ? [] : [alumnus(`e${entry.id}`, who.kind, who.name, null, null, entry, lines, layout.clashing, false)];
  });

  return [...members, ...others];
}

function alumnus(
  key: AlumnusKey,
  kind: Alumnus["kind"],
  recordName: string,
  email: string | null,
  picture: string | null,
  entry: Pick<AlumniEntry, "name" | "founder" | "photo" | "shown" | "removed">,
  lines: NonEmpty<AlumnusLine>,
  clashing: readonly AlumnusLine[],
  onTeam: boolean,
): Alumnus {
  return {
    key,
    kind,
    recordName,
    name: entry.name ?? recordName,
    email,
    founder: entry.founder,
    photo: entry.photo,
    picture,
    shown: entry.shown,
    removed: entry.removed,
    onTeam,
    lines,
    clashing,
  };
}

/** Listed on the public page: shown, and not removed at their own request. */
export function listed(a: Alumnus): boolean {
  return a.shown && !a.removed;
}

function founderTag(mark: FounderMark | null): Tag | undefined {
  if (mark === null) return undefined;
  return mark === "founder" ? "FOUNDER" : "CO-FOUNDER";
}

type Placed = { readonly person: Alumnus; readonly line: AlumnusLine };

/**
 * Whether the line's rank marks it: in a department, and wherever an editor
 * chose the mark (issue #1006). Elsewhere the title decides who leads.
 */
function ranked(line: AlumnusLine): boolean {
  return line.kind === "department" || line.marked;
}

function leads(line: AlumnusLine): boolean {
  return ranked(line) ? line.rank !== "member" : leadsByRole(line.role);
}

function entryOf({ person, line }: Placed): Entry {
  const lead = leads(line);
  const rankTag: Tag | undefined = !ranked(line) ? undefined : line.rank === "head" ? "HEAD" : line.rank === "lead" ? "LEAD" : undefined;
  const tag = founderTag(person.founder) ?? rankTag;
  // The Alumni page's own photo first, else the one they stored as a member (#391).
  const photo = person.photo ?? person.picture;
  return { name: person.name, role: line.role, lead, ...(tag && { tag }), ...(photo !== null && { photo }) };
}

/**
 * A department lists its head, its leads, then its members (board 28). Any
 * other group lists the team leader first (#391), then leads, then founders,
 * then everyone else, each in the record's order.
 */
function sortedInGroup(kind: GroupKind, placed: Placed[]): Placed[] {
  const rank = (p: Placed) =>
    kind === "department"
      ? RANK_ORDER[p.line.rank]
      : p.line.rank === "leader"
        ? 0
        : leads(p.line)
          ? 1
          : p.person.founder !== null
            ? 2
            : 3;
  return [...placed].sort((a, b) => rank(a) - rank(b) || a.line.order - b.line.order || a.person.name.localeCompare(b.person.name));
}

function groupOf(name: string, placed: NonEmpty<Placed>): ShownGroup {
  const { kind } = placed[0].line;
  const [first, ...rest] = sortedInGroup(kind, [...placed]).map(entryOf);
  return { name, entries: [first!, ...rest], counted: kind === "department", firstRows: kind === "department" || kind === "advisors" ? 2 : 3 };
}

/**
 * The listed people's years up to `newestFinished`, newest first, each with
 * its groups in order. Only finished years: the running one is the Team
 * page's, so a role still held shows in its finished years only (#391).
 */
export function alumniYears(alumni: readonly Alumnus[], newestFinished: number): AcademicYear[] {
  const years = new Map<number, Map<string, Placed[]>>();
  for (const person of alumni.filter(listed)) {
    for (const line of person.lines) {
      if (line.year > newestFinished) continue;
      const groups = years.get(line.year) ?? new Map<string, Placed[]>();
      groups.set(line.group, [...(groups.get(line.group) ?? []), { person, line }]);
      years.set(line.year, groups);
    }
  }
  return [...years]
    .sort(([a], [b]) => b - a)
    .flatMap(([start, groups]): AcademicYear[] => {
      const shown = [...groups]
        .map(([name, placed]) => ({ order: Math.min(...placed.map((p) => p.line.order)), group: groupOf(name, placed as unknown as NonEmpty<Placed>) }))
        .sort((a, b) => a.order - b.order || a.group.name.localeCompare(b.group.name))
        .map((g) => g.group);
      const list = nonEmpty(shown);
      return list === null ? [] : [{ start, groups: list }];
    });
}

/** "The founders": the founder first, then the co-founders, each with the role of their first year on the page. */
export function foundersOf(alumni: readonly Alumnus[]): Founder[] {
  const first = (a: Alumnus) => a.lines[0];
  return alumni
    .filter((a) => listed(a) && a.founder !== null)
    .sort(
      (a, b) =>
        Number(b.founder === "founder") - Number(a.founder === "founder") ||
        first(a).year - first(b).year ||
        first(a).order - first(b).order ||
        a.name.localeCompare(b.name),
    )
    .map((a) => ({ name: a.name, title: a.founder!, role: first(a).role, ...(a.photo !== null && { photo: a.photo }) }));
}

/** What a fix from the dashboard changes on one person's entry; anything left out stays. */
export type EntryChange = Partial<Pick<AlumniEntry, "name" | "founder" | "photo" | "shown" | "removed" | "fixes" | "added">>;

/**
 * The record with one person's entry changed: the tests read what a fix
 * does with it this way. Only `entries`
 * changes; the roles, units and people are the same objects as before. A
 * member with no entry yet gets one, numbered after the last.
 */
export function withEntryChange(record: AlumniRecord, key: AlumnusKey, change: EntryChange): AlumniRecord {
  const id = Number(key.slice(1));
  const matches = (e: AlumniEntry) => (key.startsWith("m") ? e.who.kind === "member" && e.who.memberId === id : e.id === id);
  const existing = record.entries.find(matches);
  if (existing !== undefined) {
    return { ...record, entries: record.entries.map((e) => (e === existing ? { ...e, ...change } : e)) };
  }
  if (!key.startsWith("m")) return record;
  const next = Math.max(0, ...record.entries.map((e) => e.id)) + 1;
  const created: AlumniEntry = { id: next, who: { kind: "member", memberId: id, keptName: null }, ...NO_ENTRY, ...change };
  return { ...record, entries: [...record.entries, created] };
}
