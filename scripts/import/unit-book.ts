import { yearEnd, yearStart } from "./academic-year";
import { lookupDepartment, lookupDivision, storedUnitName, unitKey, type Lookup, type UnitName, type Units } from "./units";

// The units a plan places roles in (issues #816, #818): the departments and
// divisions the database holds, and the ones the import creates. A roster name
// that finds one unit is that unit. A name that finds none is created once,
// with `started_at` the first day of the first academic year a row names it.
// When the current year's sheet names it, it is a unit the team has now: it is
// created open, with no `closed_at` (owner decision). Otherwise it is a unit
// the team had and no longer has: it is created closed, `closed_at` the last
// day of the last academic year a row names it. A division the row pairs with
// a department is created under it. A name two units share, or one that is
// only a level word ("Department"), is unresolved, and the plan reports it. A
// second run finds the created units in the database, so it creates none.
//
// The roster spells one unit several ways (issue #818): "Optimization and
// Analysis (AOA)" and "Aerodynamic Optimization and Analysis (AOA)", or a bare
// "VES" beside "Vittorio Emanuele II (VES)". So before anything is resolved,
// the plan shows a `UnitFold` every value its rows give, and the fold groups
// them: values that share a name or a code in parentheses are one unit, and so
// is a bare value equal to a code. A group is created once, open when any of
// its spellings is on the current sheet, and named as its code is spelt most
// often on the newest sheet that gives it. A group one of whose spellings
// finds one unit in the database is that unit.

/** A unit a role is placed in: one the database holds, or the `index`th one this plan creates. */
export type UnitRef = { readonly kind: "existing"; readonly id: number } | { readonly kind: "new"; readonly index: number };

/** A key that tells units of one level apart: an existing unit's id, or "new" and its index. */
export const refKey = (ref: UnitRef): string => (ref.kind === "existing" ? String(ref.id) : `new${ref.index}`);

/** Whether a stored unit column holds the unit a ref names. A unit this plan creates is in no stored row. */
export const holds = (id: number | null, ref: UnitRef | null): boolean => (ref === null ? id === null : ref.kind === "existing" && ref.id === id);

/**
 * A unit the plan creates. `closedAt` null: open, a unit the current year's
 * sheet names; else the day it closed. `spellings`: the distinct roster
 * values folded into it, for the report.
 */
export type NewDepartment = {
  readonly name: string;
  readonly code: string | null;
  readonly startedAt: string;
  readonly closedAt: string | null;
  readonly spellings: readonly string[];
};
export type NewDivision = NewDepartment & { readonly dept: UnitRef | null };

/** A division a row is placed in, and its department. */
export type PlacedDivision = { readonly ref: UnitRef; readonly dept: UnitRef | null };

/** A roster value as the report prints it: its name, and its code in parentheses. */
export const spellingOf = (value: UnitName): string => (value.code === null ? value.name : `${value.name} (${value.code})`);

/** One value a row gives: the academic year of its sheet (a `Quitters` row counts as older than any), and whether the current year's sheet gives it. */
export type Sighting = { readonly value: UnitName; readonly year: number; readonly current: boolean };

/** The name and code a created unit takes. */
type Naming = { readonly name: string; readonly code: string | null };

/**
 * The roster's values of one level, grouped into the units they spell. Nodes
 * are a value's name key (`n:`) and its code key (`c:`); a coded value joins
 * its two, and a name key joins the code key with the same text, so a bare
 * "VES" joins the "(VES)" code. The groups are fixed once built: a value no
 * row gave is placed by what it shares with them, and never joins two.
 */
export class UnitFold {
  private readonly parent = new Map<string, string>();
  /** The sightings of each group, in the order they were given. */
  private readonly byGroup = new Map<string, Sighting[]>();

