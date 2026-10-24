import type { AcademicYear, Entry, Founder, FounderMark, NonEmpty, ShownGroup, Tag } from "./alumni-types";
import { leadsByRole } from "./alumni-year";

// The Alumni page built from the team record (issue #257). Each academic
// year lists who held which role in which department or division, from each
// role's start and end dates; closed divisions and departments stay as names.
// The years before the record held roles come from a one-time import
// (./alumni-import.ts). An alumni entry holds only how someone shows on the
// page: a fixed name, the founder mark, a photo, per-year role text, shown or
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
  readonly departments: readonly { readonly id: number; readonly name: string }[];
  readonly divisions: readonly { readonly id: number; readonly name: string; readonly departmentId: number | null }[];
};

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

/** The page text for one person's role in one group of one year (board 78b). */
export type RoleFix = { readonly year: number; readonly group: string; readonly role: string };

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

/** One person in one group of one academic year. */
export type AlumnusLine = {
  readonly year: number;
  readonly group: string;
  readonly kind: GroupKind;
  /** Where the group sits in its year: lower first. */
  readonly order: number;
  readonly rank: Rank;
  /** The record's title that year: "Head of Structures". Several roles in one group read "A · B". */
  readonly title: string;
  /** The unit under the title on the dashboard: the division, else the department or group. */
  readonly unit: string;
  /** What the page prints from the record: a division lead's division, else the title. */
  readonly recordRole: string;
  /** What the page prints: the fixed text, else `recordRole`. */
  readonly role: string;
  readonly fixed: boolean;
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
   * lists them in their years like anyone else; the dashboard's Alumni list
   * leaves them out, as current members are managed on Members (#271).
   * Imported people and advisors are never on the team.
   */
  readonly onTeam: boolean;
  /** Oldest year first, then in group order. */
  readonly lines: NonEmpty<AlumnusLine>;
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

type LineBase = Omit<AlumnusLine, "year" | "role" | "fixed">;

/**
 * Where one role puts its holder on the page, every year it was held. An
 * advisor sits in the department or division they advised that year; one
 * with neither sits in Advisors (#391).
 */
function roleBase(role: RecordRole, units: RecordUnits): LineBase {
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

function withFixes(year: number, base: LineBase, fixes: readonly RoleFix[]): AlumnusLine {
  const fix = fixes.find((f) => f.year === year && f.group === base.group);
  return { ...base, year, role: fix?.role ?? base.recordRole, fixed: fix !== undefined };
}

function byYearAndOrder(a: AlumnusLine, b: AlumnusLine): number {
  return a.year - b.year || a.order - b.order || a.group.localeCompare(b.group);
}

function nonEmpty<T>(list: readonly T[]): NonEmpty<T> | null {
  const [first, ...rest] = list;
  return first === undefined ? null : [first, ...rest];
}

function memberLines(roles: readonly RecordRole[], units: RecordUnits, currentYear: number, fixes: readonly RoleFix[]): AlumnusLine[] {
  const lines = new Map<string, { year: number; base: LineBase }>();
  for (const role of roles) {
    const base = roleBase(role, units);
    for (const year of yearsOf(role, currentYear)) {
      const key = `${year}\u0000${base.group}`;
      const seen = lines.get(key);
      lines.set(key, { year, base: seen === undefined ? base : merged(seen.base, base) });
    }
  }
  return [...lines.values()].map(({ year, base }) => withFixes(year, base, fixes)).sort(byYearAndOrder);
}

function importedLines(lines: readonly ImportedLine[], fixes: readonly RoleFix[]): AlumnusLine[] {
  return lines
    .map((line) => {
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
      return withFixes(line.year, base, fixes);
    })
    .sort(byYearAndOrder);
}

function advisorLines(who: Extract<EntryWho, { kind: "advisor" }>, fixes: readonly RoleFix[]): AlumnusLine[] {
  const base: LineBase = { group: ADVISORS, kind: "advisors", order: ADVISORS_ORDER, rank: "member", title: who.role, unit: ADVISORS, recordRole: who.role };
  return Array.from({ length: Math.max(0, who.to - who.from + 1) }, (_, i) => withFixes(who.from + i, base, fixes));
}

const NO_ENTRY = { name: null, founder: null, photo: null, shown: true, removed: false, fixes: [] } as const;

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
    const lines = nonEmpty(memberLines(roles, record.units, currentYear, entry?.fixes ?? []));
    if (!recordName || lines === null) return [];
    const onTeam = roles.some((r) => r.leftAt === null);
    return [alumnus(`m${memberId}`, "member", recordName, person?.email ?? null, person?.picture ?? null, entry ?? NO_ENTRY, lines, onTeam)];
  });

  const others = record.entries.flatMap((entry): Alumnus[] => {
    const { who } = entry;
    if (who.kind === "member") return [];
    const lines = nonEmpty(
      who.kind === "imported"
        ? importedLines(record.imported.filter((l) => l.entryId === entry.id), entry.fixes)
        : advisorLines(who, entry.fixes),
    );
    return lines === null ? [] : [alumnus(`e${entry.id}`, who.kind, who.name, null, null, entry, lines, false)];
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

function entryOf({ person, line }: Placed): Entry {
  const department = line.kind === "department";
  const lead = department ? line.rank !== "member" : leadsByRole(line.role);
  const rankTag: Tag | undefined = department && line.rank === "head" ? "HEAD" : department && line.rank === "lead" ? "LEAD" : undefined;
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
        : leadsByRole(p.line.role)
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
export type EntryChange = Partial<Pick<AlumniEntry, "name" | "founder" | "photo" | "shown" | "removed" | "fixes">>;

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
