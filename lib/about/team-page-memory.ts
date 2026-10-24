import type { MemoryContentStore } from "@/lib/content/memory";
import type { ContentItem } from "@/lib/content/versioned";
import { refused } from "@/lib/dashboard/write";
import { advisorsAfter, type AdvisorItem, type AdvisorVersion } from "./advisors";
import type { TeamPageLayer } from "./team-layer";
import type { TeamPageStore } from "./team-page-editor";

// The Team page's store held in memory (issue #321): the layer document and
// the advisors, each in its own memory content store (lib/content/memory.ts),
// for tests of the editor's rules.

/**
 * A Team page store over `layer` and `advisors`. A save first asks `refusal`
 * whether both lists can be kept, and writes neither when one cannot. Each
 * memory store's own `keep` must refuse nothing `refusal` lets through, so a
 * save that passed it lands both lists.
 */
export function memoryTeamPageStore(
  layer: MemoryContentStore<TeamPageLayer>,
  advisors: MemoryContentStore<AdvisorVersion>,
  refusal: (layer: readonly ContentItem<TeamPageLayer>[], advisors: readonly AdvisorItem[]) => string | null = () => null,
): TeamPageStore {
  return {
    layer,
    advisors: () => advisors.list(),
    async save(version, writes) {
      const [current] = await layer.list();
      const nextLayer = [{ id: current?.id ?? 1, siteOrder: current?.siteOrder ?? 1, version }];
      const nextAdvisors = advisorsAfter(await advisors.list(), writes);
      const why = refusal(nextLayer, nextAdvisors);
      if (why !== null) return refused(why);
      const kept = writes.length === 0 ? null : await advisors.replace(nextAdvisors);
      return kept === null || kept.ok ? layer.replace(nextLayer) : kept;
    },
  };
}
