import "server-only";

import { updateTag } from "next/cache";
import type { TeamPageStore } from "@/lib/about/team-page-editor";
import { runAuditBatch } from "@/lib/db-audit";
import { advisorWriteQueries, readAdvisorItems, TEAM_ADVISORS_CACHE_TAG } from "./database-team-advisors";
import { databaseTeamPageLayerStore, layerVersionWrites, TEAM_PAGE_LAYER_CACHE_TAG } from "./database-team-page";
import { written } from "./write";

// The database side of the Team page editor's Save draft and Publish (issue
// #321): the layer's rows and every advisor write go in one batch, which the
// neon-http driver sends as one transaction (lib/db-audit.ts), so a failing
// write leaves the layer and the advisors as they were. Then both public
// reads are refreshed.

export const databaseTeamPageStore: TeamPageStore = {
  layer: databaseTeamPageLayerStore,
  advisors: readAdvisorItems,
  async save(layer, advisors) {
    await runAuditBatch((db) => [...layerVersionWrites(db, layer), ...advisorWriteQueries(db, advisors)]);
    updateTag(TEAM_PAGE_LAYER_CACHE_TAG);
    if (advisors.length > 0) updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written(null);
  },
};
