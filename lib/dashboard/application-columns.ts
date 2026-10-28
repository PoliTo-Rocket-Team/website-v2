import { STATUS_NAMES, studiesLevel, studiesProgram } from "./application-flow";
import type { BuiltInStatusKey } from "./application-status";
import { clearPicksIn, optionsOf, rowsWithPicks, togglePickIn, type ColumnFilters, type ColumnOption, type ColumnPicks } from "./column-filters";
import { shortUnitName } from "./division-access";
import { documentsLine, type ApplicationDocument } from "./recruitment";

// The Applications table's column filters (issue #428): the Members table's
// column filters (boards 73b and 73c) on the Position, Studies, Stage,
// Documents and Applied columns. They narrow the rows the toolbar leaves
// (./applications-view.ts). Every role that opens the page gets the same
// columns; only the rows, and so the values offered, differ.

/** The Studies column carries two filters, its program and its level, as Members has a Program and a Level column. */
export const APPLICATION_FILTERS = ["position", "program", "level", "stage", "documents", "applied"] as const;
export type ApplicationFilter = (typeof APPLICATION_FILTERS)[number];

export const APPLICATION_FILTER_LABELS: Readonly<Record<ApplicationFilter, string>> = {
  position: "Position",
  program: "Program",
  level: "Level",
  stage: "Stage",
  documents: "Documents",
  applied: "Applied",
};

export type ApplicationPicks = ColumnPicks<ApplicationFilter>;

export const NO_APPLICATION_PICKS: ApplicationPicks = {};

/** The fields of a row the column filters read. */
export type ApplicationColumnsRow = {
  readonly state: { readonly status: BuiltInStatusKey };
  readonly applicant: { readonly degree: string | null; readonly year: string | null };
  readonly position: { readonly title: string; readonly division: string };
  readonly documents: readonly ApplicationDocument[];
  readonly applied: { readonly day: string };
};

/** No documents uploaded: a value of its own, so reviewers can find who sent none. */
export const NO_DOCUMENTS = "None";

/**
 * What a row holds in a filtered column, as its cell reads: the position with
 * its division (two divisions may open roles of one title), each half of the
 * studies line, the stage, the documents sent, and the applied day ("Today",
 * "3 days ago"). An empty program or level holds none.
 */
export function applicationColumnValues(row: ApplicationColumnsRow, column: ApplicationFilter): string[] {
  const one = (value: string | null) => (value === null || value === "" ? [] : [value]);
  switch (column) {
    case "position":
      return [`${row.position.title} · ${shortUnitName(row.position.division)}`];
    case "program":
      return one(studiesProgram(row.applicant.degree));
    case "level":
      return one(studiesLevel(row.applicant.year));
    case "stage":
      return [STATUS_NAMES[row.state.status]];
    case "documents":
      return [documentsLine(row.documents) || NO_DOCUMENTS];
    case "applied":
      return [row.applied.day];
  }
}

const FILTERS: ColumnFilters<ApplicationColumnsRow, ApplicationFilter> = { columns: APPLICATION_FILTERS, values: applicationColumnValues };

/** The rows every column's ticks leave, in the order the toolbar left them. */
export function withApplicationPicks<A extends ApplicationColumnsRow>(rows: readonly A[], picks: ApplicationPicks): A[] {
  return rowsWithPicks<A, ApplicationFilter>(FILTERS, rows, picks);
}

/** A column's popover: each value with how many rows hold it, over the rows the other columns' ticks leave. */
export function applicationColumnOptions(rows: readonly ApplicationColumnsRow[], picks: ApplicationPicks, column: ApplicationFilter): ColumnOption[] {
  return optionsOf(FILTERS, rows, picks, column);
}

export function toggleApplicationPick(picks: ApplicationPicks, column: ApplicationFilter, value: string): ApplicationPicks {
  return togglePickIn(picks, column, value);
}

export function clearApplicationPicks(picks: ApplicationPicks, column: ApplicationFilter): ApplicationPicks {
  return clearPicksIn(picks, column);
}
