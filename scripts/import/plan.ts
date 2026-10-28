import { isAdvisorVersion, type AdvisorVersion } from "@/lib/about/advisors";
import { faqFieldErrors } from "@/lib/faq/faq";
import type { CheckedPhoto } from "@/lib/outreach-photos";
import { academicYearOf, yearEnd, yearStart } from "./academic-year";
import { UNCLEAR_QUITTER_KINDS, type At, type Conflict, type ConflictKind } from "./conflicts";
import { readOverrides } from "./overrides";
import { matchPeople, nameKey, normalEmail, signInEmail, type Person } from "./people";
import { photoAt, type MemberPhoto, type PhotoFolder } from "./photos";
import { quitterStint, type SwappedField } from "./quitters";
import type { ExistingRole, Snapshot } from "./snapshot";
import { dayOf, type PersonRow, type QuitterRow, type Sources } from "./sources";
import { seatsOf, type FullAccessSeat, type PositionType, type Seat, type SeatReading } from "./titles";
import { holds, refKey, UnitBook, UnitFold, type NewDepartment, type NewDivision, type PlacedDivision, type Sighting, type UnitRef } from "./unit-book";
import { DepartmentIndex, notedDepartment, rowUnitNames, subteamReadingOf, unitKey, type UnitName, type UnitValue } from "./units";

// What an import would write (issues #677, #816), worked out from the sources
// and a snapshot of the database before anything is written. The plan is the
// whole decision: a dry run prints it, an import writes exactly its rows and
// nothing else. Every row is an insert; a row the database already holds is
// counted as present and left alone, so a second run plans no insert at all.
// The one write that is no insert links an account that holds no member row
// to the member row the plan inserts for its person (issue #820).

/** A person the plan writes for: one it inserts (by their match id), or a member the database already has. */
export type PersonRef = { readonly kind: "new"; readonly person: number } | { readonly kind: "existing"; readonly memberId: number };

/**
 * The account a new member row belongs to: a `users` row the plan inserts, or
 * one the database holds with no member row (issue #820). That one is linked
 * to the new member and left as it is otherwise: none of its fields is written.
 */
export type PersonAccount = { readonly kind: "new"; readonly user: NewUser } | { readonly kind: "linked"; readonly userId: string };

export type NewUser = {
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly origin: string | null;
  readonly levelOfStudy: string | null;
  readonly linkedin: string | null;
  readonly politoId: string | null;
  readonly program: string | null;
  readonly country: string | null;
};

export type NewPerson = {
  readonly person: number;
  readonly account: PersonAccount;
  readonly member: {
    readonly prtEmail: string | null;
    readonly mobileNumber: string | null;
    readonly discord: string | null;
    readonly teamFrom: number | null;
    readonly teamTo: number | null;
  };
  /** Their photo, shaped and checked; uploaded and written to `members.picture` as the member row is inserted. */
  readonly photo: MemberPhoto | null;
};

export type NewRole = {
  readonly who: PersonRef;
  readonly dept: UnitRef | null;
  readonly division: UnitRef | null;
  readonly title: string;
  readonly type: PositionType;
  readonly fullAccess: FullAccessSeat | null;
  readonly startedAt: string;
  readonly leavedAt: string | null;
};

export type NewLeave = { readonly who: PersonRef; readonly leftAt: string };
/** An advisor to insert, and their checked photo: uploaded as the version is written, its URL the version's `photo`. */
export type NewAdvisor = { readonly siteOrder: number; readonly advisor: AdvisorVersion; readonly photo: CheckedPhoto | null };
export type NewFaq = { readonly siteOrder: number; readonly question: string; readonly answer: readonly string[] };
export type OrderStatus = "pending" | "accepted" | "rejected" | "changes_requested" | "cancelled" | "ordered";
export type NewOrder = {
  readonly requester: PersonRef;
  readonly status: OrderStatus;
  readonly division: UnitRef | null;
  readonly description: string | null;
  readonly reason: string | null;
  readonly quantity: number | null;
  readonly price: string | null;
  readonly name: string | null;
  readonly quoteName: string | null;
  readonly createdAt: string;
};

/** The tables the import writes, in the order the report lists them. */
export const TABLES = [
  "departments",
  "divisions",
  "users",
  "members",
  "roles",
  "team_leaves",
  "team_page_advisors",
  "team_page_advisor_versions",
  "faqs",
  "faq_versions",
  "orders",
] as const;

export type Table = (typeof TABLES)[number];
export type Count = { insert: number; present: number; refused: number };

export type Plan = {
  readonly currentYear: number | null;
  /** The departments and divisions the roster names and the database lacks: created (open or closed) before any role is placed in them. */
  readonly departments: readonly NewDepartment[];
  readonly divisions: readonly NewDivision[];
  readonly people: readonly NewPerson[];
  readonly roles: readonly NewRole[];
  readonly leaves: readonly NewLeave[];
  readonly advisors: readonly NewAdvisor[];
  readonly faqs: readonly NewFaq[];
  readonly orders: readonly NewOrder[];
  readonly counts: Readonly<Record<Table, Count>>;
  /** FAQ rows the export marks not visible: skipped, never imported. */
  readonly hiddenFaqs: number;
  readonly alumni: number;
  readonly multiYear: number;
  readonly unclearQuitters: number;
  /** The Quitters date cells read with their day and month swapped (issue #818), in the order the rows were read. */
  readonly swappedDates: readonly SwappedDate[];
  /** How many handover lines of `overrides.csv` were applied. */
  readonly handovers: number;
  /** How many quitter-year lines of `overrides.csv` were applied. */
  readonly quitterYears: number;
  /** How many distinct subteam and division names resolved to no unit; null when no database was given to check them. */
  readonly unresolvedUnits: number | null;
  /** The photo counts; null when the source directory has no `photos/` folder. */
  readonly photos: PhotoCounts | null;
  readonly conflicts: readonly Conflict[];
};

