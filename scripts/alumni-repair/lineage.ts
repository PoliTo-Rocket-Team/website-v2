import { yearEnd, yearStart } from "./academic-year";
import { codeKey, unitKey, type Department, type Division, type Units } from "./units";

// The propulsion lineage (owner decision, issue #913): "Liquid Propulsion",
// "Efesto" and "Propulsion" are one team. Its roles up to and including
// 2023-2024 sit under "Efesto"; its roles from 2024-2025 on sit under
// "Propulsion". A role's year is the academic year its start day falls in.
// A role moves to its period's department, and its division to the division
// of that department with the same name or code; when that department has
// none, a closed division is created there. The divisions to create are
// worked out once every role is placed: under one target department, source
// divisions that share a name or a code, directly or through a chain of other
// such source divisions, share one created division. So the grouping does not
// depend on the order the roles are read in.
// Nothing is deleted: a department left with no role stays as it is.

/** The lineage's departments, by name, and the last academic year its roles sit under Efesto. */
export const LINEAGE = { names: ["Liquid Propulsion", "Efesto", "Propulsion"], early: "Efesto", late: "Propulsion", lastEarlyYear: 2023 } as const;

/** A division a role is placed in: one the database holds, or one the plan creates (its index in `Placed.divisions`). */
export type DivisionRef = { readonly kind: "existing"; readonly id: number } | { readonly kind: "new"; readonly index: number };

/**
 * A division a role is placed in while the plan is still being worked out:
 * one the database holds, or the one to create under `deptId` from source
 * division `from`. `Lineage.finish` turns it into a `DivisionRef`.
 */
export type PendingRef = { readonly kind: "existing"; readonly id: number } | { readonly kind: "create"; readonly deptId: number; readonly from: number };

/** A closed division the plan creates under a lineage department: its span runs over the academic years of the roles placed in it. */
export type NewDivision = { readonly deptId: number; readonly name: string; readonly code: string | null; readonly startedAt: string; readonly closedAt: string };

/** The divisions the plan creates, and where each pending division of a role ends up. */
export type Placed = { readonly divisions: readonly NewDivision[]; readonly resolve: (ref: PendingRef | null) => DivisionRef | null };

/** Why a lineage role cannot be placed: its target department has two divisions that match; or its division sits under a department outside the lineage. */
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

/** A role placed in a division to create: under `deptId`, from source division `from`, in academic year `year`. */
type Use = { readonly deptId: number; readonly from: Division; readonly year: number };

/** The keys a division is matched on: its name, and its code when it has one. */
const keysOf = (d: { readonly name: string; readonly code: string | null }): string[] => [`name:${unitKey(d.name)}`, ...(d.code === null ? [] : [`code:${codeKey(d.code)}`])];

/** Two divisions are the same when their names match, or when both carry a code and the codes match. */
function same(a: { readonly name: string; readonly code: string | null }, b: { readonly name: string; readonly code: string | null }): boolean {
  const keys = new Set(keysOf(a));
  return keysOf(b).some((k) => keys.has(k));
}

/**
 * The source divisions in `sources` grouped so that two sharing a name or a
 * code, directly or through a chain of others, are in one group. Each group is
 * in id order, and the groups are in the order of their first id: the answer
 * is the same whatever order `sources` comes in.
 */
export function groupDivisions(sources: readonly Division[]): Division[][] {
  const parent = new Map(sources.map((d) => [d.id, d.id]));
  const find = (id: number): number => {
    const up = parent.get(id)!;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  /** The first source seen with each key: a later one carrying the key joins its group. */
  const holder = new Map<string, number>();
  for (const d of sources) {
    for (const key of keysOf(d)) {
      const other = holder.get(key);
      if (other === undefined) {
        holder.set(key, d.id);
        continue;
      }
      const [a, b] = [find(other), find(d.id)];
      // The smaller id is the root, so a group's root is its smallest id.
      if (a !== b) parent.set(Math.max(a, b), Math.min(a, b));
    }
  }
  const groups = new Map<number, Division[]>();
  for (const d of [...sources].sort((x, y) => x.id - y.id)) {
    const root = find(d.id);
    groups.set(root, [...(groups.get(root) ?? []), d]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

export class Lineage {
  private readonly uses: Use[] = [];
  private finished = false;

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
    return { kind: "placed", deptId: target.id, division: { kind: "create", from: division } };
  }

  /** Keeps a placed role of academic year `year`: the division it is stored with, a division to create still pending until `finish`. */
  commit(place: Extract<LineagePlace, { kind: "placed" }>, year: number): PendingRef | null {
    if (this.finished) throw new Error("the lineage's divisions are already worked out: no role can be placed after `finish`");
    const d = place.division;
    if (d === null || d.kind === "existing") return d;
    this.uses.push({ deptId: place.deptId, from: d.from, year });
    return { kind: "create", deptId: place.deptId, from: d.from.id };
  }

  /**
   * The closed divisions to create, once every role is placed. Under each
   * target department, the source divisions its roles came from are grouped
   * by shared name or code, through any chain (`groupDivisions`); each group
   * is one created division. It takes the name of the group's first source
   * division by id and the first code by id, and its span runs over the
   * academic years of every role placed in it. The groups are ordered by
   * that first id, then by department, so the read order of the roles
   * changes nothing. No source division of a group matches a division of the
   * target department (`place` would have used that one), so neither does the
   * created division.
   */
  finish(): Placed {
    this.finished = true;
    const byDept = new Map<number, Map<number, { division: Division; first: number; last: number }>>();
    for (const u of this.uses) {
      const sources = byDept.get(u.deptId) ?? new Map();
      byDept.set(u.deptId, sources);
      const s = sources.get(u.from.id) ?? { division: u.from, first: u.year, last: u.year };
      sources.set(u.from.id, { division: s.division, first: Math.min(s.first, u.year), last: Math.max(s.last, u.year) });
    }
    const groups = [...byDept.entries()].flatMap(([deptId, sources]) =>
      groupDivisions([...sources.values()].map((s) => s.division)).map((group) => ({ deptId, group, spans: group.map((d) => sources.get(d.id)!) })),
    );
    groups.sort((a, b) => a.group[0].id - b.group[0].id || a.deptId - b.deptId);
    const indexOf = new Map<string, number>();
    const divisions = groups.map(({ deptId, group, spans }, index) => {
      for (const d of group) indexOf.set(`${deptId}|${d.id}`, index);
      return {
        deptId,
        name: group[0].name,
        code: group.find((d) => d.code !== null)?.code ?? null,
        startedAt: yearStart(Math.min(...spans.map((s) => s.first))),
        closedAt: yearEnd(Math.max(...spans.map((s) => s.last))),
      };
    });
    const resolve = (ref: PendingRef | null): DivisionRef | null => {
      if (ref === null || ref.kind === "existing") return ref;
      const index = indexOf.get(`${ref.deptId}|${ref.from}`);
      if (index === undefined) throw new Error("a placed role names a division to create that the lineage never planned");
      return { kind: "new", index };
    };
    return { divisions, resolve };
  }
}
