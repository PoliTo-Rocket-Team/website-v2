// Finding the department or division a roster name means (issues #677, #816).
// A name resolves to a `departments` or `divisions` row already in the
// database, by its name or its code. Case, accents, punctuation and a trailing
// "department", "division" or "subteam" do not count, so "Propulsion Dept."
// and "PROPULSION" both find "Propulsion". A name two units share is
// ambiguous: the import does not pick one. A name no unit has is absent; the
// plan creates it closed when only past sheets name it (./unit-book.ts).
//
// A roster cell may list several values (" - ", ",", ";", "/" or a line break
// part them), and each value is one of: a unit, maybe with its code in
// parentheses ("Propulsion (PRO)", "Electronics (ELT) Department"); "N/A" or
// "AMV", which are no unit; an "ADVISOR" or "SENIOR ADVISOR" marker, maybe
// with a project in parentheses, which makes the row an advisor's; or a
// project's name. The schema has no project on `roles`, so a project name is
// not a unit: it is recognised against the projects the database holds and set
// aside. Before 2024-2025 the subteams bore the projects' names, so there a
// Subteam value is read as a unit even when it names a project.

export type Department = { readonly id: number; readonly name: string; readonly code: string | null };
export type Division = Department & { readonly deptId: number | null };
export type Units = { readonly departments: readonly Department[]; readonly divisions: readonly Division[] };

/** How the import compares unit names. */
export function unitKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|department|dept|division|div|subteam|team)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** What a name finds among units: the one unit, none, or more than one (the import does not pick). */
export type Lookup<U> = { readonly kind: "found"; readonly unit: U } | { readonly kind: "absent" } | { readonly kind: "ambiguous" };

function find<U extends Department>(units: readonly U[], name: string): Lookup<U> {
  const key = unitKey(name);
  if (key === "") return { kind: "absent" };
  const hits = units.filter((u) => unitKey(u.name) === key || (u.code !== null && unitKey(u.code) === key));
  return hits.length === 1 ? { kind: "found", unit: hits[0] } : hits.length === 0 ? { kind: "absent" } : { kind: "ambiguous" };
}

const found = <U>(lookup: Lookup<U>): U | null => (lookup.kind === "found" ? lookup.unit : null);

/** One value of a unit cell. */
export type UnitValue =
  | { readonly kind: "none" }
  | { readonly kind: "advisor"; readonly senior: boolean; readonly project: string | null }
  | { readonly kind: "project"; readonly name: string }
  | { readonly kind: "unit"; readonly name: string; readonly code: string | null };

/** A value of a unit cell that names a unit. */
export type UnitName = Extract<UnitValue, { kind: "unit" }>;

/**
 * Splits a cell that lists several values: " - " (or a spaced en dash),
 * commas, semicolons, slashes and line breaks part them. The slash of "N/A"
 * does not.
 */
export function unitNames(cell: string): string[] {
  return cell
    .split(/\s+[-–]\s+|[,;\n]|\/(?!(?<=\bn\/)a\b)/i)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s !== "");
}

const NONE = /^(n\/?a|none|-+)$/i;
/** "AMV" and "Amerigo Vespucci (AMV)" carry no meaning in a unit cell (owner decision, #816). */
const IGNORED = /^(amv|amerigo vespucci(\s*\(amv\))?)$/i;
const ADVISOR = /^(senior )?advisor(?:\s*\(([^()]*)\))?$/i;
/** A name with its code in parentheses, maybe followed by the unit's level: "Propulsion (PRO)", "Electronics (ELT) Department". */
const CODED = /^(.*?)\s*\(([^()]*)\)(\s+(?:department|dept\.?|division|div\.?))?$/i;

/** What one value of a unit cell is. `projects` holds the unit keys of the projects' names. */
export function readUnitValue(text: string, projects: ReadonlySet<string>): UnitValue {
  const value = text.replace(/\s+/g, " ").trim();
  if (value === "" || NONE.test(value) || IGNORED.test(value)) return { kind: "none" };
  const advisor = ADVISOR.exec(value);
  if (advisor !== null) return { kind: "advisor", senior: advisor[1] !== undefined, project: advisor[2]?.trim() || null };
  if (projects.has(unitKey(value))) return { kind: "project", name: value };
  const coded = CODED.exec(value);
  if (coded !== null && coded[1] !== "") {
    if (projects.has(unitKey(coded[1]))) return { kind: "project", name: coded[1] };
    return { kind: "unit", name: `${coded[1]}${coded[3] ?? ""}`, code: coded[2].trim() || null };
  }
  return { kind: "unit", name: value, code: null };
}

/** Every value of a unit cell. */
export function unitValues(cell: string, projects: ReadonlySet<string>): UnitValue[] {
  return unitNames(cell).map((v) => readUnitValue(v, projects));
}

/** The year sheets before this academic year named their subteams after the projects (Cavour, Efesto, VES, ...): there a subteam was a department. */
export const SUBTEAMS_WERE_DEPARTMENTS_BEFORE = 2024;