/** A Quitters date cell read day/month-swapped: its row, and which cell. */
export type SwappedDate = { readonly at: At; readonly field: SwappedField };

/** What became of the photo files, by count. */
export type PhotoCounts = {
  readonly found: number;
  /** Matched to a person: by a `people_rows.csv` id, or by surname to a person whose workbook row is an advisor's. */
  readonly matchedMembers: number;
  /** Matched by surname to an `advisors_rows.csv` row. */
  readonly matchedAdvisors: number;
  readonly surnameDiffers: number;
  readonly noIdMatch: number;
  readonly noSurnameMatch: number;
  readonly surnameAmbiguous: number;
  /** Matched to a person or advisor the database already holds: skipped, nothing updated. */
  readonly alreadyPresent: number;
  /** Matched to a person or advisor this run does not insert. */
  readonly notImported: number;
  readonly unfit: number;
  /** `has_pp` rows of `people_rows.csv` and `advisors_rows.csv` with no file. */
  readonly missing: number;
  /** Linked to a member or advisor this run inserts: what an import uploads. */
  readonly toUpload: number;
};

const ORDER_STATUSES: readonly OrderStatus[] = ["pending", "accepted", "rejected", "changes_requested", "cancelled", "ordered"];

/** A LinkedIn link or bare handle as `users.linkedin` stores it (the full profile link); null when it is neither. */
export function linkedinLink(text: string): string | null {
  const handle = linkedinHandleOf(text);
  return handle === null ? null : `https://www.linkedin.com/in/${handle}`;
}

function linkedinHandleOf(text: string): string | null {
  const t = text.trim();
  const m = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?$/i.exec(t) ?? /^@?([A-Za-z0-9\-_%]{3,100})$/.exec(t);
  return m === null ? null : m[1];
}

const orNull = (text: string | undefined) => (text === undefined || text.trim() === "" ? null : text.trim());

const truthy = (text: string) => /^(true|t|1|yes|y)$/i.test(text.trim());
const falsy = (text: string) => /^(false|f|0|no|n)$/i.test(text.trim());

class Counter {
  readonly counts = Object.fromEntries(TABLES.map((t) => [t, { insert: 0, present: 0, refused: 0 }])) as Record<Table, Count>;
  add(table: Table, kind: keyof Count, n = 1): void {
    this.counts[table][kind] += n;
  }
}

/** A role's place: the units it is stored with. */
type Placement = { readonly dept: UnitRef | null; readonly division: UnitRef | null };

/** A department of a row: the cell that names it, its value, and the unit it is (null when it resolved to none). */
type RowDepartment = { readonly cell: "subteam" | "division"; readonly value: UnitName; readonly ref: UnitRef | null };

/** What a row's subteam and division cells give its seats; with no database to resolve against, both unit lists are empty and nothing is placed. */
type RowUnits = {
  readonly year: number;
  readonly reading: "past" | "present";
  readonly departments: readonly RowDepartment[];
  /** Each division the row names, its department, and the department the row pairs it with; null when it resolved to none. */
  readonly divisions: readonly ((PlacedDivision & { readonly pairedWith: UnitRef | null }) | null)[];
  /** The advisor marker the cells carry, if any. */
  readonly advisor: Extract<UnitValue, { kind: "advisor" }> | null;
  /** The subteam cell names a project and no unit. */
  readonly projectOnly: boolean;
};

/** Why a seat has no place: the conflict, its field, and whether it was already reported when a value did not resolve. */
type Unplaced = { readonly kind: ConflictKind; readonly field: string; readonly reported: boolean };

/** A person's cells for one year: the year sheet's, each empty one filled from that year's Roles sheet. */
type YearCells = { readonly row: PersonRow; readonly title: string; readonly subteam: string; readonly division: string; readonly reading: "past" | "present" };

function cellsOf(person: Person, year: number): YearCells {
  const row = person.years.get(year)!;
  const extra = person.rolesRows.get(year)?.value;
  // The Subteam cell is read as its own sheet reads it: a Roles sheet's as a past one.
  const fromRoles = row.value.subteam === "" && (extra?.subteam ?? "") !== "";
  return {
    row,
    title: row.value.title || extra?.title || "",
    subteam: row.value.subteam || extra?.subteam || "",
    division: row.value.division || extra?.division || "",
    reading: subteamReadingOf(fromRoles ? { kind: "roles" } : { kind: "year", year }),
  };
}

/** A quitter-only row's cells, read as the Quitters sheet reads them. */
const quitterCells = (row: QuitterRow): YearCells => ({
  row,
  title: row.value.title,
  subteam: row.value.subteam,
  division: row.value.division,
  reading: subteamReadingOf({ kind: "quitters" }),
});

/**
 * One stretch a person held their roles in: a year sheet's row (active this
 * year, else the whole academic year), or the Quitters row of a quitter-only
 * alumnus (from its join day to its leave day).
 */
type Stint = { readonly year: number; readonly cells: YearCells; readonly startedAt: string; readonly leavedAt: string | null };

/** The key a row has across the sources: file, sheet and row. */
const atKey = (at: At) => `${at.file}\u0000${at.sheet ?? ""}\u0000${at.row}`;

/** The key of the seat a role holds while active, or null for a seat any number may hold: a second active holder of one is refused, as the unique indexes of migration 0062 would. */
const seatKeyOf = (type: PositionType | null, fullAccess: FullAccessSeat | null, dept: string | null): string | null =>
  type === "president" ? "president" : fullAccess !== null ? `full:${fullAccess}` : type === "head" && dept !== null ? `head:${dept}` : null;

