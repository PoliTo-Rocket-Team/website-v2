import type { AlumniPage, Founder } from "@/lib/about/alumni-types";
import { Avatar } from "../person";
import { SectionHead } from "../section-head";

// Board 28, "The founders": a centred row of the founder and the five
// co-founders, each a round colour photo (the initials where there is none),
// the FOUNDER or CO-FOUNDER tag, the name and what they did. Phones: a
// two-column grid with 72px photos.

function FounderCard({ founder }: { founder: Founder }) {
  return (
    <li className="flex flex-col items-center text-center">
      <Avatar
        person={founder}
        sizeClass="h-[72px] w-[72px] md:h-[112px] md:w-[112px]"
        sizes="112px"
        fallback="initials"
        initialsClass="text-[15px] md:text-[20px]"
      />
      <p className="mt-4 font-mono text-[9px] tracking-[0.2em] text-accent md:mt-5 md:text-[10px]">
        {founder.title === "founder" ? "FOUNDER" : "CO-FOUNDER"}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-prt-text md:text-[17px]">{founder.name}</p>
      <p className="mt-1 text-[12px] leading-tight text-prt-muted md:text-[13px]">{founder.role}</p>
    </li>
  );
}

export function Founders({ founders }: { founders: AlumniPage["founders"] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={founders.eyebrow} title={founders.title} intro={founders.intro} align="centre" />
        <ul className="mx-auto mt-8 grid max-w-[1120px] grid-cols-2 gap-x-4 gap-y-8 md:mt-14 md:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
          {founders.people.map((f) => (
            <FounderCard key={f.name} founder={f} />
          ))}
        </ul>
      </div>
    </section>
  );
}
