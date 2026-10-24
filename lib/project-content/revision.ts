import type { LegacyProjectRecord as ProjectRecord } from "./legacy";

// A change to a project's stored content made after the import (issue #361),
// on the record as it was stored before page blocks (./legacy.ts): every
// revision here ran before migration 0050 turned the records into blocks.
// The import (./import.ts) is frozen: migration 0037 already carried it into
// every database, and no migration runs twice. So a later change is a
// revision: a few values set at paths in one project's record, read the same
// way by the code (the records without a database, the seed)
// and by the migration that rewrites the stored versions, which holds exactly
// what `revisionSql` writes. One list of sets feeds both, so they cannot
// drift apart.

/** One value set at a path in a record; the path's last key is created when missing. */
export type RevisionSet = { readonly path: readonly [string, ...string[]]; readonly value: unknown };

/** Values set in the record of the project with this slug, in every stored version of it. */
export type ProjectRevision = { readonly slug: string; readonly sets: readonly [RevisionSet, ...RevisionSet[]] };

type Json = { [key: string]: unknown };

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * One step down a path: a key of an object, or, as jsonb_set reads a path, an
 * index of an array written as its digits ("0" is the first item).
 */
function step(at: unknown, key: string): unknown {
  if (isObject(at)) return at[key];
  return Array.isArray(at) && /^\d+$/.test(key) ? at[Number(key)] : undefined;
}

/**
 * The record with the revision applied, or the record itself when the
 * revision is another project's. As jsonb_set does, a set whose parent path
 * is missing changes nothing. A path may pass through a list by index
 * (`["launches", "entries", "0", "photos"]`); the key it sets is an object's.
 */
export function revise(record: ProjectRecord, revision: ProjectRevision): ProjectRecord {
  if (record.slug !== revision.slug) return record;
  const next = structuredClone(record) as unknown as Json;
  for (const { path, value } of revision.sets) {
    const parent = path.slice(0, -1).reduce<unknown>(step, next);
    if (isObject(parent)) parent[path[path.length - 1]] = structuredClone(value);
  }
  return next as unknown as ProjectRecord;
}

/** A SQL string literal, its quotes doubled. */
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** The statement that applies the revision to every stored version of its project. */
export function revisionSql(revision: ProjectRevision): string {
  const content = revision.sets.reduce(
    (inner, { path, value }) =>
      `jsonb_set(${inner}, ${literal(`{${path.join(",")}}`)}, ${literal(JSON.stringify(value))}::jsonb, true)`,
    `"content"`,
  );
  return `UPDATE "project_versions" SET "content" = ${content} WHERE "content"->>'slug' = ${literal(revision.slug)};`;
}
