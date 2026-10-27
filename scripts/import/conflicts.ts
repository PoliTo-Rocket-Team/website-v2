// What the import reports instead of writing (issue #677). A conflict names
// where it is (file, sheet, row) and, where one field is at fault, that
// field's name; it never carries the value, so the report prints no name,
// email, phone or ID. Each kind has one fixed sentence.

/** Where a row sits: the file, the workbook sheet when it is one, and the row (a CSV's file line) from 1. */
export type At = { readonly file: string; readonly sheet?: string; readonly row: number };

export const CONFLICT_TEXT = {
  "no-header": "No header row found: the sheet or file was not read.",
  duplicate: "The same person is on an earlier row of this sheet or file (by email or name); this row was not used.",
  "ambiguous-match": "The row matches two different people (one by email, another by email or name); it was given to the first email match.",
  "missing-email": "The person has no usable email in any source; they were not imported.",
  "account-without-member": "An account with this person's email already exists but holds no member row; the person was not imported (the import never changes an existing row).",
  "unknown-unit": "The subteam or division resolves to no existing department or division; the role was not imported.",
  "unknown-title": "The title reads as a seat that no rule in the title table gives; the role was not imported.",
  "seat-taken": "This seat already has an active holder this year (team leader, department head or full-access seat), in the database or on an earlier row; the role was not imported.",
  "csv-disagrees": "The CSV value disagrees with the workbook; the workbook value was kept.",
  "imported-alumni-match": "The person matches an imported Alumni entry (migration 0021); no role was imported for a year that entry lists.",
  "roles-sheet-unmatched": "The row matches nobody on that year's sheet; it was not used.",
  "quitter-on-current-sheet": "Unclear quitter: on Quitters and on the current year's sheet; imported as an active member.",
  "quitter-in-no-year": "Unclear quitter: on Quitters and on no year sheet, so no academic year can be given; not imported.",
  "schema-misfit": "The value does not fit the schema; the row was not imported.",
  "unresolved-requester": "The order's requester resolves to no imported member; the order was not imported.",
} as const;

export type ConflictKind = keyof typeof CONFLICT_TEXT;

export type Conflict = { readonly kind: ConflictKind; readonly at: At; readonly field?: string };

/** The kinds that mark an unclear quitter. */
export const UNCLEAR_QUITTER_KINDS: readonly ConflictKind[] = ["quitter-on-current-sheet", "quitter-in-no-year"];

export function placeOf(at: At): string {
  return [at.file, ...(at.sheet === undefined ? [] : [`sheet ${at.sheet}`]), `row ${at.row}`].join(" › ");
}
