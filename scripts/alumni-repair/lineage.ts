import { yearEnd, yearStart } from "./academic-year";
import { codeKey, unitKey, type Department, type Division, type Units } from "./units";

// The propulsion lineage (owner decision, issue #913): "Liquid Propulsion",
// "Efesto" and "Propulsion" are one team. Its roles up to and including
// 2023-2024 sit under "Efesto"; its roles from 2024-2025 on sit under
// "Propulsion". A role's year is the academic year its start day falls in.
// A role moves to its period's department, and its division to the division
// of that department with the same name or code; when that department has
// none, one closed division is created there for every role that needs it,
// and source divisions that share a name or a code share that one division.
// Nothing is deleted: a department left with no role stays as it is.

/** The lineage's departments, by name, and the last academic year its roles sit under Efesto. */
export const LINEAGE = { names: ["Liquid Propulsion", "Efesto", "Propulsion"], early: "Efesto", late: "Propulsion", lastEarlyYear: 2023 } as const;

/** A division a role is placed in: one the database holds, or one the plan creates (its index in `Lineage.created()`). */
export type DivisionRef = { readonly kind: "existing"; readonly id: number } | { readonly kind: "new"; readonly index: number };

/** A closed division the plan creates under a lineage department: its span runs over the academic years of the roles placed in it. */
export type NewDivision = { readonly deptId: number; readonly name: string; readonly code: string | null; readonly startedAt: string; readonly closedAt: string };

/** Why a lineage role cannot be placed: its target department has, or would get from this plan, two divisions that match; or its division sits under a department outside the lineage. */
export type LeftReason = "ambiguous-division" | "division-outside-lineage";

/**
 * Where a lineage role goes: its period's department and the division there
 * (one the database holds, or one to create there from the role's division);
 * or why it stays. Working this out writes nothing to the plan: `commit` does.
 */
export type LineagePlace =
  | {
      readonly kind: "placed";
      readonly deptId: number;
      readonly division: null | { readonly kind: "existing"; readonly id: number } | { readonly kind: "create"; readonly from: Division };
    }
  | { readonly kind: "left"; readonly reason: LeftReason };

type Planned = { deptId: number; name: string; code: string | null; first: number; last: number };

/** Two divisions are the same when their names match, or when both carry a code and the codes match. */
function same(a: { readonly name: string; readonly code: string | null }, b: { readonly name: string; readonly code: string | null }): boolean {
  return unitKey(a.name) === unitKey(b.name) || (a.code !== null && b.code !== null && codeKey(a.code) === codeKey(b.code));
}

export class Lineage {
  private readonly planned: Planned[] = [];

  private constructor(
    private readonly units: Units,
    readonly early: Department,
    readonly late: Department,
    /** Every lineage department's id. */
    private readonly ids: ReadonlySet<number>,
  ) {}

  /** The lineage among the database's departments; an error text when Efesto or Propulsion is not exactly one department. */
  static of(units: Units): Lineage | string {
    const named = (name: string) => units.departments.filter((d) => unitKey(d.name) === unitKey(name));
    const [early, late] = [named(LINEAGE.early), named(LINEAGE.late)];
    if (early.length !== 1 || late.length !== 1) {
      return `the database needs exactly one "${LINEAGE.early}" and one "${LINEAGE.late}" department; it has ${early.length} and ${late.length}`;
    }
    const ids = new Set(LINEAGE.names.flatMap((n) => named(n).map((d) => d.id)));
    return new Lineage(units, early[0], late[0], ids);
  }

  /** The lineage's departments the database holds, in id order. */
  departments(): Department[] {
    return this.units.departments.filter((d) => this.ids.has(d.id));
  }

  includes(deptId: number | null): boolean {
    return deptId !== null && this.ids.has(deptId);
  }

  /** The department the lineage's roles of academic year `year` sit under. */
  targetOf(year: number): Department {
    return year <= LINEAGE.lastEarlyYear ? this.early : this.late;
  }

  /** The divisions under any lineage department: a Quitters row's division of the lineage is looked for among them. */
  divisions(): Division[] {
    return this.units.divisions.filter((d) => this.includes(d.deptId));
  }

  /** Where a lineage role of academic year `year`, in `division` (or none), goes. */
  place(year: number, division: Division | null): LineagePlace {
    const target = this.targetOf(year);
    if (division === null) return { kind: "placed", deptId: target.id, division: null };
    if (division.deptId === target.id) return { kind: "placed", deptId: target.id, division: { kind: "existing", id: division.id } };
    if (division.deptId !== null && !this.includes(division.deptId)) return { kind: "left", reason: "division-outside-lineage" };
    const there = this.units.divisions.filter((d) => d.deptId === target.id && same(d, division));
    if (there.length > 1) return { kind: "left", reason: "ambiguous-division" };
    if (there.length === 1) return { kind: "placed", deptId: target.id, division: { kind: "existing", id: there[0].id } };
    if (this.plannedFor(target.id, division).length > 1) return { kind: "left", reason: "ambiguous-division" };
    return { kind: "placed", deptId: target.id, division: { kind: "create", from: division } };
  }

  /** The division a placed role of academic year `year` is stored with: a division to create is planned once, its span widened to `year`. */
  commit(place: Extract<LineagePlace, { kind: "placed" }>, year: number): DivisionRef | null {
    const d = place.division;
    if (d === null || d.kind === "existing") return d;
    return { kind: "new", index: this.create(place.deptId, d.from, year) };
  }

  /** The indexes of the divisions already planned under `deptId` that are the same as `division`, by name or by code. */
  private plannedFor(deptId: number, division: Division): number[] {
    return this.planned.flatMap((p, index) => (p.deptId === deptId && same(p, division) ? [index] : []));
  }

  /**
   * The closed division under `deptId` that takes `division`'s roles: one
   * planned division per shared name or code, its span widened to `year`.
   * `place` already left a division that matches two planned ones; when a
   * row's own earlier unit made a second match since, the first planned stays.
   */
  private create(deptId: number, division: Division, year: number): number {
    const [known] = this.plannedFor(deptId, division);
    if (known !== undefined) {
      const p = this.planned[known];
      p.first = Math.min(p.first, year);
      p.last = Math.max(p.last, year);
      return known;
    }
    this.planned.push({ deptId, name: division.name, code: division.code, first: year, last: year });
    return this.planned.length - 1;
  }

  /** The closed divisions the plan creates, in the order first needed. */
  created(): NewDivision[] {
    return this.planned.map((p) => ({ deptId: p.deptId, name: p.name, code: p.code, startedAt: yearStart(p.first), closedAt: yearEnd(p.last) }));
  }
}
