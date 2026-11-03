import { CHANGED_SINCE_READ } from "@/lib/content/editor";
import type { MemoryContentStore } from "@/lib/content/memory";
import type { ContentItem } from "@/lib/content/versioned";
import { refused } from "@/lib/dashboard/write";
import { advisorsAfter, type AdvisorItem, type AdvisorVersion } from "./advisors";
import { sameTeamPageRead, type TeamPageStore } from "./team-page-editor";
import type { StoredTeamPage } from "./team-page-stored";

// The Team page's store held in memory (issue #321): the layer document, each
// version with its layout (issue #850), and the advisors, each in its own
// memory content store (lib/content/memory.ts), for tests of the editor's
// rules.

/**
 * A Team page store over `layer` and `advisors`. A save first asks `refusal`
 * whether both lists can be kept, and writes neither when one cannot. Each
 * memory store's own `keep` must refuse nothing `refusal` lets through, so a
 * save that passed it lands both lists.
 */
export function memoryTeamPageStore(
  layer: MemoryContentStore<StoredTeamPage>,
  advisors: MemoryContentStore<AdvisorVersion>,
  refusal: (layer: readonly ContentItem<StoredTeamPage>[], advisors: readonly AdvisorItem[]) => string | null = () => null,
): TeamPageStore {
  return {
    layer,
    advisors: () => advisors.list(),
    async save(version, writes, expected) {
      const [current] = await layer.list();
      if (!sameTeamPageRead({ layer: current?.version ?? null, advisors: await advisors.list() }, expected)) return refused(CHANGED_SINCE_READ);
      const nextLayer = [{ id: current?.id ?? 1, siteOrder: current?.siteOrder ?? 1, version }];
      const nextAdvisors = advisorsAfter(await advisors.list(), writes);
      const why = refusal(nextLayer, nextAdvisors);
      if (why !== null) return refused(why);
      const kept = writes.length === 0 ? null : await advisors.replace(nextAdvisors);
      return kept === null || kept.ok ? layer.replace(nextLayer) : kept;
    },
  };
}
