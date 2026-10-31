import { academicYearOf, yearEnd, yearStart } from "./academic-year";
import { Lineage, type DivisionRef, type LeftReason, type LineagePlace, type NewDivision, type PendingRef } from "./lineage";
import { matchQuitters } from "./people";
import { lastYearOf, type SwappedField } from "./quitters";
import type { At, Roster } from "./roster";
import type { ExistingRole, Snapshot } from "./snapshot";
import { readTitle, type PositionType } from "./titles";
import { lookupDepartment, lookupDivision, rowUnitNames, unitKey, type Department, type Division, type RowUnitNames, type Units } from "./units";

// What the repair would write (issue #913), worked out from the roster and a
// snapshot of the database before anything is written. The plan is the whole
// decision: a dry run prints it, a real run writes exactly its rows.
//
// Part 1, the missing last-year role. The import gave a role only to quitters
// on no year sheet (issue #816, rule 7). A Quitters row whose person is on an
// earlier year sheet, and whose leave day falls in an academic year no year
// sheet lists them in, gets one ended role per unit of the row for that year:
// its title as the workbook writes it, from the year's start (or the row's
// join day, when later) to the leave day. A person who already has a role in
// that year is skipped, so a second run adds nothing. A row whose units do not
// resolve to the database's units is skipped and reported: Part 1 creates no
// unit.
//
// Part 2, the propulsion lineage (owner decision, ./lineage.ts): every role
// under a lineage department moves to its period's department and division.
//
// Inserts for Part 1, updates of `dept_id` and `division_id` for Part 2, and
// at most one closed division per missing target division. Nothing is deleted.

/** Why a Quitters row adds no role, listed by row. */
export type SkipKind =
  | "no-leave-date"
  | "date-unreadable"
  | "after-current-year"
  | "ambiguous-match"
  | "duplicate"
  | "no-member"
  | "ambiguous-member"
  | "has-role"
  | "unknown-unit"
  | "no-unit"
  | LeftReason;

export type Skip = { readonly kind: SkipKind; readonly at: At; readonly field?: string };

/** A role Part 1 inserts. `at` is the Quitters row it comes from. */
export type NewRole = {
  readonly at: At;
  readonly year: number;
  readonly memberId: number;
  readonly deptId: number | null;
  readonly division: DivisionRef | null;
  readonly title: string;
  readonly type: PositionType | null;
  readonly startedAt: string;
  readonly leavedAt: string;
};

/** A role Part 2 moves: where it is now, and where it goes. */
export type Move = {
  readonly roleId: number;
  readonly year: number;
  readonly from: { readonly deptId: number | null; readonly divisionId: number | null };
  readonly deptId: number;
  readonly division: DivisionRef | null;
};

export type Plan = {
  readonly currentYear: number | null;
  readonly units: Units;
  readonly lineage: { readonly departments: readonly Department[]; readonly early: Department; readonly late: Department };
  /** Every Quitters row read, and how many of them each count-only outcome took. */
  readonly quitterRows: number;
  readonly quitterOnly: number;
  readonly onYearSheet: number;
  readonly noEarlierSheet: number;
  /** The Quitters date cells of an added role read with day and month swapped. */
  readonly swapped: readonly { readonly at: At; readonly field: SwappedField }[];
  readonly roles: readonly NewRole[];
  readonly skipped: readonly Skip[];
  readonly moves: readonly Move[];
  /** Lineage roles left where they are, each with why and its academic year. */
  readonly left: readonly { readonly reason: LeftReason; readonly year: number }[];
  readonly divisions: readonly NewDivision[];
};

/** Whether a role covers any day of academic year `year`. */
const inYear = (role: Pick<ExistingRole, "startedAt" | "leavedAt">, year: number) =>
  role.startedAt <= yearEnd(year) && (role.leavedAt === null || role.leavedAt >= yearStart(year));

/** A role's place before the lineage: a department and maybe a division the database holds. */
type Place = { readonly deptId: number | null; readonly division: Division | null };

