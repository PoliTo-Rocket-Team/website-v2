import { yearEnd, yearStart } from "./academic-year";
import { codeKey, lookupDepartment, lookupDivision, storedUnitName, unitKey, type Lookup, type UnitName, type Units } from "./units";

// The units a plan places roles in (issues #816, #818): the departments and
// divisions the database holds, and the ones the import creates. A roster name
// that finds one unit is that unit. A name that finds none is created once,
// with `started_at` the first day of the first academic year a row names it.
// When the current year's sheet names it, it is a unit the team has now: it is
// created open, with no `closed_at` (owner decision). Otherwise it is a unit
// the team had and no longer has: it is created closed, `closed_at` the last
// day of the last academic year a row names it. A division the rows pair with
// a department is created under one (see below). A name two units share, or one that is
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
// often on the newest sheet that gives it. A group whose spellings find one
// unit in the database is that unit; one whose spellings find two or more is
// unresolved, and the plan reports it rather than create a third.
//
// A division is also told apart by the department its row pairs it with
// (issue #820): two values with one name under different departments are two
// divisions ("Avionics" under Cavour, "Avionics" under Vittorio Emanuele II),
// unless they carry the same code. A value its row pairs with no department
// joins the group of its name the newest sheet pairs. A created division goes
// under the department the newest sheet that pairs it names.

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

/**
 * One value a row gives: the academic year of its sheet (a `Quitters` row
 * counts as older than any), whether the current year's sheet gives it, and,
 * for a division, the department fold's group of the department its row pairs
 * it with (null for a department, or a division paired with none).
 */
export type Sighting = { readonly value: UnitName; readonly year: number; readonly current: boolean; readonly parent: string | null };

/** The name and code a created unit takes. */
type Naming = { readonly name: string; readonly code: string | null };

/** A value's fold nodes: its name key, its name node, its code node (null when it has no code) and the code node its name spells. */
type Nodes = { readonly key: string; readonly name: string; readonly code: string | null; readonly asCode: string };

/**
 * The roster's values of one level, grouped into the units they spell. Nodes
 * are a value's name key (`n:`, with `@` and its parent when its row pairs it
 * with a department) and its code key (`c:`, which keeps a plural "s"); a coded
 * value joins its two, and a name joins the code its text spells, so a bare
 * "VES" joins the "(VES)" code. A name under one parent never joins the same name under
 * another, except through a code. A name with no parent joins the group its
 * name has under the parent of the newest sheet, unless its code already
 * joins it to a parent. The groups are fixed once built: a value no row gave
 * is placed by what it shares with them, and never joins two.
 */
export class UnitFold {
  private readonly parent = new Map<string, string>();
  /** The name nodes of each name key, in the order they were given. */
  private readonly namesOf = new Map<string, string[]>();
  /** The name nodes whose name, read as a code, is each code node: a bare "VES" for "c:ves". */
  private readonly twinsOf = new Map<string, string[]>();
  /** The sightings of each group, in the order they were given. */
  private readonly byGroup = new Map<string, Sighting[]>();

  /**
   * @param sightings every value the rows give
   * @param known the database's units of this level: each joins its name to its code, so values that spell one by name and by code are one group. They are no sighting: they give a group no value, name or open state.
   */
  constructor(sightings: readonly Sighting[], known: readonly Naming[] = []) {
    for (const k of known) {
      const nodes = UnitFold.nodesOf({ kind: "unit", ...k }, null);
      if (nodes === null) continue;
      this.addName(nodes);
      if (nodes.code !== null) this.union(nodes.name, this.addCode(nodes.code));
    }
    for (const s of sightings) {
      const nodes = UnitFold.nodesOf(s.value, s.parent);
      if (nodes === null) continue;
      this.addName(nodes);
      if (nodes.code !== null) this.union(nodes.name, this.addCode(nodes.code));
    }
    this.joinUnpaired(sightings);
    for (const s of sightings) {
      const group = this.group(s.value, s.parent);
      if (group !== null) this.byGroup.set(group, [...(this.byGroup.get(group) ?? []), s]);
    }
  }

  /**
   * The group a value is in, under `parent`: its name's, else its code's, else
   * the code its name spells; a value that shares none of them is a group of
   * its own. Null for a value with no name and no code to group by (only a
   * level word).
   */
  group(value: UnitName, parent: string | null = null): string | null {
    const nodes = UnitFold.nodesOf(value, parent);
    if (nodes === null) return null;
    for (const node of [nodes.name, ...(nodes.code === null ? [] : [nodes.code]), nodes.asCode]) {
      if (this.parent.has(node)) return this.find(node);
    }
    return nodes.name;
  }

