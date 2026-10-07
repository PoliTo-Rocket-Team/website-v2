import type { Advisors as AdvisorsData } from "@/lib/about/types";
import { HEAD_GAP, gridWidth } from "./group-layout";
import { PersonCell } from "./person";
import { SectionHead } from "./section-head";

// Boards 26 and 26m, "Advisors": from lg the same person cells as the
// department heads, three columns filled row by row; below lg one column with
// 56px photos. A principal advisor's role is in accent, a specialist's in grey.

const grid: Record<`--${string}`, string> = {
  "--gap": `${HEAD_GAP}px`,
  "--w": `${gridWidth(3, HEAD_GAP)}px`,
};

export function Advisors({ advisors }: { advisors: AdvisorsData }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead title={advisors.title} intro={advisors.intro} align="centre" />
        <div
          style={grid}
          className="mx-auto mt-8 grid max-w-[var(--w)] grid-cols-1 gap-y-3.5 lg:mt-14 lg:grid-cols-3 lg:gap-x-[var(--gap)] lg:gap-y-12"
        >
          {advisors.people.map((a) => (
            <PersonCell
              key={a.name}
              person={a}
              role={a.role}
              accent={a.standing === "principal"}
              phone={{ avatar: "h-14 w-14", gap: "gap-4" }}
              fallback="initials"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
