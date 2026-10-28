import "server-only";

import { updateTag } from "next/cache";
import { sameTeamPageRead, type TeamPageRead, type TeamPageStore } from "@/lib/about/team-page-editor";
import { CHANGED_SINCE_READ } from "@/lib/content/editor";
import { runAuditBatch } from "@/lib/db-audit";
import { isGuardFailure, rowIds, unchangedRows } from "@/lib/db-guard";
import { ADVISOR_ROWS, advisorWriteQueries, readAdvisorItems, TEAM_ADVISORS_CACHE_TAG } from "./database-team-advisors";
import { databaseTeamPageLayerStore, LAYER_ROWS, layerVersionWrites, readTeamPageLayer, TEAM_PAGE_LAYER_CACHE_TAG } from "./database-team-page";
import { refused, written } from "./write";

// The database side of the Team page editor's Save draft and Publish (issue
// #321): the layer's rows and every advisor write go in one batch, which the
// neon-http driver sends as one transaction (lib/db-audit.ts), so a failing
// write leaves the layer and the advisors as they were. Then both public
// reads are refreshed. A save made on rows another save has replaced since
// is refused (issue #831).

/** The layer's and the advisors' rows as one save reads them. */
async function readTeamPage(): Promise<TeamPageRead> {
  const [layer, advisors] = await Promise.all([readTeamPageLayer(), readAdvisorItems()]);
  return { layer: layer[0]?.version ?? null, advisors };
}

export const databaseTeamPageStore: TeamPageStore = {
  layer: databaseTeamPageLayerStore,
  advisors: readAdvisorItems,
  async save(layer, advisors, expected) {
    // The row ids are read first, then the content, which must still be what
    // the save was made on; the batch opens with guards that fail it when a
    // write replaced either set of rows since (issue #831).
    const [layerIds, advisorIds] = await Promise.all([rowIds(LAYER_ROWS), rowIds(ADVISOR_ROWS)]);
    if (!sameTeamPageRead(await readTeamPage(), expected)) return refused(CHANGED_SINCE_READ);
    const unchanged = (db: Parameters<Parameters<typeof runAuditBatch>[0]>[0]) =>
      [unchangedRows(db, LAYER_ROWS, layerIds), unchangedRows(db, ADVISOR_ROWS, advisorIds)] as const;
    try {
      await runAuditBatch((db) => [...unchanged(db), ...layerVersionWrites(db, layer), ...advisorWriteQueries(db, advisors)]);
    } catch (error) {
      if (isGuardFailure(error)) return refused(CHANGED_SINCE_READ);
      throw error;
    }
    updateTag(TEAM_PAGE_LAYER_CACHE_TAG);
    if (advisors.length > 0) updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written(null);
  },
};
