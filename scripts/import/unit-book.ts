import { lookupDepartment, lookupDivision, storedUnitName, unitKey, type UnitName, type Units } from "./units";

// The units a plan places roles in (issue #816): the departments and divisions
// the database holds, and the historical ones the import creates closed. A
// roster name that finds one unit is that unit. A name that finds none, on a
// past year's row, and that the current year's sheet never names, is a unit
// the team had and no longer has: the plan creates it once, with `started_at`
// the first day of the first academic year a row names it and `closed_at` the
// last day of the last one. A division the row pairs with a department is
// created under it. Every other name is unresolved, and the plan reports it.
// A second run finds the created units in the database, so it creates none.

/** A unit a role is placed in: one the database holds, or the `index`th one this plan creates. */
export type UnitRef = { readonly kind: "existing"; readonly id: number } | { readonly kind: "new"; readonly index: number };

/** A key that tells units of one level apart: an existing unit's id, or "new" and its index. */
export const refKey = (ref: UnitRef): string => (ref.kind === "existing" ? String(ref.id) : `new${ref.index}`);

/** Whether a stored unit column holds the unit a ref names. A unit this plan creates is in no stored row. */
export const holds = (id: number | null, ref: UnitRef | null): boolean => (ref === null ? id === null : ref.kind === "existing" && ref.id === id);

export type NewDepartment = { readonly name: string; readonly code: string | null; readonly startedAt: string; readonly closedAt: string };
export type NewDivision = NewDepartment & { readonly dept: UnitRef | null };

/** A division a row is placed in, and its department. */
export type PlacedDivision = { readonly ref: UnitRef; readonly dept: UnitRef | null };

type Draft = { name: string; code: string | null; first: number; last: number };

/** When a past year's unit was open: from the first day of the first year a row names it to the last day of the last one. */
const span = (d: Draft, yearStart: (y: number) => string, yearEnd: (y: number) => string) => ({
  name: d.name,
  code: d.code,
  startedAt: yearStart(d.first),
  closedAt: yearEnd(d.last),
});

export class UnitBook {
  private readonly departments: Draft[] = [];
  private readonly divisions: (Draft & { dept: UnitRef | null })[] = [];
  private readonly presentDepartments = new Set<number>();
  private readonly presentDivisions = new Set<number>();
  /** The unit keys of every name that resolved to nothing. */
  readonly unresolved = new Set<string>();

  /**
   * @param units what the database holds
   * @param current the unit keys the current year's sheet names, by level: a unit it names is no past unit, so it is never created
   * @param currentYear the current academic year: a row of any other year is a past one
   */
  constructor(
    private readonly units: Units,
    private readonly current: { readonly departments: ReadonlySet<string>; readonly divisions: ReadonlySet<string> },
    private readonly currentYear: number | null,
  ) {}

  /** The department a value names on a row of `year`, or null (noted as unresolved). */
  department(value: UnitName, year: number): UnitRef | null {
    const lookup = lookupDepartment(this.units, value);
    if (lookup.kind === "found") {
      this.presentDepartments.add(lookup.unit.id);
      return { kind: "existing", id: lookup.unit.id };
    }
    if (lookup.kind === "absent" && this.isPast(year) && !this.current.departments.has(unitKey(value.name))) {
      return { kind: "new", index: this.draft(this.departments, value, year) };
    }
    this.unresolved.add(unitKey(value.name));
    return null;
  }

  /** The division a value names on a row of `year`, with its department; a created one goes under `pairedWith`. Null when it is unresolved. */
  division(value: UnitName, year: number, pairedWith: UnitRef | null): PlacedDivision | null {
    const lookup = lookupDivision(this.units, value);
    if (lookup.kind === "found") {
      this.presentDivisions.add(lookup.unit.id);
      return { ref: { kind: "existing", id: lookup.unit.id }, dept: lookup.unit.deptId === null ? null : { kind: "existing", id: lookup.unit.deptId } };
    }
    if (lookup.kind === "absent" && this.isPast(year) && !this.current.divisions.has(unitKey(value.name))) {
      const index = this.draft(this.divisions, value, year, pairedWith);
      return { ref: { kind: "new", index }, dept: this.divisions[index].dept };
    }
    this.unresolved.add(unitKey(value.name));
    return null;
  }

  /** The department an existing unit name finds, without noting anything: for reading a current-year row's seats ahead of the plan. */
  peekDepartment(value: UnitName): UnitRef | null {
    const lookup = lookupDepartment(this.units, value);
    return lookup.kind === "found" ? { kind: "existing", id: lookup.unit.id } : null;
  }

  /** The departments the plan creates, closed. */
  newDepartments(yearStart: (y: number) => string, yearEnd: (y: number) => string): NewDepartment[] {
    return this.departments.map((d) => span(d, yearStart, yearEnd));
  }

  /** The divisions the plan creates, closed. */
  newDivisions(yearStart: (y: number) => string, yearEnd: (y: number) => string): NewDivision[] {
    return this.divisions.map((d) => ({ ...span(d, yearStart, yearEnd), dept: d.dept }));
  }

  /** How many distinct departments and divisions the database already holds that the roster names. */
  present(): { departments: number; divisions: number } {
    return { departments: this.presentDepartments.size, divisions: this.presentDivisions.size };
  }

  private isPast(year: number): boolean {
    return this.currentYear !== null && year < this.currentYear;
  }

  /** The draft a name is, made on first sight: later sights widen its years, give it a code it lacked, and pair it if it was not. */
  private draft<D extends Draft & { dept?: UnitRef | null }>(list: D[], value: UnitName, year: number, dept?: UnitRef | null): number {
    const key = unitKey(value.name);
    let index = list.findIndex((d) => unitKey(d.name) === key);
    if (index === -1) {
      list.push({ name: storedUnitName(value), code: value.code, first: year, last: year, ...(dept !== undefined && { dept }) } as D);
      index = list.length - 1;
    }
    const d = list[index];
    d.first = Math.min(d.first, year);
    d.last = Math.max(d.last, year);
    if (d.code === null) d.code = value.code;
    if (dept != null && d.dept === null) d.dept = dept;
    return index;
  }
}
