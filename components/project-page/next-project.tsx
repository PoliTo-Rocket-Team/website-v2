import Link from "next/link";
import type { Project } from "@/lib/projects";

// Boards 23, 24 and 25 (and their phone boards): the next project in a glass
// card; the last project's card loops back to the first. "Open <name>" is the
// white pill (as the navbar Apply), "All projects" the outlined one.
export function NextProject({ project, teaser }: { project: Project; teaser: string }) {
  return (
    <section className="px-5 pb-14 pt-14 md:px-16 md:pb-[160px] md:pt-[120px]">
      <div className="glass-card mx-auto flex max-w-[1312px] flex-col gap-6 rounded-2xl p-5 md:flex-row md:items-center md:justify-between md:px-12 md:py-12">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-accent md:text-xs">NEXT PROJECT · {project.index}</p>
          <h2 className="mt-3 text-[36px] font-extrabold leading-none tracking-[-0.03em] md:mt-4 md:text-[56px]">
            {project.name}
          </h2>
          <p className="mt-3 text-[15px] leading-[22px] text-text-2 md:mt-4 md:text-[17px]">{teaser}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-row-reverse md:gap-4">
          <Link
            href={`/projects/${project.slug}`}
            className="rounded-full bg-prt-text px-6 py-3 text-center text-[15px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 active:opacity-80 md:py-2.5"
          >
            Open {project.name}
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-white-10 px-6 py-3 text-center text-[15px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:border-border-strong md:py-2.5"
          >
            All projects
          </Link>
        </div>
      </div>
    </section>
  );
}