/** One key per place a role is stored in: a row naming one unit twice adds one role there. */
const refKey = (t: { readonly deptId: number | null; readonly division: DivisionRef | PendingRef | null }) => {
  const d = t.division;
  return `${t.deptId ?? ""}|${d === null ? "" : d.kind === "existing" ? `e${d.id}` : d.kind === "new" ? `n${d.index}` : `c${d.deptId}:${d.from}`}`;
};

/** A role or move while the plan is worked out: a division to create is still pending (`Lineage.finish`). */
type Draft<T extends { readonly division: DivisionRef | null }> = Omit<T, "division"> & { readonly division: PendingRef | null };

export function planRepair(roster: Roster, snapshot: Snapshot): Plan {
  const units = snapshot.units;
  const lineage = Lineage.of(units);
  if (typeof lineage === "string") throw new Error(`the propulsion lineage cannot be placed: ${lineage}`);
  const divisionOf = new Map(units.divisions.map((d) => [d.id, d]));
  const currentYear = roster.currentYear;

  // Part 1 ---------------------------------------------------------------------

  const roles: Draft<NewRole>[] = [];
  const skipped: Skip[] = [];
  const swapped: { at: At; field: SwappedField }[] = [];
  /** `<member>|<year>` for each year a role is planned in, so one run adds one year once. */
  const planned = new Set<string>();
  let quitterOnly = 0;
  let onYearSheet = 0;
  let noEarlierSheet = 0;

  /** The places a Quitters row's unit cells give, or why they give none. */
  const placesOf = (names: RowUnitNames, board: boolean): Place[] | { kind: "unknown-unit" | "no-unit"; field: string } => {
    const departments: { key: string; dept: Department }[] = [];
    for (const d of names.departments) {
      const found = lookupDepartment(units, d.value);
      if (found.kind !== "found") return { kind: "unknown-unit", field: d.cell };
      departments.push({ key: unitKey(d.value.name), dept: found.unit });
    }
    const divisions: { division: Division; pairedWith: Department | null }[] = [];
    for (const d of names.divisions) {
      const pairedWith = d.department === null ? null : (departments.find((x) => x.key === unitKey(d.department!.name))?.dept ?? null);
      // A lineage division is looked for under every lineage department: the lineage moves it to its period's department below.
      const among =
        pairedWith === null
          ? units.divisions
          : lineage.includes(pairedWith.id)
            ? lineage.divisions()
            : units.divisions.filter((x) => x.deptId === null || x.deptId === pairedWith.id);
      const found = lookupDivision(units, d.value, among);
      if (found.kind !== "found") return { kind: "unknown-unit", field: "division" };
      divisions.push({ division: found.unit, pairedWith });
    }
    // A member sits in each division, and in each department no division of the row belongs to or is paired with.
    const covered = new Set(divisions.flatMap((d) => [d.division.deptId, d.pairedWith?.id ?? null]));
    const places: Place[] = [
      ...divisions.map((d) => ({ deptId: d.division.deptId ?? d.pairedWith?.id ?? null, division: d.division })),
      ...departments.filter((d) => !covered.has(d.dept.id)).map((d) => ({ deptId: d.dept.id, division: null })),
    ];
    if (places.length > 0) return places;
    return board ? [{ deptId: null, division: null }] : { kind: "no-unit", field: "subteam" };
  };

  const matches = matchQuitters(roster);
  for (const match of matches) {
    if (match.kind === "quitter-only") {
      quitterOnly++;
      continue;
    }
    const { row } = match;
    if (match.kind !== "person") {
      skipped.push({ kind: match.kind, at: row.at });
      continue;
    }
    const dates = lastYearOf(row);
    if (dates.kind === "unclear") {
      skipped.push({ kind: dates.reason, at: row.at, field: dates.field });
      continue;
    }
    const year = dates.year;
    if (currentYear !== null && year > currentYear) {
      skipped.push({ kind: "after-current-year", at: row.at, field: "leftOn" });
      continue;
    }
    if (match.person.years.has(year)) {
      onYearSheet++;
      continue;
    }
    if (![...match.person.years].some((y) => y < year)) {
      noEarlierSheet++;
      continue;
    }
    const memberIds = [...new Set(snapshot.memberEmails.filter((e) => match.person.emails.has(e.email)).map((e) => e.memberId))];
    if (memberIds.length !== 1) {
      skipped.push({ kind: memberIds.length === 0 ? "no-member" : "ambiguous-member", at: row.at });
      continue;
    }
    const memberId = memberIds[0];
    if (planned.has(`${memberId}|${year}`) || snapshot.roles.some((r) => r.memberId === memberId && inYear(r, year))) {
      skipped.push({ kind: "has-role", at: row.at });
      continue;
    }
    const names = rowUnitNames(row.value.subteam, row.value.division, snapshot.projects, units.departments);
    const title = readTitle(row.value.title, names.advisor);
    const places = placesOf(names, title.board || title.type === "advisor");
    if (!Array.isArray(places)) {
      skipped.push({ kind: places.kind, at: row.at, field: places.field });
      continue;
    }
    // Every place is worked out before any is kept, so a row is added whole or not at all.
    const resolved: (LineagePlace | ({ readonly kind: "plain" } & Place))[] = places.map((p) =>
      lineage.includes(p.deptId) || (p.division !== null && lineage.includes(p.division.deptId)) ? lineage.place(year, p.division) : { kind: "plain", ...p },
    );
    const left = resolved.find((p) => p.kind === "left");
    if (left !== undefined) {
      skipped.push({ kind: left.reason, at: row.at, field: "division" });
      continue;
    }
    const kept = new Map<string, Draft<NewRole>>();
    for (const p of resolved) {
      if (p.kind === "left") continue;
      const target =
        p.kind === "plain"
          ? { deptId: p.deptId, division: p.division === null ? null : ({ kind: "existing", id: p.division.id } as const) }
          : { deptId: p.deptId, division: lineage.commit(p, year) };
      kept.set(refKey(target), { at: row.at, year, memberId, ...target, title: title.title, type: title.type, startedAt: dates.startedAt, leavedAt: dates.leftAt });
    }
    roles.push(...kept.values());
    planned.add(`${memberId}|${year}`);
    if (dates.swapped !== null) swapped.push({ at: row.at, field: dates.swapped });
  }

  // Part 2 ---------------------------------------------------------------------

  const moves: Draft<Move>[] = [];
  const left: { reason: LeftReason; year: number }[] = [];
  for (const role of snapshot.roles) {
    const division = role.divisionId === null ? null : (divisionOf.get(role.divisionId) ?? null);
    const ofLineage = lineage.includes(role.deptId) || (role.deptId === null && division !== null && lineage.includes(division.deptId));
    if (!ofLineage) continue;
    const year = academicYearOf(role.startedAt);
    const place = lineage.place(year, division);
    if (place.kind === "left") {
      left.push({ reason: place.reason, year });
      continue;
    }
    const stays = place.deptId === role.deptId && (place.division === null ? role.divisionId === null : place.division.kind === "existing" && place.division.id === role.divisionId);
    if (stays) continue;
    moves.push({ roleId: role.id, year, from: { deptId: role.deptId, divisionId: role.divisionId }, deptId: place.deptId, division: lineage.commit(place, year) });
  }

  // The divisions to create, worked out over every placed role, and where each role goes.
  const placed = lineage.finish();
  /** One role per Quitters row and place: two units of a row whose divisions to create became one division give one role. */
  const added = new Map<string, NewRole>();
  for (const r of roles) {
    const role = { ...r, division: placed.resolve(r.division) };
    const key = `${r.at.sheet}|${r.at.row}|${refKey(role)}`;
    if (!added.has(key)) added.set(key, role);
  }

  return {
    currentYear,
    units,
    lineage: { departments: lineage.departments(), early: lineage.early, late: lineage.late },
    quitterRows: roster.quitters.length,
    quitterOnly,
    onYearSheet,
    noEarlierSheet,
    swapped,
    roles: [...added.values()],
    skipped,
    moves: moves.map((m) => ({ ...m, division: placed.resolve(m.division) })),
    left,
    divisions: placed.divisions,
  };
}
