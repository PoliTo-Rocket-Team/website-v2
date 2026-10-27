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
  "account-without-member":
    "An account with another of this person's emails, not their sign-in email, already exists but holds no member row; the person was not imported (a new member row is linked only to the account of the sign-in email).",
  "unknown-unit": "A subteam or division value resolves to no existing department or division, or the cell a seat needs is empty; a role or position placed by it was not imported.",
  "unknown-title": "The title reads as a seat that no rule in the title table gives; the role was not imported.",
  "seat-taken": "This seat already has an active holder this year (team leader, department head or full-access seat), in the database or on an earlier row; the role was not imported.",
  "csv-disagrees": "The CSV value disagrees with the workbook; the workbook value was kept.",
  "imported-alumni-match": "The person matches an imported Alumni entry (migration 0021); no role was imported for a year that entry lists.",
  "roles-sheet-unmatched": "The row matches nobody on that year's sheet; it was not used.",
  "quitter-on-current-sheet": "Unclear quitter: on Quitters and on the current year's sheet; imported as an active member.",
  "quitter-no-date":
    "Unclear quitter: on Quitters and on no year sheet, with no leave day and no quitter-year line in overrides.csv, so no academic year can be given; not imported.",
  "quitter-date-unreadable":
    "Unclear quitter: on Quitters and on no year sheet, and a date cell does not read as a day (or the join day is after the leave day); not imported.",
  "joined-date-unreadable":
    "The year sheet's \"Date of joining\" cell does not read as a day, or falls after that academic year; the row's roles start on the year's first day.",
  "schema-misfit": "The value does not fit the schema; the row was not imported.",
  "unresolved-requester": "The order's requester resolves to no imported member; the order was not imported.",
  "project-only-unit": "The subteam cell names only a project, and the schema has no project on roles; the role was not imported.",
  "override-unmatched":
    "The overrides.csv line does not read (unknown kind, or a row or value that is no number or year), or names what it cannot apply to: a handover off the current year's sheet, a row that is no person's row there, two rows with no seat in common, or a quitter-year row that is no Quitters row of a person on no year sheet; it was not applied.",
  "photo-surname-differs": "Photo held: its id is a people_rows.csv id, but the surname in its name differs; not imported.",
  "photo-no-id-match": "Photo not imported: the id in its name is on no row of people_rows.csv.",
  "photo-no-surname-match": "Photo not imported: its name is a surname only, and no advisor (advisors_rows.csv or an advisor row of the workbook) has that surname.",
  "photo-surname-ambiguous": "Photo not imported: its name is a surname only, and more than one advisor has that surname.",
  "photo-not-imported": "Photo not imported: the person or advisor it names is not imported by this run (refused or unclear), or already has a photo from an earlier file.",
  "photo-unfit": "Photo not imported: it cannot be read, or it still fails the dashboard's photo check once shaped.",
  "photo-missing": "The row is flagged has_pp, but no file of the photos folder matched it (a person's by id, an advisor's by surname).",
} as const;

export type ConflictKind = keyof typeof CONFLICT_TEXT;

export type Conflict = { readonly kind: ConflictKind; readonly at: At; readonly field?: string };

/** The kinds that name a photo file or a missing one. */
export const PHOTO_KINDS: readonly ConflictKind[] = [
  "photo-surname-differs",
  "photo-no-id-match",
  "photo-no-surname-match",
  "photo-surname-ambiguous",
  "photo-not-imported",
  "photo-unfit",
  "photo-missing",
];

/** The kinds that mark an unclear quitter. */
export const UNCLEAR_QUITTER_KINDS: readonly ConflictKind[] = ["quitter-on-current-sheet", "quitter-no-date", "quitter-date-unreadable"];

export function placeOf(at: At): string {
  return [at.file, ...(at.sheet === undefined ? [] : [`sheet ${at.sheet}`]), `row ${at.row}`].join(" › ");
}
