// Finding the department or division a Quitters row's unit cells name (issue
// #913). Trimmed from the removed import tool (scripts/import/units.ts, issues
// #677, #816, #820): a value resolves to a `departments` or `divisions` row by
// its name or by the code in its parentheses. Case, accents, punctuation, a
// trailing level word and a word's trailing plural "s" do not count; a word
// written as a code keeps its "s". A name two units share is ambiguous: the
// repair does not pick one. It never creates a unit for a Quitters row.
//
// A cell may list several values (" - ", ",", ";", "/" or a line break part
// them, never inside parentheses). "N/A" and "AMV" are no unit; an "ADVISOR"
// marker makes the row an advisor's. On the Quitters sheet every Subteam value
// is a department, even one that names a project (owner decision, issue #816);
// a Division value that names a project is set aside.

export type Department = { readonly id: number; readonly name: string; readonly code: string | null };
export type Division = Department & { readonly deptId: number | null };
export type Units = { readonly departments: readonly Department[]; readonly divisions: readonly Division[] };

/** A word written as a code: two to four capitals or digits ("OPS", "GNS"). Its "s" is no plural. */
const CODE_WORD = /^[A-Z0-9]{2,4}$/;

function keyOf(text: string, plural: "kept" | "dropped"): string {
  const plain = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const words = plural === "dropped" ? plain.replace(/\b([a-z0-9]{2,})s\b/gi, (word: string, base: string) => (CODE_WORD.test(word) ? word : base)) : plain;
  return words
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|department|dept|division|div|subteam|team)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** How unit names are compared: a word's trailing plural "s" does not count, unless the word is written as a code. */
export function unitKey(text: string): string {
  return keyOf(text, "dropped");
}

/** How unit codes are compared: as names, but a code keeps its "s", so "OPS" and "OP" are two codes. */
export function codeKey(text: string): string {
  return keyOf(text, "kept");
}

/** Every unit a text names: by name, or as a unit's code. */
export function unitsNamed<U extends Department>(units: readonly U[], text: string): U[] {
  const key = unitKey(text);
  const asCode = codeKey(text);
  return key === "" ? [] : units.filter((u) => unitKey(u.name) === key || (u.code !== null && codeKey(u.code) === asCode));
}

/** One value of a unit cell. */
type UnitValue =
  | { readonly kind: "none" }
  | { readonly kind: "advisor" }
  | { readonly kind: "project" }
  | { readonly kind: "unit"; readonly name: string; readonly code: string | null };

/** A value of a unit cell that names a unit. */
export type UnitName = Extract<UnitValue, { kind: "unit" }>;

const SEPARATOR = /\s+[-–]\s+|[,;\n]|\/(?!(?<=\bn\/)a\b)/gi;

/** Whether `index` of `text` sits inside a pair of parentheses. */
function insideParentheses(text: string, index: number): boolean {
  let depth = 0;
  for (const ch of text.slice(0, index)) {
    if (ch === "(") depth++;
    else if (ch === ")" && depth > 0) depth--;
  }
  return depth > 0 && text.indexOf(")", index) !== -1;
}

/** Splits a cell that lists several values; the slash of "N/A" and a separator inside parentheses do not split. */
function unitNames(cell: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (const m of cell.matchAll(SEPARATOR)) {
    if (insideParentheses(cell, m.index)) continue;
    parts.push(cell.slice(start, m.index));
    start = m.index + m[0].length;
  }
  parts.push(cell.slice(start));
  return parts.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s !== "");
}

const NONE = /^(n\/?a|none|-+)$/i;
const IGNORED = /^(amv|amerigo vespucci(\s*\(amv\))?)$/i;
const ADVISOR = /^(senior )?advisor(?:\s*\(([^()]*)\))?$/i;
/** A name with its code in parentheses, maybe followed by the unit's level: "Propulsion (PRO)", "Electronics (ELT) Department". */
const CODED = /^(.*?)\s*\(([^()]*)\)(\s+(?:department|dept\.?|division|div\.?))?$/i;

/** What one value of a unit cell is. `projects` holds the unit keys of the projects' names. */
function readUnitValue(text: string, projects: ReadonlySet<string>): UnitValue {
  const value = text.replace(/\s+/g, " ").trim();
  if (value === "" || NONE.test(value) || IGNORED.test(value)) return { kind: "none" };
  if (ADVISOR.test(value)) return { kind: "advisor" };
  if (projects.has(unitKey(value))) return { kind: "project" };
  const coded = CODED.exec(value);
  if (coded !== null && coded[1] !== "") {
    if (projects.has(unitKey(coded[1]))) return { kind: "project" };
    return { kind: "unit", name: `${coded[1]}${coded[3] ?? ""}`, code: coded[2].trim() || null };
  }
  return { kind: "unit", name: value, code: null };
}

