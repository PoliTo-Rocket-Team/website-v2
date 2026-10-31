import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  alumniEntries,
  members,
  outreachPostVersions,
  outreachSummitVersions,
  partnerVersions,
  projectVersions,
  teamPageAdvisorVersions,
  teamPageLayerVersions,
} from "@/db/schema";
import type { PublicPathname } from "./pathname";

// Which public-store files a row still shows (issue #831). A file in the
// public store may be named by any of these columns: a member's picture, an
// alumni entry's photo, a Team page layer version or its layout, an advisor version, an
// Outreach post version, a project version or a partner version. A delete
// asks this first, with every column at once, so a file another row still
// shows is never deleted. A column names a file by its URL, which ends in
// `/<pathname>`; in the JSON columns the URL sits inside the document.

type Db = ReturnType<typeof getDb>;

/** Each column that may hold a public file's URL, as text: the JSON ones whole. */
function referencingTexts(): { readonly table: SQL; readonly text: SQL }[] {
  return [
    { table: sql`${members}`, text: sql`${members.picture}` },
    { table: sql`${alumniEntries}`, text: sql`${alumniEntries.photo}` },
    { table: sql`${teamPageLayerVersions}`, text: sql`${teamPageLayerVersions.layer}::text || coalesce(${teamPageLayerVersions.layout}::text, '')` },
    { table: sql`${teamPageAdvisorVersions}`, text: sql`${teamPageAdvisorVersions.advisor}::text` },
    {
      table: sql`${outreachPostVersions}`,
      text: sql`${outreachPostVersions.photos}::text || ${outreachPostVersions.body}::text || coalesce(${outreachPostVersions.gallery}::text, '')`,
    },
    { table: sql`${outreachSummitVersions}`, text: sql`${outreachSummitVersions.photoSrc}` },
    { table: sql`${projectVersions}`, text: sql`${projectVersions.page}::text` },
    { table: sql`${partnerVersions}`, text: sql`${partnerVersions.logoUrl}` },
  ];
}

/**
 * The statement that answers which of `pathnames` some row still names, one
 * row each. It goes in the batch that changes the reference, after the
 * change, so it reads what that transaction leaves; or on its own, right
 * before a delete.
 */
export function referencedPublicFiles(db: Db, pathnames: readonly PublicPathname[]) {
  const named = sql`array[${sql.join(pathnames.map((p) => sql`${p}`), sql`, `)}]::text[]`;
  const anyColumn = sql.join(
    referencingTexts().map(({ table, text }) => sql`exists (select 1 from ${table} where strpos(${text}, '/' || "file"."pathname") > 0)`),
    sql` or `,
  );
  return db.execute<{ pathname: string }>(sql`select "file"."pathname" from unnest(${named}) as "file" ("pathname") where ${anyColumn}`);
}

/** What `referencedPublicFiles` answers: one row for each file some row names. */
export type ReferencedFiles = { readonly rows: readonly { readonly pathname: string }[] };

/** Of `pathnames`, those `referenced` (the answer of `referencedPublicFiles`) does not name: no row shows them. */
export function unreferenced<P extends string>(pathnames: readonly P[], referenced: ReferencedFiles): P[] {
  const named = new Set(referenced.rows.map((row) => row.pathname));
  return [...new Set(pathnames)].filter((pathname) => !named.has(pathname));
}
