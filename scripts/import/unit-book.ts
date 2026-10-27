import { yearEnd, yearStart } from "./academic-year";
import { lookupDepartment, lookupDivision, storedUnitName, unitKey, type UnitName, type Units } from "./units";

// The units a plan places roles in (issue #816): the departments and divisions
// the database holds, and the ones the import creates. A roster name that
// finds one unit is that unit. A name that finds none is created once, with
// `started_at` the first day of the first academic year a row names it. When
// the current year's sheet names it, it is a unit the team has now: it is
// created open, with no `closed_at` (owner decision). Otherwise it is a unit
// the team had and no longer has: it is created closed, `closed_at` the last
// day of the last academic year a row names it. A division the row pairs with
// a department is created under it. A name two units share, or one that is
// only a level word ("Department"), is unresolved, and the plan reports it. A second run finds the created units in the database,
// so it creates none.

/** A unit a role is placed in: one the database holds, or the `index`th one this plan creates. */
export type UnitRef = { readonly kind: "existing"; readonly id: number } | { readonly kind: "new"; readonly index: number };

/** A key that tells units of one level apart: an existing unit's id, or "new" and its index. */
export const refKey = (ref: UnitRef): string => (ref.kind === "existing" ? String(ref.id) : `new${ref.index}`);

/** Whether a stored unit column holds the unit a ref names. A unit this plan creates is in no stored row. */
export const holds = (id: number | null, ref: UnitRef | null): boolean => (ref === null ? id === null : ref.kind === "existing" && ref.id === id);

/** A unit the plan creates. `closedAt` null: open, a unit the current year's sheet names; else the day it closed. */
export type NewDepartment = { readonly name: string; readonly code: string | null; readonly startedAt: string; readonly closedAt: string | null };
export type NewDivision = NewDepartment & { readonly dept: UnitRef | null };

/** A division a row is placed in, and its department. */
export type PlacedDivision = { readonly ref: UnitRef; readonly dept: UnitRef | null };

type Draft = { name: string; code: string | null; first: number; last: number };

export class UnitBook {
  private readonly departments: Draft[] = [];
  private readonly divisions: (Draft & { dept: UnitRef | null })[] = [];
  private readonly presentDepartments = new Set<number>();
  private readonly presentDivisions = new Set<number>();
  /** The unit keys of every name that resolved to nothing. */
  readonly unresolved = new Set<string>();

  /**
   * @param units what the database holds
   * @param current the unit keys the current year's sheet names, by level: a unit it names is created open
   */
  constructor(
    private readonly units: Units,
    private readonly current: { readonly departments: ReadonlySet<string>; readonly divisions: ReadonlySet<string> },
  ) {}

  /** The department a value names on a row of `year`, or null when two units share the name (noted as unresolved). */
  department(value: UnitName, year: number): UnitRef | null {
    const lookup = lookupDepartment(this.units, value);
    if (lookup.kind === "found") {
      this.presentDepartments.add(lookup.unit.id);
      return { kind: "existing", id: lookup.unit.id };
    }
    if (lookup.kind === "absent" && unitKey(value.name) !== "") return { kind: "new", index: this.draft(this.departments, value, year) };
    this.unresolved.add(unitKey(value.name));
    return null;
  }

  /** The division a value names on a row of `year`, with its department; a created one goes under `pairedWith`. Null when two units share the name. */
  division(value: UnitName, year: number, pairedWith: UnitRef | null): PlacedDivision | null {
    const lookup = lookupDivision(this.units, value);
    if (lookup.kind === "found") {
      this.presentDivisions.add(lookup.unit.id);
      return { ref: { kind: "existing", id: lookup.unit.id }, dept: lookup.unit.deptId === null ? null : { kind: "existing", id: lookup.unit.deptId } };
    }
    if (lookup.kind === "absent" && unitKey(value.name) !== "") {
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

  /** The departments the plan creates, open or closed. */
  newDepartments(): NewDepartment[] {
    return this.departments.map((d) => this.span(d, this.current.departments));
  }

  /** The divisions the plan creates, open or closed. */
  newDivisions(): NewDivision[] {
    return this.divisions.map((d) => ({ ...this.span(d, this.current.divisions), dept: d.dept }));
  }

  /** When a created unit opened, and whether it is open: one the current sheet names is; any other closed at the end of the last year a row names it. */
  private span(d: Draft, current: ReadonlySet<string>): NewDepartment {
    return { name: d.name, code: d.code, startedAt: yearStart(d.first), closedAt: current.has(unitKey(d.name)) ? null : yearEnd(d.last) };
  }

  /** How many distinct departments and divisions the database already holds that the roster names. */
  present(): { departments: number; divisions: number } {
    return { departments: this.presentDepartments.size, divisions: this.presentDivisions.size };
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
