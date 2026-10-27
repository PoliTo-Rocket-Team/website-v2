// Finding the department or division a roster name means (issues #677, #816).
// A name resolves to a `departments` or `divisions` row already in the
// database, by its name or its code. Case, accents, punctuation, a trailing
// "department", "division" or "subteam" and a word's trailing plural "s" do
// not count, so "Propulsion Dept." and "PROPULSION" both find "Propulsion",
// and "Ground System" finds "Ground Systems" (issue #820). A code keeps its
// plural "s": "OPS" never finds "OP", and neither does a bare "Ops", a value
// of one short word, which reads as a code. A name two units
// share is ambiguous: the import does not pick one. A name no unit has is
// absent; the plan creates it closed when only past sheets name it
// (./unit-book.ts).
//
// A roster cell may list several values (" - ", ",", ";", "/" or a line break
// part them, but never inside parentheses), and each value is one of: a unit,
// maybe with its code in parentheses ("Propulsion (PRO)", "Electronics (ELT)
// Department"); "N/A" or "AMV", which are no unit; an "ADVISOR" or "SENIOR
// ADVISOR" marker, maybe with a project in parentheses, which makes the row an
// advisor's; or a project's name. The schema has no project on `roles`, so a
// project name is not a unit: it is recognised against the projects the
// database holds and set aside. Before 2024-2025 the subteams bore the
// projects' names, so there a Subteam value is read as a unit even when it
// names a project.

export type Department = { readonly id: number; readonly name: string; readonly code: string | null };
export type Division = Department & { readonly deptId: number | null };
export type Units = { readonly departments: readonly Department[]; readonly divisions: readonly Division[] };

/** A word written as a code: two to four capitals or digits ("OPS", "GNS"). Its "s" is no plural. */
const CODE_WORD = /^[A-Z0-9]{2,4}$/;
/** A word that names a unit's level, not the unit. */
const LEVEL_WORD = /^(the|department|dept|division|div|subteam|team)$/i;

/** Whether a text is one short word once its level words go ("Ops", "Ops Dept."): it reads as a code in any case, so a bare "Ops" stays apart from a bare "OP". */
function isCodeLike(text: string): boolean {
  const words = text.split(/[^A-Za-z0-9]+/).filter((w) => w !== "" && !LEVEL_WORD.test(w));
  return words.length === 1 && /^[A-Za-z0-9]{2,4}$/.test(words[0]);
}

