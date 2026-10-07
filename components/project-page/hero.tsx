import Image from "next/image";
import Link from "next/link";
import type { Hero } from "@/lib/project-pages";
import type { Project } from "@/lib/projects";
import { CopyText, Pill } from "./parts";

// Boards 23, 24 and 25 hero (1440): breadcrumb, the 128px name, intro left
// with the status pill and dates right, then the visual panel on the
// project's texture (when the project has one) and up to six key facts.
// Boards 23m, 24m and 25m (390): the same stack at 20px sides, pill and dates
// in one row under the intro, facts 3 x 2.

/**
 * A phone column is about 106px at 360 wide. Facts as long as board 25m's
 * "Regenerative" are set at its 17px; shorter ones keep board 23m's 20px.
 */
const LONG_FACT = 10;
const phoneFactSize = (facts: Hero["facts"]) =>
  facts.some((f) => f.value.length > LONG_FACT) ? "text-[17px]" : "text-[20px]";

export function ProjectHero({ project, hero }: { project: Project; hero: Hero }) {
  const factSize = phoneFactSize(hero.facts);
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
            {project.index} · {project.name.toUpperCase()}
          </span>
        </nav>

        <h1 className="mt-3 text-[52px] font-extrabold leading-none tracking-[-0.03em] md:mt-8 md:text-[128px]">
          {project.name}
        </h1>

        <div className="mt-4 flex flex-col gap-4 md:mt-10 md:flex-row md:items-start md:justify-between">
          <p className="max-w-[640px] text-[15px] leading-[24px] text-text-2 md:text-[20px] md:leading-[29px]">
            <CopyText copy={hero.intro} />
          </p>
          <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-3">
            <Pill tone="success">{hero.status}</Pill>
            <p className="font-mono text-[11px] tracking-[0.2em] text-prt-muted md:text-xs">{hero.dates}</p>
          </div>
        </div>

        {hero.visual && (
          <div className="glass-project relative mt-6 h-[220px] overflow-hidden rounded-2xl md:mt-10 md:h-[620px]">
            <Image
              src={project.texture}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 1312px, 100vw"
              className="object-cover"
            />
            {/* A still is rendered for the desktop box; contain keeps the
                rocket whole and centred on a phone's shorter, narrower panel
                (cavour-assets.ts). */}
            {hero.visual.still && (
              <Image
                src={hero.visual.still.src}
                alt={hero.visual.still.alt}
                fill
                priority
                sizes="(min-width: 768px) 1312px, 100vw"
                className="object-contain"
              />
            )}
            <p className="pointer-events-none absolute bottom-4 left-5 z-[2] font-mono text-[10px] tracking-[0.2em] text-prt-text/80 md:bottom-12 md:left-8 md:text-[11px]">
              {hero.visual.caption}
            </p>
          </div>
        )}

        <dl className="mt-6 grid grid-cols-3 md:mt-10 md:grid-cols-6 md:border-t md:border-hairline md:pt-6">
          {hero.facts.map((f) => (
            // Label under the value, as drawn; the markup keeps term before value.
            <div key={f.label.text} className="flex flex-col-reverse border-t border-hairline py-3 md:border-0 md:py-0">
              <dt className="mt-1 font-mono text-[9px] tracking-[0.2em] text-dim md:mt-2 md:text-[10px]">
                <CopyText copy={f.label} />
              </dt>
              <dd className={`whitespace-nowrap ${factSize} font-bold tracking-[-0.02em] md:text-[28px]`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
