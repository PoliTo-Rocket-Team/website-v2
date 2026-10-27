// Finding the department or division a roster name means (issue #677). The
// import never creates a unit: a name resolves to a `departments` or
// `divisions` row already in the database, by its name or its code, or it is
// an unknown unit. Case, accents, punctuation and a trailing "department",
// "division" or "subteam" do not count, so "Propulsion Dept." and "PROPULSION"
// both find "Propulsion". A name two units share is unknown too: the import
// does not pick one.
//
// A roster cell may list several values (" - ", ",", ";" or a line break part
// them), and each value is one of: a unit, maybe with its code in parentheses
// ("Propulsion (PRO)"); "N/A", which is no unit; an "ADVISOR" or "SENIOR
// ADVISOR" marker, maybe with a project in parentheses, which makes the row an
// advisor's; or a project's name. The schema has no project on `roles`, so a
// project name is not a unit: it is recognised against the projects the
// database holds and set aside.

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

function find<U extends Department>(units: readonly U[], name: string): U | null {
  const key = unitKey(name);
  if (key === "") return null;
  const hits = units.filter((u) => unitKey(u.name) === key || (u.code !== null && unitKey(u.code) === key));
  return hits.length === 1 ? hits[0] : null;
}

/** One value of a unit cell. */
export type UnitValue =
  | { readonly kind: "none" }
  | { readonly kind: "advisor"; readonly senior: boolean; readonly project: string | null }
  | { readonly kind: "project"; readonly name: string }
  | { readonly kind: "unit"; readonly name: string; readonly code: string | null };

/** Splits a cell that lists several values: " - " (or a spaced en dash), commas, semicolons and line breaks part them. */
export function unitNames(cell: string): string[] {
  return cell
    .split(/\s+[-–]\s+|[,;\n]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s !== "");
}

const NONE = /^(n\/?a|none|-+)$/i;
const ADVISOR = /^(senior )?advisor(?:\s*\(([^()]*)\))?$/i;
const CODED = /^(.*?)\s*\(([^()]*)\)$/;

/** What one value of a unit cell is. `projects` holds the unit keys of the projects' names. */
export function readUnitValue(text: string, projects: ReadonlySet<string>): UnitValue {
  const value = text.replace(/\s+/g, " ").trim();
  if (value === "" || NONE.test(value)) return { kind: "none" };
  const advisor = ADVISOR.exec(value);
  if (advisor !== null) return { kind: "advisor", senior: advisor[1] !== undefined, project: advisor[2]?.trim() || null };
  if (projects.has(unitKey(value))) return { kind: "project", name: value };
  const coded = CODED.exec(value);
  if (coded !== null && coded[1] !== "") {
    if (projects.has(unitKey(coded[1]))) return { kind: "project", name: coded[1] };
    return { kind: "unit", name: coded[1], code: coded[2].trim() || null };
  }
  return { kind: "unit", name: value, code: null };
}

/** Every value of a unit cell. */
export function unitValues(cell: string, projects: ReadonlySet<string>): UnitValue[] {
  return unitNames(cell).map((v) => readUnitValue(v, projects));
}

/** The unit a value names: by its name, else by the code in its parentheses. */
function resolve<U extends Department>(units: readonly U[], value: Extract<UnitValue, { kind: "unit" }>): U | null {
  return find(units, value.name) ?? (value.code === null ? null : find(units, value.code));
}

export function departmentOf(units: Units, value: Extract<UnitValue, { kind: "unit" }>): Department | null {
  return resolve(units.departments, value);
}

export function divisionOf(units: Units, value: Extract<UnitValue, { kind: "unit" }>): Division | null {
  return resolve(units.divisions, value);
}

export function departmentNamed(units: Units, name: string): Department | null {
  return find(units.departments, name);
}

export function divisionNamed(units: Units, name: string): Division | null {
  return find(units.divisions, name);
}