function keyOf(text: string, plural: "kept" | "dropped"): string {
  const plain = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const codeLike = isCodeLike(plain);
  const words = plural === "dropped" ? plain.replace(/\b([a-z0-9]{2,})s\b/gi, (word: string, base: string) => (codeLike || CODE_WORD.test(word) ? word : base)) : plain;
  return words
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|department|dept|division|div|subteam|team)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How the import compares unit names. A word's trailing plural "s" does not
 * count (issue #820): "systems" is "system". Both sides of a comparison lose
 * it, so "analysis" still equals "analysis". A word written as a code keeps
 * it: a bare "OPS" is not "OP". So does a value that is one word of two to
 * four letters or digits in any case, which reads as a code: a bare "Ops" is
 * not "OP" either.
 */
export function unitKey(text: string): string {
  return keyOf(text, "dropped");
}

/** How the import compares unit codes, and a bare value with a code: as names, but a code keeps its "s", so "OPS" and "OP" are two codes. */
export function codeKey(text: string): string {
  return keyOf(text, "kept");
}

/** What a name finds among units: the one unit, none, or more than one (the import does not pick). */
export type Lookup<U> = { readonly kind: "found"; readonly unit: U } | { readonly kind: "absent" } | { readonly kind: "ambiguous" };

/** The units a text finds: by name, or as a unit's code. */
function find<U extends Department>(units: readonly U[], text: string): Lookup<U> {
  const key = unitKey(text);
  const asCode = codeKey(text);
  if (key === "") return { kind: "absent" };
  const hits = units.filter((u) => unitKey(u.name) === key || (u.code !== null && codeKey(u.code) === asCode));
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

const SEPARATOR = /\s+[-–]\s+|[,;\n]|\/(?!(?<=\bn\/)a\b)/gi;

/** Whether `index` of `text` sits inside a pair of parentheses: after an open one not yet closed, with a closing one still to come. */
function insideParentheses(text: string, index: number): boolean {
  let depth = 0;
  for (const ch of text.slice(0, index)) {
    if (ch === "(") depth++;
    else if (ch === ")" && depth > 0) depth--;
  }
  return depth > 0 && text.indexOf(")", index) !== -1;
}

/**
 * Splits a cell that lists several values: " - " (or a spaced en dash),
 * commas, semicolons, slashes and line breaks part them. The slash of "N/A"
 * does not, and neither does a separator inside parentheses (issue #820):
 * "ADVISOR (VES, AMV)" is one value.
 */
export function unitNames(cell: string): string[] {
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

/**
 * A division a row names, and the department the row pairs it with: the one
 * its Division cell names before it ("Electronics Department - Hardware"),
 * else the one its note names ("IT&Media (Operations)"), else the row's one
 * department. Null when the row names none of these, or several departments.
 */
export type DivisionName = { readonly value: UnitName; readonly department: UnitName | null };

/**
 * The departments a division's parenthesized note may name (issue #820): the
 * database's and the ones a run creates, each by its name and its code.
 */
export class DepartmentIndex {
  /** Each department's name key and code key (empty when it has none). */
  private readonly keys: readonly { readonly name: string; readonly code: string }[];

  constructor(departments: readonly { readonly name: string; readonly code: string | null }[]) {
    this.keys = departments.map((d) => ({ name: unitKey(d.name), code: d.code === null ? "" : codeKey(d.code) }));
  }

  /** The departments a text names, by name or as a code. */
  private named(text: string): readonly { readonly name: string; readonly code: string }[] {
    const [name, code] = [unitKey(text), codeKey(text)];
    return name === "" ? [] : this.keys.filter((k) => k.name === name || (k.code !== "" && k.code === code));
  }

  /**
   * The department a division value's note names, as a department value: when
   * the note names a department, by name or code, that the value's own name
   * does not. Null when the note is the value's code: "Avionics (Cavour)" is
   * under Cavour, "Propulsion (PRO)" is coded PRO.
   */
  parentOf(value: UnitName): UnitName | null {
    if (value.code === null) return null;
    const named = this.named(value.code);
    const own = this.named(value.name);
    return named.length === 0 || named.some((k) => own.includes(k)) ? null : { kind: "unit", name: value.code, code: null };
  }
}

/** The index of no department: every note is a code. */
export const NO_DEPARTMENTS = new DepartmentIndex([]);

/** A job title after a division's name in a Division cell (issue #820): "Safety Lead", "Liquid System Architecture Lead Engineer". */
const JOB_TITLE = /\s+lead(?:\s+engineer)?$/i;

/** A Division cell value without a trailing job title: "Safety Lead" is the Safety division. */
function withoutJobTitle(value: UnitName): UnitName {
  const name = value.name.replace(JOB_TITLE, "").trim();
  return name === "" || name === value.name ? value : { ...value, name };
}

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
 * after it in the cell are its divisions. A Division cell value whose note
 * names a department (`departments`) is a division under that department. A
 * trailing "Lead" or "Lead Engineer" on a Division cell value is a job title,
 * not part of the division's name.
 */
export function rowUnitNames(
  subteam: string,
  division: string,
  projects: ReadonlySet<string>,
  reading: "past" | "present",
  departments: DepartmentIndex = NO_DEPARTMENTS,
): RowUnitNames {
  const subteamValues = unitValues(subteam, reading === "past" ? NO_PROJECTS : projects);
  const divisionValues = unitValues(division, projects);
  const named: DepartmentName[] = [];
  const add = (value: UnitName, cell: DepartmentName["cell"]) => {
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
    const parent = departments.parentOf(v);
    if (parent !== null) {
      add(parent, "division");
      divisions.push({ value: withoutJobTitle({ ...v, code: null }), department: parent });
    } else {
      divisions.push({ value: withoutJobTitle(v), department });
    }
  }
  // A division its cell pairs with no department is paired with the row's one department.
  const only = named.length === 1 ? named[0].value : null;
  const paired = divisions.map((d) => (d.department === null ? { ...d, department: only } : d));
  const advisor = [...subteamValues, ...divisionValues].find((v): v is Extract<UnitValue, { kind: "advisor" }> => v.kind === "advisor") ?? null;
  const projectOnly = subteamValues.some((v) => v.kind === "project") && named.length === 0 && divisions.length === 0;
  return { departments: named, divisions: paired, advisor, projectOnly };
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

/**
 * What a division value finds. With `under`, the department its row pairs it
 * with (issue #820), its name finds only a division under that department or
 * under none: `deptId` null is a department the database lacks. Its code
 * finds a division under any department.
 */
export function lookupDivision(units: Units, value: UnitName, under?: { readonly deptId: number | null }): Lookup<Division> {
  const named = under === undefined ? units.divisions : units.divisions.filter((d) => d.deptId === null || d.deptId === under.deptId);
  return lookup(units.divisions, value, named);
}

export function departmentOf(units: Units, value: UnitName): Department | null {
  return found(lookupDepartment(units, value));
}

export function divisionOf(units: Units, value: UnitName): Division | null {
  return found(lookupDivision(units, value));
}

/** The name a unit the import creates is stored under: the roster's name without a trailing level word. */
export function storedUnitName(value: UnitName): string {
  return value.name.replace(/\s+(department|dept\.?|division|div\.?|subteam)$/i, "").trim() || value.name;
}
