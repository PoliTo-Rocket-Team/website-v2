import type { ReactNode } from "react";
import type { Advisors as AdvisorsData } from "@/lib/about/types";
import { GAP, gridWidth } from "./group-layout";
import { PersonCell } from "./person";
import { SectionHead } from "./section-head";

// Boards 26 and 26m, "Advisors": from lg the same person cells as the
// department heads, three columns filled row by row on the boards' 960px grid; below lg one column with
// 56px photos. A principal advisor's role is in accent, a specialist's in grey.
// The advisors are added by hand (issue #286); with none the page leaves the
// section out, unless the Team page editor frames it (board 80c) so one can be
// added.

const grid: Record<`--${string}`, string> = {
  "--gap": `${GAP}px`,
  "--w": `${gridWidth(3)}px`,
};

export function Advisors({ advisors, frame }: { advisors: AdvisorsData; frame?: (section: ReactNode) => ReactNode }) {
  if (advisors.people.length === 0 && frame === undefined) return null;
  const content = (
    <div className="mx-auto max-w-[1312px]">
      <SectionHead title={advisors.title} intro={advisors.intro} align="centre" />
      <div
        style={grid}
        className="mx-auto mt-8 grid max-w-[var(--w)] grid-cols-1 gap-y-3.5 lg:mt-14 lg:grid-cols-3 lg:gap-x-[var(--gap)] lg:gap-y-12"
      >
        {advisors.people.map((a, i) => (
          <PersonCell
            // Two advisors may share a name; their place does not.
            key={`${i}:${a.name}`}
            person={a}
            role={a.role}
            accent={a.standing === "principal"}
            phone={{ avatar: "h-14 w-14", gap: "gap-4" }}
          />
        ))}
      </div>
    </div>
  );
  return <section className="px-5 pt-section md:px-16">{frame === undefined ? content : frame(content)}</section>;
}
