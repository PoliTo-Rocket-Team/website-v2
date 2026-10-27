// Finding the department or division a roster name means (issue #677). The
// import never creates a unit: a name resolves to a `departments` or
// `divisions` row already in the database, by its name or its code, or it is
// an unknown unit. Case, accents, punctuation and a trailing "department",
// "division" or "subteam" do not count, so "Propulsion Dept." and "PROPULSION"
// both find "Propulsion". A name two units share is unknown too: the import
// does not pick one.

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

export function departmentNamed(units: Units, name: string): Department | null {
  return find(units.departments, name);
}

export function divisionNamed(units: Units, name: string): Division | null {
  return find(units.divisions, name);
}

/** Splits a cell that lists several units ("Propulsion, Structures"): commas, semicolons and line breaks part them. */
export function unitNames(cell: string): string[] {
  return cell
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
