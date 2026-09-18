import Image from "next/image";
import Link from "next/link";
import { newsBlur } from "./news-blur";

// VES, VES Mark II and Efesto have no render yet, which left three dead grey
// boxes in the row. The brand textures fill them so the row reads as four cards
// rather than one card and three holes. Same crops as the Latest section, handed
// out in order so no two cards share one.

// Board 06 — Projects. Cavour card carries the render tilted -16°; hover scales it
// ~15% in place ("toward the viewer", never slides) and rotates to -12° so the nose
// crosses the top-right border by growing, not moving. 300ms ease-out.
type Spec = { label: string; value: string };
type Project = {
  num: string;
  year: string;
  status: string;
  statusStyle: string;
  name: string;
  desc: string;
  specs: Spec[];
  image?: string;
};

// "arc" sits last: its bright highlight lands on the bottom edge of a card this
// short and reads as a glitch, so with four vehicles it never gets picked.
const textures = ["streaks", "fan", "swirl", "cloud", "arc"].map(
  (name) => `/design/news/tex-${name}.jpg`,
);

const projects: Project[] = [
  {
    num: "01",
    year: "2023",
    status: "FLOWN",
    statusStyle: "bg-success-soft text-success",
    name: "Cavour",
    desc: "First Italian rocket at Spaceport America Cup.",
    specs: [
      { label: "APOGEE", value: "3 050 m" },
      { label: "MOTOR", value: "Solid · M" },
      { label: "MAX SPEED", value: "Mach 0.8" },
    ],
    image: "/design/cavour-render-vert.png",
  },
  {
    num: "02",
    year: "2024",
    status: "FLOWN",
    statusStyle: "bg-success-soft text-success",
    name: "VES",
    desc: "Flew at EuRoC 2024. Nominal flight, full recovery, reused.",
    specs: [
      { label: "APOGEE", value: "3 160 m" },
      { label: "MOTOR", value: "Solid · M" },
      { label: "MAX SPEED", value: "Mach 0.9" },
    ],
  },
  {
    num: "03",
    year: "2025",
    status: "FLOWN",
    statusStyle: "bg-success-soft text-success",
    name: "VES Mark II",
    desc: "Our first supersonic design. 1st place Design & Build at IREC.",
    specs: [
      { label: "TARGET", value: "9 000 m" },
      { label: "MOTOR", value: "Solid · O" },
      { label: "MAX SPEED", value: "Mach 1.8" },
    ],
  },
  {
    num: "04",
    year: "2026",
    status: "IN DESIGN",
    statusStyle: "bg-warning-soft text-warning",
    name: "Efesto",
    desc: "First liquid-fuelled vehicle. Engine now on the VES test stand.",
    specs: [
      { label: "TARGET", value: "3 000 m" },
      { label: "ENGINE", value: "Liquid · LOX" },
      { label: "STATUS", value: "Static fire" },
    ],
  },
];

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const texture = textures[index % textures.length];
  return (
    <article className="group relative overflow-hidden rounded-[10px] border border-hairline bg-panel transition-colors duration-300 ease-out hover:border-border-strong hover:bg-surface-2">
      {/* Render zone */}
      <div className="relative h-64 overflow-hidden border-b border-hairline">
        <Image
          src={texture}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 25vw"
          placeholder="blur"
          blurDataURL={newsBlur[texture]}
          className="object-cover opacity-40 transition-opacity duration-300 ease-out group-hover:opacity-55"
        />
        {project.image ? (
          <>
            <Image
              src={project.image}
              alt={project.name}
              fill
              sizes="(max-width: 1024px) 100vw, 25vw"
              className="object-contain object-center p-4 [transform:rotate(-16deg)_scale(1)] transition-transform duration-300 ease-out group-hover:[transform:rotate(-12deg)_scale(1.15)]"
            />
            {/* Tail fades under text */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-panel to-transparent transition-colors duration-300 group-hover:from-surface-2" />
          </>
        ) : (
          <div className="relative flex h-full items-center justify-center font-mono text-xs tracking-widest text-dim">
            RENDER TBD
          </div>
        )}

        {/* Top row over render */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
          <span className="font-mono text-sm text-dim">
            {project.num} · {project.year}
          </span>
          <span className={`rounded-full px-3 py-1 font-mono text-xs tracking-widest ${project.statusStyle}`}>
            {project.status}
          </span>
        </div>
      </div>

      {/* Bottom */}
      <div className="p-6">
        <h3 className="text-xl font-bold">{project.name}</h3>
        <p className="mt-1.5 min-h-10 text-sm text-prt-muted">{project.desc}</p>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-hairline pt-5">
          {project.specs.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-[10px] tracking-widest text-dim">{s.label}</dt>
              <dd className="mt-1 font-mono text-xs text-text-2">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

export function Projects() {
  return (
    <section className="border-t border-hairline px-6 py-24 md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">PROJECTS</p>
            <h2 className="mt-4 max-w-[18ch] text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Three flown. A fourth on the pad.
            </h2>
          </div>
          <div className="max-w-[380px]">
            <p className="text-sm leading-relaxed text-prt-muted">
              From our first solid rocket to a liquid engine on the test stand. Each vehicle is a
              step up in altitude, speed and complexity.
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-block font-mono text-sm text-text-2 transition-colors hover:text-accent"
            >
              All projects →
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {projects.map((p, i) => (
            <ProjectCard key={p.name} project={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