const ADVISOR_SEAT: Seat = { type: "advisor", fullAccess: null, unit: "member-unit" };
const NO_PLACE: Placement = { dept: null, division: null };
/** The role that keeps a seat's earlier holder on the team when the seat they handed over was their only role: a plain member's, as the dashboard titles one. */
const MEMBERSHIP: Extract<SeatReading, { kind: "seat" }> = {
  kind: "seat",
  seat: { type: "core", fullAccess: null, unit: "member-unit" },
  title: "Member",
  acting: false,
  project: null,
  division: null,
};

/** Each place once. */
const unique = (list: readonly Placement[]): Placement[] => [
  ...new Map(list.map((p) => [`${p.dept === null ? "" : refKey(p.dept)}|${p.division === null ? "" : refKey(p.division)}`, p])).values(),
];

/** The day a run plans on, `YYYY-MM-DD`: a seat handed over this year ends on it. */
export const importDay = () => new Date().toISOString().slice(0, 10);

export function planImport(sources: Sources, snapshot: Snapshot, photoFolder: PhotoFolder | null = null, today: string = importDay()): Plan {
  const { people, conflicts: matchConflicts, matchPeopleRows } = matchPeople(sources);
  const conflicts: Conflict[] = [...sources.conflicts, ...matchConflicts];
  const counter = new Counter();
  const currentYear = sources.currentYear;
  const units = snapshot.units;

  // Units --------------------------------------------------------------------

  const onCurrent = currentYear === null ? [] : people.filter((p) => p.years.has(currentYear));
  // Every row the units below are read from, read first, so the values that spell one unit are one unit whichever row comes first.
  const unitRows: { readonly cells: YearCells; readonly year: number; readonly current: boolean }[] = [];
  for (const person of people) {
    for (const year of person.years.keys()) unitRows.push({ cells: cellsOf(person, year), year, current: year === currentYear });
    // A quitter-only row's sheet has no year: it counts as older than every year sheet.
    if (person.years.size === 0 && person.quitter !== null) unitRows.push({ cells: quitterCells(person.quitter), year: Number.NEGATIVE_INFINITY, current: false });
  }
  /** The departments a row's title notes ("President-Advisor (Project Cavour)" notes Cavour). */
  const notedDepartmentsOf = (c: YearCells) =>
    seatsOf(c.title).flatMap((reading) => {
      if (reading.kind !== "seat" || reading.seat.unit !== "noted-department" || reading.project === null) return [];
      return notedDepartment(reading.project, snapshot.projects, c.reading) ?? [];
    });
  // A division's note that names a department is its department (issue #820): the database's departments, and the ones the rows name.
  const departmentIndex = new DepartmentIndex([
    ...(units?.departments ?? []),
    ...unitRows.flatMap(({ cells: c }) => [...rowUnitNames(c.subteam, c.division, snapshot.projects, c.reading).departments.map((d) => d.value), ...notedDepartmentsOf(c)]),
  ]);
  const unitNamesOf = (c: YearCells) => rowUnitNames(c.subteam, c.division, snapshot.projects, c.reading, departmentIndex);
  const departmentFold = new UnitFold(
    unitRows.flatMap(({ cells: c, year, current }) =>
      [...unitNamesOf(c).departments.map((d) => d.value), ...notedDepartmentsOf(c)].map((value): Sighting => ({ value, year, current, parent: null })),
    ),
    // A database department spelt by name on one row and by its code on another is one parent to its divisions.
    units?.departments ?? [],
  );
  // A division is told apart by the department its row pairs it with.
  const divisionFold = new UnitFold(
    unitRows.flatMap(({ cells: c, year, current }) =>
      unitNamesOf(c).divisions.map((d): Sighting => ({ value: d.value, year, current, parent: d.department === null ? null : departmentFold.group(d.department) })),
    ),
  );
  const book = units === null ? null : new UnitBook(units, { departments: departmentFold, divisions: divisionFold });

  // Seats --------------------------------------------------------------------

  /** Reads a row's unit cells, reporting each cell with a value that resolves to no unit, once. */
  const rowUnits = (c: YearCells, year: number): RowUnits => {
    const names = unitNamesOf(c);
    const base = { year, reading: c.reading, advisor: names.advisor, projectOnly: names.projectOnly };
    if (book === null) return { ...base, departments: [], divisions: [] };
    const departments = names.departments.map((d) => ({ cell: d.cell, value: d.value, ref: book.department(d.value, year) }));
    const departmentNamed = (name: string) => departments[names.departments.findIndex((d) => unitKey(d.value.name) === unitKey(name))]?.ref ?? null;
    const divisions = names.divisions.map((d) => {
      const paired = d.department === null ? null : { value: d.department, ref: departmentNamed(d.department.name) };
      const placed = book.division(d.value, year, paired);
      return placed === null ? null : { ...placed, pairedWith: paired?.ref ?? null };
    });
    for (const field of ["subteam", "division"] as const) {
      const missing = departments.some((d) => d.cell === field && d.ref === null) || (field === "division" && divisions.some((d) => d === null));
      if (missing) conflicts.push({ kind: "unknown-unit", at: c.row.at, field });
    }
    return { ...base, departments, divisions };
  };

  /**
   * The division a division seat's title names, for a row that names no
   * division (issue #822): under the row's departments, or any when it names
   * none. Null when the title names none, a department of the row resolved to
   * none, or the name matches no division the run knows, or several.
   */
  const titledDivision = (reading: Extract<SeatReading, { kind: "seat" }>, row: RowUnits): Placement[] | null => {
    if (book === null || reading.division === null || row.departments.some((d) => d.ref === null)) return null;
    const placed = book.titledDivision(reading.division, row.year, row.departments);
    return placed === null ? null : [{ dept: placed.dept, division: placed.ref }];
  };

  /** The department a department seat's rule names for a row that names none (issue #822): the Chief Operating Officer's Operations. */
  const fallbackDepartment = (seat: Seat, row: RowUnits): Placement[] | null => {
    if (book === null || seat.fallback?.kind !== "department") return null;
    const dept = book.namedDepartment([seat.fallback.name, seat.fallback.code], row.year);
    return dept === null ? null : [{ dept, division: null }];
  };

  /**
   * The places a seat takes from its row's units, or why it has none. A
   * division seat sits in each division, a department seat in each
   * department. A member's seat sits in each division, and in each department
   * no division of the row belongs to. A row that names no unit of a seat's
   * level may still place it (issue #822): in the division its title names, or
   * the department its rule names.
   */
  const placements = (reading: Extract<SeatReading, { kind: "seat" }>, seat: Seat, row: RowUnits): Placement[] | Unplaced => {
    if (seat.unit === "board" || book === null) return [NO_PLACE];
    if (seat.unit === "noted-department") {
      const named = reading.project === null ? null : notedDepartment(reading.project, snapshot.projects, row.reading);
      if (named === null) return [NO_PLACE];
      const dept = book.department(named, row.year);
      return dept === null ? { kind: "unknown-unit", field: "title", reported: false } : [{ dept, division: null }];
    }
    const none = (field: string): Unplaced => ({ kind: row.projectOnly ? "project-only-unit" : "unknown-unit", field, reported: false });
    const unresolved = (field: string): Unplaced => ({ kind: "unknown-unit", field, reported: true });
    const inDivisions = row.divisions.flatMap((d) => (d === null ? [] : [{ dept: d.dept, division: d.ref }]));
    const inDepartments = (list: readonly RowDepartment[]) => list.flatMap((d) => (d.ref === null ? [] : [{ dept: d.ref, division: null }]));
    const divisionMissing = row.divisions.some((d) => d === null);
    const departmentMissing = row.departments.find((d) => d.ref === null);
    if (seat.unit === "division") {
      if (row.divisions.length === 0) return titledDivision(reading, row) ?? none("division");
      return divisionMissing ? unresolved("division") : unique(inDivisions);
    }
    if (seat.unit === "department") {
      if (row.departments.length === 0) return fallbackDepartment(seat, row) ?? none("subteam");
      return departmentMissing !== undefined ? unresolved(departmentMissing.cell) : unique(inDepartments(row.departments));
    }
    if (row.divisions.length === 0 && row.departments.length === 0) return seat.type === "advisor" ? [NO_PLACE] : none("subteam");
    if (divisionMissing) return unresolved("division");
    if (departmentMissing !== undefined) return unresolved(departmentMissing.cell);
    // A department is covered by a division under it, or one the row pairs with it: a created division's final department is known only once every row is placed.
    const covered = new Set(row.divisions.flatMap((d) => (d === null ? [] : [d.dept, d.pairedWith].flatMap((ref) => (ref === null ? [] : [refKey(ref)])))));
    return unique([...inDivisions, ...inDepartments(row.departments.filter((d) => !covered.has(refKey(d.ref!))))]);
  };

  const heldSeats = new Set(
    snapshot.roles.filter((r) => r.leavedAt === null).flatMap((r) => seatKeyOf(r.type, r.fullAccess, r.deptId === null ? null : String(r.deptId)) ?? []),
  );
  const roleSeatKey = (role: Pick<NewRole, "type" | "fullAccess" | "dept">) => seatKeyOf(role.type, role.fullAccess, role.dept === null ? null : refKey(role.dept));

  /** Whether a stored role is this one. A handed-over role ends on the day a run plans, so any end day matches it. */
  const sameRole = (a: ExistingRole, b: Omit<NewRole, "who">, handedOver: boolean) =>
    holds(a.deptId, b.dept) &&
    holds(a.divisionId, b.division) &&
    a.title === b.title &&
    a.startedAt === b.startedAt &&
    (handedOver ? a.leavedAt !== null : a.leavedAt === b.leavedAt);

  // Overrides ------------------------------------------------------------------

  const overrides = readOverrides(sources.csv.overrides);
  conflicts.push(...overrides.conflicts);

  /** The academic year a quitter-year line gives each quitter-only person's Quitters row, by the row's key. */
  const quitterYearOf = new Map<string, number>();
  const quitterOnlyRows = new Set(people.flatMap((p) => (p.years.size === 0 && p.quitter !== null ? [atKey(p.quitter.at)] : [])));
  const quittersSheet = sources.quitters[0]?.at;
  for (const o of overrides.quitterYears) {
    const key = quittersSheet === undefined ? null : atKey({ file: quittersSheet.file, sheet: o.sheet, row: o.row });
    if (key === null || !quitterOnlyRows.has(key) || quitterYearOf.has(key)) {
      conflicts.push({ kind: "override-unmatched", at: o.at, field: "row" });
      continue;
    }
    quitterYearOf.set(key, o.year);
  }

  // Handovers ----------------------------------------------------------------

  /** The seat keys a current-year row's title gives, its departments resolved as its roles will be (a unit the run creates included). */
  const seatKeysOf = (person: Person): Set<string> => {
    const c = cellsOf(person, currentYear!);
    const names = unitNamesOf(c);
    const depts = names.departments.flatMap((d) => book?.department(d.value, currentYear!) ?? []);
    const keys = new Set<string>();
    for (const reading of seatsOf(c.title)) {
      if (reading.kind !== "seat") continue;
      const { type, fullAccess, unit } = reading.seat;
      // A head seat with no department of its row still holds its full-access seat (the Chief Operating Officer's, issue #822).
      if (type === "head" && unit === "department" && depts.length > 0) for (const d of depts) keys.add(seatKeyOf(type, fullAccess, refKey(d))!);
      else {
        const key = seatKeyOf(type, fullAccess, null);
        if (key !== null) keys.add(key);
      }
    }
    return keys;
  };

  /** The seats each current-year row (by its row number) handed over this year: they end on the import day, and their holder keeps the membership. */
  const handedOver = new Map<number, Set<string>>();
  let handovers = 0;
  const currentSheet = sources.years.find((y) => y.year === currentYear);
  const personAt = new Map(onCurrent.map((p) => [p.years.get(currentYear!)!.at.row, p]));
  for (const h of overrides.handovers) {
    const onSheet = currentSheet !== undefined && h.sheet === currentSheet.sheet;
    const giver = onSheet ? personAt.get(h.fromRow) : undefined;
    const taker = onSheet ? personAt.get(h.toRow) : undefined;
    const shared = giver === undefined || taker === undefined || giver === taker ? [] : [...seatKeysOf(giver)].filter((k) => seatKeysOf(taker).has(k));
    if (shared.length === 0) {
      conflicts.push({ kind: "override-unmatched", at: h.at, field: onSheet ? "row" : "sheet" });
      continue;
    }
    handedOver.set(h.fromRow, new Set([...(handedOver.get(h.fromRow) ?? []), ...shared]));
    handovers++;
  }

  // People -------------------------------------------------------------------

  const newPeople: NewPerson[] = [];
  const newRoles: NewRole[] = [];
  const leaves: NewLeave[] = [];
  const refOf = new Map<number, PersonRef>();
  /** Whether the plan inserts each person or finds them present; a person missing here is not imported. */
  const personFate = new Map<number, "new" | "existing">();
  /** Each person's divisions by academic year, by unit key, for an order's division. */
  const divisionsByYear = new Map<number, Map<number, Map<string, UnitRef>>>();
  let alumni = 0;
  /** The Quitters date cells read with their day and month swapped. */
  const swappedDates: SwappedDate[] = [];

  const importedNames = new Map<string, number[]>();
  for (const entry of snapshot.importedAlumni) {
    const key = nameKey(entry.name, "");
    importedNames.set(key, [...(importedNames.get(key) ?? []), ...entry.years]);
  }

  /**
   * The day a year-sheet row's roles start: its "Date of joining" where the
   * sheet gives one (only the 2022-2023 sheet does, owner decision), else the
   * academic year's first day. A joining day that does not read, or falls
   * after the year, is reported, and the year's first day is used.
   */
  const startOf = (row: PersonRow, year: number): string => {
    const text = row.value.joinedOn.trim();
    if (text === "") return yearStart(year);
    const day = dayOf(text);
    if (day !== null && day <= yearEnd(year)) return day;
    conflicts.push({ kind: "joined-date-unreadable", at: row.at, field: "joinedOn" });
    return yearStart(year);
  };

  /** The stints a person's rows give, oldest first, and the row the report names for the person; null for an unclear quitter-only row, reported here. */
  const stintsOf = (person: Person): { readonly stints: readonly Stint[]; readonly at: At } | null => {
    if (person.years.size === 0) {
      const row = person.quitter!;
      const stint = quitterStint(row, quitterYearOf.get(atKey(row.at)) ?? null);
      if (stint.kind === "unclear") {
        conflicts.push({ kind: stint.conflict, at: row.at, field: stint.field });
        return null;
      }
      if (stint.swapped !== null) swappedDates.push({ at: row.at, field: stint.swapped });
      return { stints: [{ year: stint.year, cells: quitterCells(row), startedAt: stint.startedAt, leavedAt: stint.leftAt }], at: row.at };
    }
    const years = [...person.years.keys()].sort((a, b) => a - b);
    const stints = years.map((year) => ({
      year,
      cells: cellsOf(person, year),
      startedAt: startOf(person.years.get(year)!, year),
      leavedAt: year === currentYear ? null : yearEnd(year),
    }));
    return { stints, at: person.years.get(years[years.length - 1])!.at };
  };

  /**
   * A person the plan imports: their stints, the row the report names for
   * them, their sign-in address, and whom they are written as: a member the
   * database has, or a new member, linked to the account of their sign-in
   * address when the database has one that holds no member row.
   */
  type Admitted = {
    readonly stints: readonly Stint[];
    readonly anchor: At;
    readonly email: string;
    readonly who: { readonly kind: "existing"; readonly memberId: number } | { readonly kind: "new"; readonly linkTo: string | null };
  };

  /** Whether the plan imports a person; a refused one is reported and counted here, once. */
  const admit = (person: Person): Admitted | null => {
    const found = stintsOf(person);
    if (found === null) return null;
    const { stints, at: anchor } = found;
    if (person.quitter !== null && currentYear !== null && person.years.has(currentYear)) {
      conflicts.push({ kind: "quitter-on-current-sheet", at: person.quitter.at });
    }
    const refuse = (kind: ConflictKind): null => {
      conflicts.push({ kind, at: anchor });
      counter.add("users", "refused");
      counter.add("members", "refused");
      return null;
    };
    const email = signInEmail(person);
    if (email === null) return refuse("missing-email");
    const accounts = snapshot.users.filter((u) => person.emails.has(u.email) || u.email === email);
    // An account that holds a member row is that member: present, never touched.
    const member = accounts.find((u) => u.member !== null)?.member;
    if (member != null) return { stints, anchor, email, who: { kind: "existing", memberId: member } };
    // The account of the sign-in address, holding no member row, gets the new member (owner decision, issue #820); one of another address alone does not.
    const signIn = accounts.find((u) => u.email === email);
    if (signIn === undefined && accounts.length > 0) return refuse("account-without-member");
    return { stints, anchor, email, who: { kind: "new", linkTo: signIn?.id ?? null } };
  };
  const admitted = new Map<number, Admitted>();
  for (const person of people) {
    const entry = admit(person);
    if (entry !== null) admitted.set(person.id, entry);
  }

  // Whom the plan imports is known now, so a `people_rows.csv` row's given-names
  // fallback counts only imported people (issue #818). The rows fill LinkedIn,
  // so they are matched before any person's fields are read below.
  const peopleRows = matchPeopleRows((p) => admitted.has(p.id));
  const byPeopleId = peopleRows.byPeopleId;
  conflicts.push(...peopleRows.conflicts);

  for (const person of people) {
    const entry = admitted.get(person.id);
    if (entry === undefined) continue;
    const { stints, anchor, email, who } = entry;
    const ref: PersonRef = who.kind === "existing" ? who : { kind: "new", person: person.id };
    const onCurrent = currentYear !== null && person.years.has(currentYear);
    refOf.set(person.id, ref);
    personFate.set(person.id, ref.kind);
    const existingRoles = ref.kind === "existing" ? snapshot.roles.filter((r) => r.memberId === ref.memberId) : [];
    const alumnus = !onCurrent;
    if (alumnus) alumni++;

    if (who.kind === "existing") {
      counter.add("users", "present");
      counter.add("members", "present");
    } else {
      counter.add("users", who.linkTo === null ? "insert" : "present");
      counter.add("members", "insert");
      const f = person.fields;
      const account: PersonAccount =
        who.linkTo !== null
          ? { kind: "linked", userId: who.linkTo }
          : {
              kind: "new",
              user: {
                email,
                firstName: orNull(f.firstName),
                lastName: orNull(f.lastName),
                origin: orNull(f.origin),
                levelOfStudy: orNull(f.level),
                linkedin: f.linkedin === undefined ? null : linkedinLink(f.linkedin),
                politoId: orNull(f.studentId),
                program: orNull(f.program),
                country: orNull(f.country),
              },
            };
      newPeople.push({
        person: person.id,
        account,
        member: {
          prtEmail: normalEmail(f.prtEmail ?? ""),
          mobileNumber: orNull(f.mobile),
          discord: orNull(f.discord),
          teamFrom: alumnus ? Math.min(...stints.map((s) => academicYearOf(s.startedAt))) : null,
          teamTo: alumnus ? Math.max(...stints.map((s) => s.year)) : null,
        },
        photo: null,
      });
    }

    const importedYears = new Set([...person.names].flatMap((n) => importedNames.get(n) ?? []));
    if ([...person.names].some((n) => importedNames.has(n))) conflicts.push({ kind: "imported-alumni-match", at: anchor });

    for (const { year, cells: c, startedAt, leavedAt } of stints) {
      if (importedYears.has(year)) continue;
      const { row, title } = c;
      const cells = rowUnits(c, year);
      const active = leavedAt === null;
      const handed = active ? handedOver.get(row.at.row) : undefined;
      /** How many of this row's roles are planned (inserted or present) and stay active, and how many are seats it handed over. */
      let kept = 0;
      let handedSeats = 0;
      /** Plans one role of the row: present when the database has it, refused when its seat already has an active holder, else inserted. */
      const planRole = (role: Omit<NewRole, "who">, seatKey: string | null, handedOverSeat: boolean): void => {
        if (role.division !== null) {
          const byYear = divisionsByYear.get(person.id) ?? new Map<number, Map<string, UnitRef>>();
          byYear.set(year, (byYear.get(year) ?? new Map()).set(refKey(role.division), role.division));
          divisionsByYear.set(person.id, byYear);
        }
        if (existingRoles.some((r) => sameRole(r, role, handedOverSeat))) {
          counter.add("roles", "present");
        } else {
          const key = active && !handedOverSeat ? seatKey : null;
          if (key !== null && heldSeats.has(key)) {
            conflicts.push({ kind: "seat-taken", at: row.at, field: "title" });
            counter.add("roles", "refused");
            return;
          }
          if (key !== null) heldSeats.add(key);
          newRoles.push({ who: ref, ...role });
          counter.add("roles", "insert");
        }
        if (handedOverSeat) handedSeats++;
        else if (role.leavedAt === null) kept++;
      };
      for (const reading of seatsOf(title)) {
        if (reading.kind === "unknown") {
          conflicts.push({ kind: "unknown-title", at: row.at, field: "title" });
          counter.add("roles", "refused");
          continue;
        }
        // An advisor marker in the unit cells makes a plain member's seat an advisor's; a seat with its own type keeps it.
        const marked = cells.advisor !== null && reading.seat.type === "core" && reading.seat.fullAccess === null;
        // A bare "Lead" on a row that names a department and no division is a member of that department (issue #822).
        const member = reading.seat.fallback?.kind === "member" && cells.divisions.length === 0 && cells.departments.length > 0;
        const seat = marked ? ADVISOR_SEAT : member ? MEMBERSHIP.seat : reading.seat;
        const storedTitle = marked && title.trim() === "" ? (cells.advisor!.senior ? "Senior Advisor" : "Advisor") : reading.title;
        const placed = placements(reading, seat, cells);
        if (!Array.isArray(placed)) {
          if (!placed.reported) conflicts.push({ kind: placed.kind, at: row.at, field: placed.field });
          counter.add("roles", "refused");
          continue;
        }
        for (const place of placed) {
          const seatKey = roleSeatKey({ type: seat.type, fullAccess: seat.fullAccess, dept: place.dept });
          // A seat this row handed over this year ends on the import day: the row keeps its membership, the seat goes to its new holder.
          const handedOverSeat = handed !== undefined && seatKey !== null && handed.has(seatKey);
          const role: Omit<NewRole, "who"> = {
            ...place,
            title: storedTitle,
            type: seat.type,
            fullAccess: seat.fullAccess,
            startedAt,
            leavedAt: handedOverSeat ? today : leavedAt,
          };
          planRole(role, seatKey, handedOverSeat);
        }
      }
      // A row that handed over every seat it held keeps an active membership: a plain member's role in the row's units (none when it names none), from its stint's start.
      if (handedSeats > 0 && kept === 0) {
        const places = placements(MEMBERSHIP, MEMBERSHIP.seat, cells);
        for (const place of Array.isArray(places) ? places : [NO_PLACE]) {
          planRole({ ...place, title: MEMBERSHIP.title, type: "core", fullAccess: null, startedAt, leavedAt: null }, null, false);
        }
      }
    }

    if (alumnus) {
      if (ref.kind === "existing" && snapshot.leftMembers.has(ref.memberId)) {
        counter.add("team_leaves", "present");
      } else {
        // A year-sheet alumnus left on their Quitters day, else at the end of their last year; a quitter-only one when their stint ends.
        const last = stints[stints.length - 1];
        const left = (person.years.size > 0 && person.quitter !== null && dayOf(person.quitter.value.leftOn)) || last.leavedAt || yearEnd(last.year);
        leaves.push({ who: ref, leftAt: left });
        counter.add("team_leaves", "insert");
      }
    }
  }

  // Advisors -----------------------------------------------------------------

  const advisors: NewAdvisor[] = [];
  /** Each advisor row's fate, by its CSV line: "existing" when the database has the advisor, else the advisor's index in `advisors`. A refused row has none. */
  const advisorFate = new Map<number, "existing" | number>();
  /** The photo of each person the plan inserts, by person. */
  const memberPhotos = new Map<number, MemberPhoto>();
  const advisorKeys = new Set(snapshot.advisorNames.map((n) => nameKey(n, "")));
  /** The names earlier rows of the CSV gave: a second row for one is a duplicate. */
  const advisorRows = new Set<string>();
  const places = { ...snapshot.advisorPlaces };
  let advisorOrder = snapshot.advisorOrder;
  for (const row of sources.csv.advisors) {
    const name = `${row.value.firstName} ${row.value.lastName}`.replace(/\s+/g, " ").trim();
    const key = nameKey(name, "");
    if (advisorRows.has(key)) {
      conflicts.push({ kind: "duplicate", at: row.at });
      counter.add("team_page_advisors", "refused");
      counter.add("team_page_advisor_versions", "refused");
      continue;
    }
    advisorRows.add(key);
    if (advisorKeys.has(key)) {
      advisorFate.set(row.at.row, "existing");
      counter.add("team_page_advisors", "present");
      counter.add("team_page_advisor_versions", "present");
      continue;
    }
    const standing = /faculty|prof/i.test(row.value.title) ? "principal" : "specialist";
    const handle = linkedinHandleOf(row.value.linkedin);
    const version = { name, role: row.value.title.trim(), standing, place: places[standing] + 1, ...(handle !== null && { linkedin: handle }) };
    if (!isAdvisorVersion(version)) {
      conflicts.push({ kind: "schema-misfit", at: row.at, field: name === "" ? "first_name" : "title_name" });
      counter.add("team_page_advisors", "refused");
      counter.add("team_page_advisor_versions", "refused");
      continue;
    }
    places[standing] += 1;
    advisorFate.set(row.at.row, advisors.length);
    advisors.push({ siteOrder: ++advisorOrder, advisor: version, photo: null });
    counter.add("team_page_advisors", "insert");
    counter.add("team_page_advisor_versions", "insert");
  }

  // Photos -------------------------------------------------------------------

  const photos = photoFolder === null ? null : planPhotos(photoFolder);

  function planPhotos(folder: PhotoFolder): PhotoCounts {
    const c = {
      found: folder.files,
      matchedMembers: 0,
      matchedAdvisors: 0,
      surnameDiffers: 0,
      noIdMatch: 0,
      noSurnameMatch: 0,
      surnameAmbiguous: 0,
      alreadyPresent: 0,
      notImported: 0,
      unfit: 0,
      missing: 0,
      toUpload: 0,
    };
    const report = (kind: ConflictKind, row: number) => conflicts.push({ kind, at: photoAt({ row }) });
    const linked = new Set<string>();
    const unmatched = {
      "surname-differs": "surnameDiffers",
      "no-id-match": "noIdMatch",
      "no-surname-match": "noSurnameMatch",
      "surname-ambiguous": "surnameAmbiguous",
    } as const;
    /** The person each workbook row is, for a photo matched to an advisor's workbook row. */
    const byRow = new Map(people.flatMap((p) => [...p.years.values(), ...(p.quitter === null ? [] : [p.quitter])].map((r) => [atKey(r.at), p] as const)));
    for (const p of folder.photos) {
      if (p.kind !== "member" && p.kind !== "advisor" && p.kind !== "workbook-advisor") {
        c[unmatched[p.kind]]++;
        report(`photo-${p.kind}`, p.row);
        continue;
      }
      if (p.kind === "advisor") c.matchedAdvisors++;
      else c.matchedMembers++;
      // Which row it reaches, and whether this run inserts that row.
      const person = p.kind === "member" ? byPeopleId.get(p.id) : p.kind === "workbook-advisor" ? byRow.get(atKey(p.at)) : undefined;
      const fate = p.kind === "advisor" ? advisorFate.get(p.line) : person === undefined ? undefined : personFate.get(person.id);
      const target = p.kind === "advisor" ? `a${p.line}` : `m${person?.id}`;
      if (fate === undefined || linked.has(target)) {
        c.notImported++;
        report("photo-not-imported", p.row);
        continue;
      }
      if (fate === "existing") {
        c.alreadyPresent++;
        continue;
      }
      if (p.photo === null) {
        c.unfit++;
        report("photo-unfit", p.row);
        continue;
      }
      linked.add(target);
      c.toUpload++;
      if (p.kind === "advisor") advisors[fate as number] = { ...advisors[fate as number], photo: p.photo };
      else memberPhotos.set(person!.id, p.photo);
    }
    const missing = (at: At) => {
      c.missing++;
      conflicts.push({ kind: "photo-missing", at, field: "has_pp" });
    };
    for (const row of sources.csv.people) if (truthy(row.value.hasPhoto) && !folder.ids.has(row.value.id.trim())) missing(row.at);
    for (const row of sources.csv.advisors) if (truthy(row.value.hasPhoto) && !folder.advisorLines.has(row.at.row)) missing(row.at);
    return c;
  }

  // FAQs ---------------------------------------------------------------------

  const faqList: NewFaq[] = [];
  const questionKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
  const questions = new Set(snapshot.faqQuestions.map(questionKey));
  const questionRows = new Set<string>();
  let faqOrder = snapshot.faqOrder;
  let hiddenFaqs = 0;
  for (const row of sources.csv.faqs) {
    if (falsy(row.value.visible)) {
      hiddenFaqs++;
      continue;
    }
    const question = row.value.question.replace(/\s+/g, " ").trim();
    const answer = row.value.answer
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p !== "");
    const errors = faqFieldErrors({ question, answer });
    if (errors.question !== undefined || errors.answer !== undefined) {
      conflicts.push({ kind: "schema-misfit", at: row.at, field: errors.question !== undefined ? "question" : "answer" });
      counter.add("faqs", "refused");
      counter.add("faq_versions", "refused");
      continue;
    }
    const key = questionKey(question);
    if (questionRows.has(key)) {
      conflicts.push({ kind: "duplicate", at: row.at });
      counter.add("faqs", "refused");
      counter.add("faq_versions", "refused");
      continue;
    }
    questionRows.add(key);
    if (questions.has(key)) {
      counter.add("faqs", "present");
      counter.add("faq_versions", "present");
      continue;
    }
    faqList.push({ siteOrder: ++faqOrder, question, answer });
    counter.add("faqs", "insert");
    counter.add("faq_versions", "insert");
  }

  // Orders -------------------------------------------------------------------

  const byCsvId = new Map<string, Person>();
  for (const p of people) for (const id of p.csvIds) byCsvId.set(id, p);
  const newOrders: NewOrder[] = [];
  const orderKey = (requester: number | null, name: string | null, at: string) => `${requester ?? ""}\u0000${name ?? ""}\u0000${Date.parse(at)}`;
  const existingOrders = new Set(snapshot.orders.map((o) => orderKey(o.requester, o.name, o.createdAt)));
  for (const row of sources.csv.orders) {
    const person = byCsvId.get(row.value.requester.trim());
    const ref = person === undefined ? undefined : refOf.get(person.id);
    if (person === undefined || ref === undefined) {
      conflicts.push({ kind: "unresolved-requester", at: row.at, field: "requester" });
      counter.add("orders", "refused");
      continue;
    }
    const misfit = (field: string) => {
      conflicts.push({ kind: "schema-misfit", at: row.at, field });
      counter.add("orders", "refused");
    };
    const status = row.value.status.trim() as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) {
      misfit("status");
      continue;
    }
    const quantity = row.value.quantity.trim();
    if (quantity !== "" && !/^\d+$/.test(quantity)) {
      misfit("quantity");
      continue;
    }
    const price = row.value.price.trim();
    if (price !== "" && !/^-?\d+(\.\d+)?$/.test(price)) {
      misfit("price");
      continue;
    }
    const createdAt = row.value.createdAt.trim();
    if (Number.isNaN(Date.parse(createdAt))) {
      misfit("createdAt");
      continue;
    }
    const name = orNull(row.value.name);
    if (ref.kind === "existing" && existingOrders.has(orderKey(ref.memberId, name, createdAt))) {
      counter.add("orders", "present");
      continue;
    }
    const held = divisionsByYear.get(person.id)?.get(academicYearOf(createdAt));
    newOrders.push({
      requester: ref,
      status,
      division: held !== undefined && held.size === 1 ? [...held.values()][0] : null,
      description: orNull(row.value.description),
      reason: orNull(row.value.reason),
      quantity: quantity === "" ? null : Number(quantity),
      price: price === "" ? null : price,
      name,
      quoteName: orNull(row.value.quoteName),
      createdAt: new Date(createdAt).toISOString(),
    });
    counter.add("orders", "insert");
  }

  // Created units --------------------------------------------------------------

  const departments = book?.newDepartments() ?? [];
  const divisions = book?.newDivisions() ?? [];
  const present = book?.present() ?? { departments: 0, divisions: 0 };
  counter.add("departments", "insert", departments.length);
  counter.add("departments", "present", present.departments);
  counter.add("divisions", "insert", divisions.length);
  counter.add("divisions", "present", present.divisions);
  // A created division goes under the department of the newest sheet that pairs it, known only once every row is placed: its roles take that department.
  const roles = newRoles.map((r) => (r.division?.kind === "new" ? { ...r, dept: divisions[r.division.index].dept } : r));

  return {
    currentYear,
    departments,
    divisions,
    people: newPeople.map((p) => ({ ...p, photo: memberPhotos.get(p.person) ?? null })),
    roles,
    leaves,
    advisors,
    faqs: faqList,
    orders: newOrders,
    counts: counter.counts,
    hiddenFaqs,
    alumni,
    multiYear: people.filter((p) => p.years.size > 1).length,
    unclearQuitters: conflicts.filter((c) => UNCLEAR_QUITTER_KINDS.includes(c.kind)).length,
    swappedDates,
    handovers,
    quitterYears: quitterYearOf.size,
    unresolvedUnits: book === null ? null : book.unresolved.size,
    photos,
    conflicts: sortConflicts(conflicts),
  };
}

/** Conflicts in source order: file, sheet, row. */
function sortConflicts(list: readonly Conflict[]): Conflict[] {
  const place = (at: At) => [at.file, at.sheet ?? "", String(at.row).padStart(8, "0")].join("\u0000");
  return [...list].sort((a, b) => place(a.at).localeCompare(place(b.at)) || a.kind.localeCompare(b.kind));
}
