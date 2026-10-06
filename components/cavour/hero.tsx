import Image from "next/image";
import Link from "next/link";
import { CavourRocketStage } from "./rocket-stage";
import { keyFacts } from "./data";
import { Pill } from "./parts";

// Board 23 hero (1440): breadcrumb, the 128px name, summary left with the
// status pill and years right, then the live rocket panel on the Cavour
// texture and six key facts. Board 23m (390): the same stack at 20px sides,
// pill and years in one row under the summary, facts 3 x 2.
export function CavourHero() {
  return (
    <section className="px-5 pt-[88px] md:px-16 md:pt-[164px]">
      <div className="mx-auto max-w-[1312px]">
        <nav aria-label="Breadcrumb" className="font-mono text-[11px] tracking-[0.2em] md:text-xs">
          <Link href="/projects" className="text-text-2 transition-colors duration-300 ease-out hover:text-accent">
            <span aria-hidden>←</span> ALL PROJECTS
          </Link>
          <span aria-hidden className="mx-3 text-dim md:mx-4">
            /
          </span>
          <span aria-current="page" className="text-prt-muted md:text-accent">
            01 · CAVOUR
          </span>
        </nav>

        <h1 className="mt-3 text-[52px] font-extrabold leading-none tracking-[-0.03em] md:mt-8 md:text-[128px]">
          Cavour
        </h1>

        <div className="mt-4 flex flex-col gap-4 md:mt-10 md:flex-row md:items-start md:justify-between">
          <p className="max-w-[640px] text-[15px] leading-[24px] text-text-2 md:text-[20px] md:leading-[29px]">
            The Team&apos;s first rocket, named after Camillo Benso, Count of Cavour. Three flights in one year,
            three configurations, two awards.
          </p>
          <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-3">
            <Pill tone="success">FLOWN ×3 · 2023</Pill>
            <p className="font-mono text-[11px] tracking-[0.2em] text-prt-muted md:text-xs">OCT 2021 – OCT 2023</p>
          </div>
        </div>

        <div className="glass-project relative mt-6 h-[220px] overflow-hidden rounded-2xl md:mt-10 md:h-[620px]">
          <Image
            src="/textures/project-cavour.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 1312px, 100vw"
            className="object-cover"
          />
          <CavourRocketStage />
          <p className="pointer-events-none absolute bottom-4 left-5 z-[2] font-mono text-[10px] tracking-[0.2em] text-prt-text/80 md:bottom-12 md:left-8 md:text-[11px]">
            <span className="md:hidden">CVR 100-75-3 · DRAG TO ORBIT</span>
            <span className="hidden md:inline">
              CVR 100-75-3 · FLIGHT CONFIGURATION
              <span className="ml-6 text-prt-text/50">LIVE 3D · DRAG TO ORBIT</span>
            </span>
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-3 md:mt-10 md:grid-cols-6 md:border-t md:border-hairline md:pt-6">
          {keyFacts.map((f) => (
            // Label under the value, as drawn; the markup keeps term before value.
            <div key={f.label} className="flex flex-col-reverse border-t border-hairline py-3 md:border-0 md:py-0">
              <dt className="mt-1 font-mono text-[9px] tracking-[0.2em] text-dim md:mt-2 md:text-[10px]">{f.label}</dt>
              <dd className="whitespace-nowrap text-[20px] font-bold tracking-[-0.02em] md:text-[28px]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
