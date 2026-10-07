import type { Advisor, Advisors as AdvisorsData } from "@/lib/about/types";
import { Avatar, Contacts } from "./person";
import { SectionHead } from "./section-head";

// Boards 26 and 26m, "Advisors": from lg two mirror-image columns about a
// dashed centre line, the advisors alternating left and right in order, as
// the department heads are; below lg one column with 56px photos. A
// principal advisor's role is in accent, a specialist's in grey.

function AdvisorRow({ advisor, side }: { advisor: Advisor; side: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-4 lg:gap-[23px] ${side === "left" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
      <Avatar
        person={advisor}
        sizeClass="h-14 w-14 lg:h-[120px] lg:w-[120px]"
        sizes="120px"
        fallback="initials-to-mark"
        initialsClass="text-[13px]"
      />
      <div className={`min-w-0 ${side === "left" ? "lg:flex lg:flex-col lg:items-end" : ""}`}>
        <p className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-prt-text lg:text-[22px]">{advisor.name}</p>
        {advisor.role !== undefined && (
          <p
            className={`mt-0.5 text-[13px] leading-tight lg:mt-1.5 lg:text-[16px] ${
              advisor.standing === "principal" ? "text-accent" : "text-text-2"
            }`}
          >
            {advisor.role}
          </p>
        )}
        <Contacts person={advisor} iconClass="h-4 w-4 lg:h-[18px] lg:w-[18px]" className="mt-1.5 lg:mt-2.5" />
      </div>
    </div>
  );
}

export function Advisors({ advisors }: { advisors: AdvisorsData }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={advisors.eyebrow} title={advisors.title} intro={advisors.intro} align="centre" />
        <div className="relative mx-auto mt-8 grid max-w-[880px] grid-cols-1 gap-y-3.5 lg:mt-14 lg:grid-cols-2 lg:gap-x-20 lg:gap-y-10">
          <span aria-hidden className="absolute inset-y-0 left-1/2 hidden border-l border-dashed border-dim lg:block" />
          {advisors.people.map((a, i) => (
            <AdvisorRow key={a.name} advisor={a} side={i % 2 === 0 ? "left" : "right"} />
          ))}
        </div>
      </div>
    </section>
  );
}