const NO_PROJECTS: ReadonlySet<string> = new Set();

/** A Division cell value that names a department: "Electronics Department", "Electronics (ELT) Department". */
const namesDepartment = (value: UnitName) => /\b(department|dept)\.?$/i.test(value.name);

/** A job title after a division's name in a Division cell: "Safety Lead" is the Safety division. */
const JOB_TITLE = /\s+lead(?:\s+engineer)?$/i;

function withoutJobTitle(value: UnitName): UnitName {
  const name = value.name.replace(JOB_TITLE, "").trim();
  return name === "" || name === value.name ? value : { ...value, name };
}

/** A division a row names, and the department the row pairs it with. */
export type DivisionName = { readonly value: UnitName; readonly department: UnitName | null };

/** The units a Quitters row's Subteam and Division cells name. */
export type RowUnitNames = {
  /** The Subteam cell's units and the departments the Division cell names, once each, with the cell that names each. */
  readonly departments: readonly { readonly value: UnitName; readonly cell: "subteam" | "division" }[];
  readonly divisions: readonly DivisionName[];
  /** The cells carry an "ADVISOR" marker. */
  readonly advisor: boolean;
};

/**
 * Reads a Quitters row's two unit cells. A Division value that names a
 * department is that department, and the divisions after it are its own. A
 * Division value whose note names a database department ("IT&Media
 * (Operations)") is a division under it. A division the cell pairs with no
 * department is paired with the row's one department.
 */
export function rowUnitNames(subteam: string, division: string, projects: ReadonlySet<string>, departments: readonly Department[]): RowUnitNames {
  const subteamValues = unitNames(subteam).map((v) => readUnitValue(v, NO_PROJECTS));
  const divisionValues = unitNames(division).map((v) => readUnitValue(v, projects));
  const named: RowUnitNames["departments"][number][] = [];
  const add = (value: UnitName, cell: "subteam" | "division") => {
    if (!named.some((d) => unitKey(d.value.name) === unitKey(value.name))) named.push({ value, cell });
  };
  for (const v of subteamValues) if (v.kind === "unit") add(v, "subteam");
  const divisions: DivisionName[] = [];
  let department: UnitName | null = null;
  for (const v of divisionValues) {
    if (v.kind !== "unit") continue;
    if (namesDepartment(v)) {
      department = v;
      add(v, "division");
      continue;
    }
    // A note that names a department other than the value's own is its department, not its code.
    const noted = v.code === null ? [] : unitsNamed(departments, v.code);
    if (noted.length > 0 && !noted.some((d) => unitsNamed(departments, v.name).includes(d))) {
      const parent: UnitName = { kind: "unit", name: v.code!, code: null };
      add(parent, "division");
      divisions.push({ value: withoutJobTitle({ ...v, code: null }), department: parent });
    } else {
      divisions.push({ value: withoutJobTitle(v), department });
    }
  }
  const only = named.length === 1 ? named[0].value : null;
  const advisor = [...subteamValues, ...divisionValues].some((v) => v.kind === "advisor");
  return { departments: named, divisions: divisions.map((d) => (d.department === null ? { ...d, department: only } : d)), advisor };
}

/** What a value finds: one unit, none, or several. */
export type Lookup<U> = { readonly kind: "found"; readonly unit: U } | { readonly kind: "absent" } | { readonly kind: "ambiguous" };

function find<U extends Department>(units: readonly U[], text: string): Lookup<U> {
  const hits = unitsNamed(units, text);
  return hits.length === 1 ? { kind: "found", unit: hits[0] } : hits.length === 0 ? { kind: "absent" } : { kind: "ambiguous" };
}

/** What a value finds: by its name among `named`, else by the code in its parentheses among all `units`. */
function lookup<U extends Department>(units: readonly U[], value: UnitName, named: readonly U[] = units): Lookup<U> {
  const byName = find(named, value.name);
  const byCode = value.code === null ? null : find(units, value.code);
  if (byName.kind === "found" || byCode === null) return byName;
  if (byCode.kind === "found") return byCode;
  return byName.kind === "ambiguous" || byCode.kind === "ambiguous" ? { kind: "ambiguous" } : { kind: "absent" };
}

export function lookupDepartment(units: Units, value: UnitName): Lookup<Department> {
  return lookup(units.departments, value);
}

/** What a division value finds: by name among `among` (the divisions of the departments its row pairs it with, or all), by code among all divisions. */
export function lookupDivision(units: Units, value: UnitName, among: readonly Division[] = units.divisions): Lookup<Division> {
  return lookup(units.divisions, value, among);
}
