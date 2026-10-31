import { and, eq, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { teamPageLayerVersions } from "@/db/schema";
import { queryTeamSnapshot, teamRolesOf } from "@/lib/dashboard/team-snapshot";
import { storedTeamPage, storedTeamPageOfRow } from "./team-page-stored";

// The post-migration step that gives each stored Team page version its first
// layout (issue #850, ADR 0019 Decision 7, first fill). Both migration entry
// points run it right after the migrations (db/migrate-database.ts): the
// layout of a row with none is the one its layer snapshots to on the roles
// the database holds now (`storedTeamPage`), the same TypeScript the
// transitional read uses; no SQL builds it. A row that already
// has a layout is left alone, and so is a row whose layer this code could not
// have written, which the page skips anyway. Each write sets the layout only
// while the row still has none, so a second run, or a save landing between
// the read and the write, is never overwritten.

/** A Drizzle Postgres client the step runs on: a migration's own connection, or a test's. */
export type LayoutFillDb = Pick<PgDatabase<PgQueryResultHKT>, "select" | "update">;

/** Any upload counts here: the group photo stays in the layer, so the layout the snapshot builds does not depend on whose store it is in. */
const ANY_UPLOAD = () => true;

/** Fills the layout of every stored layer version that has none; answers how many rows it wrote. */
export async function fillTeamPageLayouts(db: LayoutFillDb): Promise<number> {
  const unfilled = await db
    .select({ id: teamPageLayerVersions.id, layer: teamPageLayerVersions.layer, layout: teamPageLayerVersions.layout })
    .from(teamPageLayerVersions)
    .where(isNull(teamPageLayerVersions.layout));
  if (unfilled.length === 0) return 0;
  const roles = teamRolesOf(await queryTeamSnapshot(db));
  let filled = 0;
  for (const row of unfilled) {
    const stored = storedTeamPageOfRow(row, ANY_UPLOAD);
    if (stored === null) continue;
    const written = await db
      .update(teamPageLayerVersions)
      .set({ layout: storedTeamPage(roles, stored.layer).layout })
      .where(and(eq(teamPageLayerVersions.id, row.id), isNull(teamPageLayerVersions.layout)))
      .returning({ id: teamPageLayerVersions.id });
    filled += written.length;
  }
  return filled;
}