  /**
   * A value's nodes: its name node (its name key, with `@` and its parent when
   * it has one), its code node, and the code node its name spells. A name is
   * keyed without a word's plural "s", a code with it (issue #820), so "OPS"
   * and "OP" stay two codes. Null for a value whose name key is empty.
   */
  private static nodesOf(value: UnitName, parent: string | null): Nodes | null {
    const name = unitKey(value.name);
    if (name === "") return null;
    const code = value.code === null ? "" : codeKey(value.code);
    return { key: name, name: parent === null ? `n:${name}` : `n:${name}@${parent}`, code: code === "" ? null : `c:${code}`, asCode: `c:${codeKey(value.name)}` };
  }

  /** Joins each name with no parent to its name's group under the parent of the newest sheet (the first read on a tie), unless its group already has a parent. */
  private joinUnpaired(sightings: readonly Sighting[]): void {
    const newest = new Map<string, number>();
    for (const s of sightings) {
      const group = s.parent === null ? null : this.group(s.value, s.parent);
      if (group !== null) newest.set(group, Math.max(newest.get(group) ?? Number.NEGATIVE_INFINITY, s.year));
    }
    for (const s of sightings) {
      const nodes = s.parent === null ? UnitFold.nodesOf(s.value, null) : null;
      if (nodes === null || newest.has(this.find(nodes.name))) continue;
      let best: { group: string; year: number } | null = null;
      for (const node of this.namesOf.get(nodes.key) ?? []) {
        const year = newest.get(this.find(node));
        if (node !== nodes.name && year !== undefined && (best === null || year > best.year)) best = { group: this.find(node), year };
      }
      if (best !== null) this.union(best.group, nodes.name);
    }
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

  /** Adds a value's name node, joined to the code node its name spells. */
  private addName(nodes: Nodes): void {
    if (this.parent.has(nodes.name)) return;
    this.parent.set(nodes.name, nodes.name);
    if (this.parent.has(nodes.asCode)) this.union(nodes.name, nodes.asCode);
    this.namesOf.set(nodes.key, [...(this.namesOf.get(nodes.key) ?? []), nodes.name]);
    this.twinsOf.set(nodes.asCode, [...(this.twinsOf.get(nodes.asCode) ?? []), nodes.name]);
  }

  /** Adds a code node, joined to every name node (under any parent) whose name spells it. */
  private addCode(node: string): string {
    if (this.parent.has(node)) return node;
    this.parent.set(node, node);
    for (const name of this.twinsOf.get(node) ?? []) this.union(node, name);
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

/** A unit being created: its group, the name and code of its first value, the years placed rows name it, and the values those rows give. */
type Draft = { group: string; name: string; code: string | null; first: number; last: number; values: UnitName[] };

/** A department a placed row pairs a division with, and the row's academic year. */
type Pairing = { readonly year: number; readonly dept: UnitRef };

/** A division being created, and every department placed rows pair it with. */
type DivisionDraft = Draft & { pairings: Pairing[] };

/** The department a row pairs a division with: its value, and the unit it resolved to (null when it resolved to none). */
export type PairedDepartment = { readonly value: UnitName; readonly ref: UnitRef | null };

/** The department of the newest sheet that pairs a division: the one its rows of that year pair it with most often (the first read on a tie); null when no row pairs it. */
function newestPairing(pairings: readonly Pairing[]): UnitRef | null {
  if (pairings.length === 0) return null;
  const newest = Math.max(...pairings.map((p) => p.year));
  const tally = new Map<string, { dept: UnitRef; count: number }>();
  for (const p of pairings) {
    if (p.year !== newest) continue;
    const entry = tally.get(refKey(p.dept)) ?? { dept: p.dept, count: 0 };
    tally.set(refKey(p.dept), { ...entry, count: entry.count + 1 });
  }
  return [...tally.values()].reduce((a, b) => (b.count > a.count ? b : a)).dept;
}

export class UnitBook {
  private readonly departments: Draft[] = [];
  private readonly divisions: DivisionDraft[] = [];
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
    if (lookup.kind === "absent" && group !== null) return { kind: "new", index: this.draft(this.departments, group, value, year, (base) => base) };
    this.unresolved.add(unitKey(value.name));
    return null;
  }

  /**
   * The division a value names on a row of `year` that pairs it with
   * `paired`, with its department. Its name finds a database division only
   * under that department, or under none. A created one goes under the
   * department of the newest sheet that pairs it: the department returned here
   * is the one so far, and the plan's last step gives its roles the final one.
   * Null when two units share the name.
   */
  division(value: UnitName, year: number, paired: PairedDepartment | null): PlacedDivision | null {
    const parent = paired === null ? null : this.folds.departments.group(paired.value);
    const group = this.folds.divisions.group(value, parent);
    const under = paired?.ref == null ? undefined : { deptId: paired.ref.kind === "existing" ? paired.ref.id : null };
    const lookup = this.lookup(this.folds.divisions, value, group, (v) => lookupDivision(this.units, v, under));
    if (lookup.kind === "found") {
      this.presentDivisions.add(lookup.unit.id);
      return { ref: { kind: "existing", id: lookup.unit.id }, dept: lookup.unit.deptId === null ? null : { kind: "existing", id: lookup.unit.deptId } };
    }
    if (lookup.kind === "absent" && group !== null) {
      const index = this.draft(this.divisions, group, value, year, (base) => ({ ...base, pairings: [] }));
      const d = this.divisions[index];
      if (paired?.ref != null) d.pairings.push({ year, dept: paired.ref });
      return { ref: { kind: "new", index }, dept: newestPairing(d.pairings) };
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
    return this.divisions.map((d) => ({ ...this.span(d, this.folds.divisions), dept: newestPairing(d.pairings) }));
  }

  /** How many distinct departments and divisions the database already holds that the roster names. */
  present(): { departments: number; divisions: number } {
    return { departments: this.presentDepartments.size, divisions: this.presentDivisions.size };
  }

  /**
   * What a value finds in the database: by itself, else, when it finds no one
   * unit, what the other values of its group find. One unit: that unit (so a
   * name two units share, as "Mission Analysis" on a row with no department,
   * is the one its group's code finds). None: absent, so the group is created,
   * unless a value of the group is a name two units share. More than one, or
   * a name two units share with nothing to tell them apart: ambiguous, so the
   * value is unresolved and never created as a unit of its own beside them.
   */
  private lookup<U extends { readonly id: number }>(fold: UnitFold, value: UnitName, group: string | null, find: (v: UnitName) => Lookup<U>): Lookup<U> {
    const own = find(value);
    if (own.kind === "found" || group === null) return own;
    const found = new Map<number, U>();
    let shared = own.kind === "ambiguous";
    for (const other of fold.values(group)) {
      const hit = find(other);
      if (hit.kind === "ambiguous") shared = true;
      if (hit.kind === "found") found.set(hit.unit.id, hit.unit);
    }
    if (found.size === 1) return { kind: "found", unit: [...found.values()][0] };
    return found.size > 1 || shared ? { kind: "ambiguous" } : own;
  }

  /**
   * When a created unit opened, its name, whether it is open, and its
   * spellings: the name, the open state and the spellings all come from every
   * value the rows give in the group (refused rows included), so the report
   * never names a unit after a spelling it does not list. A unit opens on the
   * first year a placed row names it; one the current sheet does not give
   * closes at the end of the last such year.
   */
  private span(d: Draft, fold: UnitFold): NewDepartment {
    const { name, code } = fold.naming(d.group) ?? d;
    const spellings = [...new Set([...fold.values(d.group), ...d.values].map(spellingOf))];
    return { name, code, startedAt: yearStart(d.first), closedAt: fold.isCurrent(d.group) ? null : yearEnd(d.last), spellings };
  }

  /** The draft a value's group is, made on first sight by `make`: later sights widen its years, give it a code it lacked, and add their value. */
  private draft<D extends Draft>(list: D[], group: string, value: UnitName, year: number, make: (base: Draft) => D): number {
    let index = list.findIndex((d) => d.group === group);
    if (index === -1) {
      list.push(make({ group, name: storedUnitName(value), code: value.code, first: year, last: year, values: [] }));
      index = list.length - 1;
    }
    const d = list[index];
    d.first = Math.min(d.first, year);
    d.last = Math.max(d.last, year);
    if (d.code === null) d.code = value.code;
    d.values.push(value);
    return index;
  }
}