/** Where a Subteam cell was read: a year sheet, a `Roles YY-YY` sheet or the `Quitters` sheet. */
export type SubteamSource = { readonly kind: "year"; readonly year: number } | { readonly kind: "roles" } | { readonly kind: "quitters" };

/**
 * How a Subteam cell is read. "past": every value that is not a marker is a
 * department, even one that names a project; that is the year sheets before
 * 2024-2025 and the Quitters and Roles sheets. "present": a project's name is
 * a project, not a unit.
 */
export function subteamReadingOf(source: SubteamSource): "past" | "present" {
  return source.kind !== "year" || source.year < SUBTEAMS_WERE_DEPARTMENTS_BEFORE ? "past" : "present";
}

const NO_PROJECTS: ReadonlySet<string> = new Set();

/** A division a row names, and the department its Division cell names before it ("Electronics Department - Hardware"), if any. */
export type DivisionName = { readonly value: UnitName; readonly department: UnitName | null };

/** A department a row names, and the cell that names it. */
export type DepartmentName = { readonly value: UnitName; readonly cell: "subteam" | "division" };

/** The units a row's Subteam and Division cells name, by level. */
export type RowUnitNames = {
  /** The Subteam cell's units and the departments the Division cell names, once each. */
  readonly departments: readonly DepartmentName[];
  readonly divisions: readonly DivisionName[];
  /** The advisor marker the cells carry, if any. */
  readonly advisor: Extract<UnitValue, { kind: "advisor" }> | null;
  /** The Subteam cell names a project and no unit. */
  readonly projectOnly: boolean;
};

/** A Division cell value that names a department: "Electronics Department", "Electronics (ELT) Department", "Electronics Dept.". */
const namesDepartment = (value: UnitName) => /\b(department|dept)\.?$/i.test(value.name);

/**
 * Reads a row's two unit cells. A Division cell value that names a department
 * ("<Dept> Department - <Division>") is that department, and the divisions
 * after it in the cell are its divisions.
 */
export function rowUnitNames(subteam: string, division: string, projects: ReadonlySet<string>, reading: "past" | "present"): RowUnitNames {
  const subteamValues = unitValues(subteam, reading === "past" ? NO_PROJECTS : projects);
  const divisionValues = unitValues(division, projects);
  const departments: DepartmentName[] = [];
  const add = (value: UnitName, cell: DepartmentName["cell"]) => {
    if (!departments.some((d) => unitKey(d.value.name) === unitKey(value.name))) departments.push({ value, cell });
  };
  for (const v of subteamValues) if (v.kind === "unit") add(v, "subteam");
  const divisions: DivisionName[] = [];
  let department: UnitName | null = null;
  for (const v of divisionValues) {
    if (v.kind !== "unit") continue;
    if (namesDepartment(v)) {
      department = v;
      add(v, "division");
    } else {
      divisions.push({ value: v, department });
    }
  }
  const advisor = [...subteamValues, ...divisionValues].find((v): v is Extract<UnitValue, { kind: "advisor" }> => v.kind === "advisor") ?? null;
  const projectOnly = subteamValues.some((v) => v.kind === "project") && departments.length === 0 && divisions.length === 0;
  return { departments, divisions, advisor, projectOnly };
}

/**
 * The department a seat's note names ("Advisor (Project Cavour)" names
 * Cavour), read as a Subteam value of the row's reading: null when it names no
 * unit, as a project's name does on a present-day row.
 */
export function notedDepartment(note: string, projects: ReadonlySet<string>, reading: "past" | "present"): UnitName | null {
  const value = readUnitValue(note.replace(/^project\s+/i, ""), reading === "past" ? NO_PROJECTS : projects);
  return value.kind === "unit" ? value : null;
}

/** What a value finds: by its name, else by the code in its parentheses. */
function lookup<U extends Department>(units: readonly U[], value: UnitName): Lookup<U> {
  const byName = find(units, value.name);
  const byCode = value.code === null ? null : find(units, value.code);
  if (byName.kind === "found" || byCode === null) return byName;
  if (byCode.kind === "found") return byCode;
  return byName.kind === "ambiguous" || byCode.kind === "ambiguous" ? { kind: "ambiguous" } : { kind: "absent" };
}

export function lookupDepartment(units: Units, value: UnitName): Lookup<Department> {
  return lookup(units.departments, value);
}

export function lookupDivision(units: Units, value: UnitName): Lookup<Division> {
  return lookup(units.divisions, value);
}

export function departmentOf(units: Units, value: UnitName): Department | null {
  return found(lookupDepartment(units, value));
}

export function divisionOf(units: Units, value: UnitName): Division | null {
  return found(lookupDivision(units, value));
}

export function departmentNamed(units: Units, name: string): Department | null {
  return found(find(units.departments, name));
}

export function divisionNamed(units: Units, name: string): Division | null {
  return found(find(units.divisions, name));
}

/** The name a unit the import creates is stored under: the roster's name without a trailing level word. */
export function storedUnitName(value: UnitName): string {
  return value.name.replace(/\s+(department|dept\.?|division|div\.?|subteam)$/i, "").trim() || value.name;
}
