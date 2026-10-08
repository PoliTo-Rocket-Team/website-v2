import Image from "next/image";
import Link from "next/link";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import type { UniversityPage } from "@/lib/about/university-types";
import { Split, eyebrow, subTitle } from "./split";
import { entranceBlur } from "./university-blur";

// Boards 30 and 30m, below the header: the entrance photo, Politecnico, and
// how Politecnico supports the team. Each section sits one section pad below
// the last and paints no background.

/** The photo is 800px tall from md and 300px on phones, cropped from the bottom so the entrance and its lettering stay in view (Huey's ruling, issue #103). */
export function EntrancePhoto({ photo }: { photo: UniversityPage["photo"] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="relative mx-auto h-[300px] max-w-[1312px] overflow-hidden rounded-xl md:h-[800px]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1440px) 1312px, 100vw"
          placeholder="blur"
          blurDataURL={entranceBlur}
          className="object-cover object-bottom"
        />
      </div>
    </section>
  );
}

export function Politecnico({ politecnico }: { politecnico: UniversityPage["politecnico"] }) {
  return (
    <Split
      left={
        <>
          <Image src={politecnico.logo} alt={politecnico.name} width={248} height={109} className="h-auto w-[200px] md:w-[300px]" />
          <h2 className={`mt-8 md:mt-10 ${subTitle}`}>{politecnico.title}</h2>
        </>
      }
      paragraphs={politecnico.paragraphs}
    />
  );
}

function LegendItem({ label, percent, dot }: { label: string; percent: number; dot: string }) {
  return (
    <li className="flex items-center justify-between gap-3 md:justify-start">
      <span className="flex items-center gap-3">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="text-prt-text">{percent}%</span>
    </li>
  );
}

export function Support({ support }: { support: UniversityPage["support"] }) {
  const sponsors = 100 - support.share;
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[820px] text-center">
        <p className={eyebrow}>{support.eyebrow}</p>
        <h2 className="mt-4 text-[24px] font-bold leading-[1.2] tracking-[-0.025em] md:text-[40px]">{support.title}</h2>
        <p className="mx-auto mt-4 max-w-[600px] text-[15px] leading-[1.6] text-text-2">{support.note}</p>

        {/* The legend below says the same in words. */}
        <div aria-hidden className="mt-10 flex h-2.5 overflow-hidden rounded-full bg-border-strong md:mt-12">
          <div className="bg-accent" style={{ width: `${support.share}%` }} />
        </div>
        <ul className="mt-4 flex flex-col gap-2 text-left text-[14px] text-text-2 md:flex-row md:justify-between">
          <LegendItem label={support.universityLabel} percent={support.share} dot="bg-accent" />
          <LegendItem label={support.sponsorsLabel} percent={sponsors} dot="bg-border-strong" />
        </ul>

        <Link
          href="/partners"
          className="group mt-10 inline-flex items-center gap-2 rounded-full border border-white-10 px-6 py-3 text-[15px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:border-border-strong md:mt-12 md:py-2.5"
        >
          {support.partnersLink}
          <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
        </Link>
      </div>
    </section>
  );
}