  constructor(sightings: readonly Sighting[]) {
    for (const s of sightings) {
      const [name, code] = UnitFold.nodesOf(s.value).map((node) => this.add(node));
      if (name !== undefined && code !== undefined) this.union(name, code);
    }
    for (const s of sightings) {
      const group = this.group(s.value);
      if (group !== null) this.byGroup.set(group, [...(this.byGroup.get(group) ?? []), s]);
    }
  }

  /**
   * The group a value is in: its name's, else its code's, else the code its
   * name spells; a value that shares none of them is a group of its own. Null
   * for a value with no name and no code to group by (only a level word).
   */
  group(value: UnitName): string | null {
    const [name, code] = UnitFold.nodesOf(value);
    if (name === undefined) return null;
    for (const node of [name, ...(code === undefined ? [] : [code]), `c:${name.slice(2)}`]) {
      if (this.parent.has(node)) return this.find(node);
    }
    return name;
  }

  /** A value's name node, then its code node: none for a key that is empty. A value with no name key is grouped by nothing. */
  private static nodesOf(value: UnitName): [] | [string] | [string, string] {
    const name = unitKey(value.name);
    const code = value.code === null ? "" : unitKey(value.code);
    if (name === "") return [];
    return code === "" ? [`n:${name}`] : [`n:${name}`, `c:${code}`];
  }

  /** Whether the current year's sheet gives any value of the group. */
  isCurrent(group: string): boolean {
    return this.of(group).some((s) => s.current);
  }

  /** Every value the rows give in the group. */
  values(group: string): UnitName[] {
    return this.of(group).map((s) => s.value);
  }

  /**
   * The name and code a group's unit takes: of the values carrying a code, the
   * name spelt most often on the newest sheet that gives one (the first read
   * on a tie), with its code. A group with no code is named the same way from
   * all its values. Null when no row gives the group.
   */
  naming(group: string): Naming | null {
    const seen = this.of(group);
    const coded = seen.filter((s) => s.value.code !== null);
    const pool = coded.length > 0 ? coded : seen;
    if (pool.length === 0) return null;
    const newest = Math.max(...pool.map((s) => s.year));
    const tally = new Map<string, { count: number; code: string | null }>();
    for (const s of pool) {
      if (s.year !== newest) continue;
      const name = storedUnitName(s.value);
      const entry = tally.get(name) ?? { count: 0, code: s.value.code };
      tally.set(name, { ...entry, count: entry.count + 1 });
    }
    // A Map keeps the order names were first read in, so the first of the most frequent wins a tie.
    const [name, best] = [...tally].reduce((a, b) => (b[1].count > a[1].count ? b : a));
    return { name, code: best.code };
  }

  private of(group: string): readonly Sighting[] {
    return this.byGroup.get(group) ?? [];
  }

  /** Adds a node, joined to its twin (the code key with a name key's text, or the name key with a code key's). */
  private add(node: string): string {
    if (!this.parent.has(node)) {
      this.parent.set(node, node);
      const twin = `${node.startsWith("n:") ? "c:" : "n:"}${node.slice(2)}`;
      if (this.parent.has(twin)) this.union(node, twin);
    }
    return node;
  }

  private find(node: string): string {
    let root = node;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    this.parent.set(node, root);
    return root;
  }

  private union(a: string, b: string): void {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

type Draft = { group: string; name: string; code: string | null; first: number; last: number; spellings: Set<string> };

export class UnitBook {
  private readonly departments: Draft[] = [];
  private readonly divisions: (Draft & { dept: UnitRef | null })[] = [];
  private readonly presentDepartments = new Set<number>();
  private readonly presentDivisions = new Set<number>();
  /** The unit keys of every name that resolved to nothing. */
  readonly unresolved = new Set<string>();

  /**
   * @param units what the database holds
   * @param folds every value the rows give, grouped, by level: a group is created once, open when the current year's sheet gives it
   */
  constructor(
    private readonly units: Units,
    private readonly folds: { readonly departments: UnitFold; readonly divisions: UnitFold },
  ) {}

