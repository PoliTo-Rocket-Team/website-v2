import type { BlockFacts } from "@/lib/project-pages";
import { FactList } from "./parts";

// A Key facts block (board 93b): two to six big numbers with their labels,
// drawn as the hero's key facts are, on the page's column.
export function ProjectFacts({ facts }: { facts: BlockFacts }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <FactList facts={facts} className="mx-auto max-w-[1312px]" />
    </section>
  );
}
