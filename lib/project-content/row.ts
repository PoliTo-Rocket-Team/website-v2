import type { VersionKind } from "@/lib/content/versioned";
import { storedProjectRecord as storedBeforeBlocks } from "./before-blocks/check";
import { newProjectRecord as newProjectBeforeBlocks } from "./before-blocks/new-project";
import type { ProjectRecord as BeforeBlocksRecord } from "./before-blocks/record";
import { storedProjectRecord } from "./check";
import { blocksRecordOf } from "./legacy";
import { startYearOf, type ProjectRecord } from "./record";

// One `project_versions` row as this code reads and writes it. Migration 0050
// is additive (Owner decision, 2026-10-22, on #522): it adds the `page`
// column and writes each version's page blocks record there, and leaves
// `content`, the record from before page blocks, as it was. A deployment
// built before page blocks reads and writes `content` only, on a database the
// migration ran on as well, so this code keeps that column a record such a
// deployment reads (./before-blocks/) and never writes a record of its own
// there.

/** The two records a row holds: `page`, null on a row written before page blocks or by code from then. */
export type ProjectRow = { readonly content: unknown; readonly page?: unknown };

/**
 * The record of a stored row: its `page`, or, on a row with none, its
 * `content` read the way migration 0050 reads it (`blocksRecordOf`). Null
 * when what the row holds is not a record.
 */
export function rowRecordOf(row: ProjectRow): ProjectRecord | null {
  if (row.page !== null && row.page !== undefined) return storedProjectRecord(row.page);
  const before = storedBeforeBlocks(row.content);
  return before === null ? null : blocksRecordOf(before);
}

/**
 * The `content` of a row for a project that has none from before page blocks:
 * the record New project stored then, under the project's name, address and
 * kind, from the year its card starts.
 */
export function newRowContent(record: ProjectRecord): BeforeBlocksRecord {
  const year = startYearOf(record.card) ?? new Date().getUTCFullYear();
  return newProjectBeforeBlocks({ name: record.name, slug: record.slug, kind: record.kind }, year);
}

/** A row the project already has: its version and the `content` it holds. */
export type KeptRow = { readonly version: VersionKind; readonly content: unknown };

/**
 * The `content` a row of version `kind` is written with, beside `record` in
 * its `page`: what the project's row of that version holds, else what its
 * other version holds (a first draft of a published project), else
 * `newRowContent`. A save changes the page blocks record only.
 */
export function rowContentOf(kind: VersionKind, kept: readonly KeptRow[], record: ProjectRecord): unknown {
  const row = kept.find((r) => r.version === kind) ?? kept[0];
  return row === undefined ? newRowContent(record) : row.content;
}