  /** The department a value names on a row of `year`, or null when two units share the name (noted as unresolved). */
  department(value: UnitName, year: number): UnitRef | null {
    const group = this.folds.departments.group(value);
    const lookup = this.lookup(this.folds.departments, value, group, (v) => lookupDepartment(this.units, v));
    if (lookup.kind === "found") {
      this.presentDepartments.add(lookup.unit.id);
      return { kind: "existing", id: lookup.unit.id };
    }
    if (lookup.kind === "absent" && group !== null) return { kind: "new", index: this.draft(this.departments, group, value, year) };
    this.unresolved.add(unitKey(value.name));
    return null;
  }

  /** The division a value names on a row of `year`, with its department; a created one goes under `pairedWith`. Null when two units share the name. */
  division(value: UnitName, year: number, pairedWith: UnitRef | null): PlacedDivision | null {
    const group = this.folds.divisions.group(value);
    const lookup = this.lookup(this.folds.divisions, value, group, (v) => lookupDivision(this.units, v));
    if (lookup.kind === "found") {
      this.presentDivisions.add(lookup.unit.id);
      return { ref: { kind: "existing", id: lookup.unit.id }, dept: lookup.unit.deptId === null ? null : { kind: "existing", id: lookup.unit.deptId } };
    }
    if (lookup.kind === "absent" && group !== null) {
      const index = this.draft(this.divisions, group, value, year, pairedWith);
      return { ref: { kind: "new", index }, dept: this.divisions[index].dept };
    }
    this.unresolved.add(unitKey(value.name));
    return null;
  }

  /** The departments the plan creates, open or closed. */
  newDepartments(): NewDepartment[] {
    return this.departments.map((d) => this.span(d, this.folds.departments));
  }

  /** The divisions the plan creates, open or closed. */
  newDivisions(): NewDivision[] {
    return this.divisions.map((d) => ({ ...this.span(d, this.folds.divisions), dept: d.dept }));
  }

  /** How many distinct departments and divisions the database already holds that the roster names. */
  present(): { departments: number; divisions: number } {
    return { departments: this.presentDepartments.size, divisions: this.presentDivisions.size };
  }

  /** What a value finds in the database: by itself, else, when it finds nothing, the one unit the other values of its group find. */
  private lookup<U extends { readonly id: number }>(fold: UnitFold, value: UnitName, group: string | null, find: (v: UnitName) => Lookup<U>): Lookup<U> {
    const own = find(value);
    if (own.kind !== "absent" || group === null) return own;
    const found = new Map<number, U>();
    for (const other of fold.values(group)) {
      const hit = find(other);
      if (hit.kind === "found") found.set(hit.unit.id, hit.unit);
    }
    return found.size === 1 ? { kind: "found", unit: [...found.values()][0] } : own;
  }

  /** When a created unit opened, its name, and whether it is open: one whose group the current sheet gives is; any other closed at the end of the last year a row names it. */
  private span(d: Draft, fold: UnitFold): NewDepartment {
    const { name, code } = fold.naming(d.group) ?? d;
    return { name, code, startedAt: yearStart(d.first), closedAt: fold.isCurrent(d.group) ? null : yearEnd(d.last), spellings: [...d.spellings] };
  }

  /** The draft a value's group is, made on first sight: later sights widen its years, give it a code it lacked, add their spelling, and pair it if it was not. */
  private draft<D extends Draft & { dept?: UnitRef | null }>(list: D[], group: string, value: UnitName, year: number, dept?: UnitRef | null): number {
    let index = list.findIndex((d) => d.group === group);
    if (index === -1) {
      list.push({ group, name: storedUnitName(value), code: value.code, first: year, last: year, spellings: new Set(), ...(dept !== undefined && { dept }) } as D);
      index = list.length - 1;
    }
    const d = list[index];
    d.first = Math.min(d.first, year);
    d.last = Math.max(d.last, year);
    if (d.code === null) d.code = value.code;
    d.spellings.add(spellingOf(value));
    if (dept != null && d.dept === null) d.dept = dept;
    return index;
  }
}
