import Image from "next/image";
import Link from "next/link";
import { RocketCardStage } from "@/components/landing/rocket-card-stage";
import { panelRocketOf, statusOf, type Copy, type Project, type ProjectStatus } from "@/lib/projects";

// Board 22, one card per project: a liquid glass card with the project's
// texture panel on the left and its facts on the right. Board 22m below md:
// the panel on top at 140px, the facts under it with the specs 3 x 2 between
// hairlines. The card ends at the specs on every width: the launch log and
// Efesto's work lines are the project page's to show (issue #381).

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
 * The texture panel. A rocket project shows its live 3D rocket crossing the
 * panel corner to corner, the model its home card draws (a rocket with no
 * model of its own draws the placeholder); an engine's panel is the texture
 * only (issue #381). The card rocket stands nearly upright in its own
 * canvas, so the canvas is turned to lay the vehicle along the panel's
 * diagonal, nose top right.
 */
function TexturePanel({ project }: { project: Project }) {
  const rocket = panelRocketOf(project);
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
        {rocket && (
          <div className="pointer-events-none absolute left-[calc(50%-16px)] top-[calc(50%+12px)] h-[1048px] w-[420px] origin-center -translate-x-1/2 -translate-y-1/2 rotate-[53deg] scale-[0.62] md:left-1/2 md:top-1/2 md:scale-100">
            <RocketCardStage model={rocket} />
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
        {/* Stretched link: its ::after covers the whole card, so the card is
            the target while the name stays the link's only text. */}
        <Link
          href={project.href}
          className="outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
        >
          {project.name}
        </Link>
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
  return (
    <article
      aria-labelledby={`project-${project.slug}`}
      className="glass-info glass-linked relative rounded-3xl"
    >
      <div className="p-3.5 md:p-12 lg:grid lg:grid-cols-[559fr_606fr] lg:items-center lg:gap-12">
        <TexturePanel project={project} />
        <Facts project={project} />
      </div>
    </article>
  );
}
