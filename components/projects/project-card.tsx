import Image from "next/image";
import { RocketCardStage } from "@/components/landing/rocket-card-stage";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { statusOf, type Copy, type Project, type ProjectStatus } from "@/lib/projects";
import { LaunchLog, LaunchLogStacked } from "./launch-log";
import { WorkLines, WorkLinesStacked } from "./work-lines";

// Board 22, one card per project: a liquid glass card with the project's
// texture panel on the left and its facts on the right, then the launch log
// (or Efesto's work lines) across the card below a hairline.
// Board 22m below md: the panel on top at 140px, the facts under it with the
// specs 3 x 2 between hairlines, and the log behind an accordion row.

/** Text with a shorter phone version (board 22m) where the data has one. */
function Text({ copy }: { copy: Copy }) {
  if (copy.phone === undefined) return <>{copy.text}</>;
  return (
    <>
      <span className="md:hidden">{copy.phone}</span>
      <span className="hidden md:inline">{copy.text}</span>
    </>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const [label, style] =
    status.kind === "flown"
      ? [`FLOWN ×${status.flights}`, "bg-success-soft text-success"]
      : ["IN DEVELOPMENT", "bg-warning-soft text-warning"];
  return (
    <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] tracking-[0.15em] ${style}`}>
      {label}
    </span>
  );
}

/**
 * The texture panel. Cavour shows its live 3D model crossing the panel
 * corner to corner; the other projects show their texture only. The
 * card rocket stands nearly upright in its own canvas, so the canvas is
 * turned to lay the vehicle along the panel's diagonal, nose top right.
 */
function TexturePanel({ project }: { project: Project }) {
  return (
    <div className="glass-project relative h-[140px] rounded-xl md:h-[320px] md:rounded-2xl">
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <Image
          src={project.texture}
          alt=""
          fill
          sizes="(min-width: 1024px) 560px, (min-width: 768px) 100vw, 330px"
          className="object-cover"
        />
        {project.slug === "cavour" && (
          <div className="pointer-events-none absolute left-[calc(50%-16px)] top-[calc(50%+12px)] h-[1048px] w-[420px] origin-center -translate-x-1/2 -translate-y-1/2 rotate-[53deg] scale-[0.62] md:left-1/2 md:top-1/2 md:scale-100">
            <RocketCardStage />
          </div>
        )}
      </div>
    </div>
  );
}

function Facts({ project }: { project: Project }) {
  const rows = [project.specs.slice(0, 3), project.specs.slice(3)];
  return (
    <div className="px-1 pt-4 md:px-0 md:pt-8 lg:pt-0">
      <div className="flex items-center gap-3 md:gap-4">
        <span className="font-mono text-[11px] tracking-[0.15em] text-prt-muted md:text-[13px]">
          {project.index} · {project.years}
        </span>
        <StatusPill status={statusOf(project)} />
      </div>
      <h2 id={`project-${project.slug}`} className="mt-3 text-[30px] font-extrabold leading-none tracking-[-0.02em] md:mt-5 md:text-[48px]">
        {project.name}
      </h2>
      <p className="mt-3 text-[13px] leading-[20px] text-text-2 md:mt-4 md:text-[16px] md:leading-[24px]">
        <Text copy={project.description} />
      </p>
      {project.kind === "vehicle" && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 md:mt-5 md:gap-2">
          <span className="mr-2 hidden font-mono text-[11px] tracking-[0.2em] text-prt-muted md:inline">
            VERSIONS
          </span>
          {project.versions.map((v, i) => (
            <span
              key={v}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] tracking-[0.05em] md:px-2.5 md:text-[12px] ${
                i === 0 ? "border-border-strong bg-white-5 text-prt-text" : "border-white-10 text-text-2"
              }`}
            >
              {v}
            </span>
          ))}
        </div>
      )}
      <dl className="mt-3 md:mt-5 md:space-y-4 md:border-t md:border-white-10 md:pt-5">
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-3 gap-x-2 border-t border-white-10 py-3 md:border-0 md:py-0">
            {row.map((s) => (
              <div key={s.label.text}>
                <dt className="font-mono text-[9px] tracking-[0.2em] text-prt-muted md:text-[11px]">
                  <Text copy={s.label} />
                </dt>
                <dd className="mt-1 whitespace-nowrap text-[13px] font-semibold text-prt-text md:text-[17px]">
                  <Text copy={s.value} />
                </dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const accordionLabel =
    project.kind === "vehicle" ? `LAUNCH LOG · ${project.logSummary}` : "FIVE WORK LINES";
  return (
    <article
      aria-labelledby={`project-${project.slug}`}
      className="glass-info rounded-3xl"
    >
      <div className="p-3.5 md:p-12 lg:grid lg:grid-cols-[559fr_606fr] lg:items-center lg:gap-12">
        <TexturePanel project={project} />
        <Facts project={project} />
      </div>

      {/* From md the log sits open across the card. */}
      <div className="hidden border-t border-white-10 px-12 pb-10 pt-8 md:block">
        {project.kind === "vehicle" ? (
          <LaunchLog launches={project.launches} />
        ) : (
          <WorkLines workLines={project.workLines} milestone={project.milestone} />
        )}
      </div>

      {/* Below md it is collapsed behind one accordion row. */}
      <Accordion
        type="single"
        collapsible
        className="mx-3.5 border-t border-white-10 md:hidden"
      >
        <AccordionItem
          value="log"
          className="motion-reduce:[&_[role=region]]:animate-none"
        >
          <AccordionTrigger className="px-1 py-4 text-left font-mono text-[12px] font-normal tracking-[0.2em] text-text-2 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-prt-text">
            {accordionLabel}
          </AccordionTrigger>
          <AccordionContent className="px-1 pb-4">
            {project.kind === "vehicle" ? (
              <LaunchLogStacked launches={project.launches} />
            ) : (
              <WorkLinesStacked workLines={project.workLines} milestone={project.milestone} />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}
