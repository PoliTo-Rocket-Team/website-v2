import type { BlockFacts } from "@/lib/project-pages";
import { BlockColumn, FactList, type BlockFrame } from "./parts";

// A Key facts block (board 93b): two to six big numbers with their labels,
// drawn as the hero's key facts are, on the page's column.
export function ProjectFacts({ facts, frame }: { facts: BlockFacts; frame?: BlockFrame }) {
  return (
    <BlockColumn frame={frame}>
      <FactList facts={facts} />
    </BlockColumn>
  );
}
