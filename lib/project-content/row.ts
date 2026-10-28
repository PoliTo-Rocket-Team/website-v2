import { storedProjectRecord } from "./check";
import type { ProjectRecord } from "./record";

// One `project_versions` row as this code reads it. Since migrations 0072 and
// 0073 (issue #535) a version stores one record, its page blocks record, in
// `page`; the record from before page blocks that `content` held is gone.

/** What a stored row holds that this code reads: its page blocks record. */
export type ProjectRow = { readonly page: unknown };

/** The record of a stored row, or null when what its `page` holds is not a record. */
export function rowRecordOf(row: ProjectRow): ProjectRecord | null {
  return storedProjectRecord(row.page);
}
