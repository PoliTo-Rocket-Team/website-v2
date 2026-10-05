import Image from "next/image";
import Link from "next/link";
import RocketCard3D from "./rocket-card-3d";
import { RocketArrow } from "./rocket-arrow";

// Board 21, projects. Three vehicles on their brand textures, each with
// Cavour live in 3D and a liquid glass info box. Data from
// design/specs-from-old-site.md.
//
// Hover: the rocket rises 170px over 450ms ease-out and its nose leaves the
// top of the card, and the card's glass edge brightens. The rise is a CSS
// transform on the canvas wrapper, so it is exact in px and drops out under
// reduced motion; only the edge change is left then.
type Spec = { label: string; value: string };
type Project = {
  num: string;
  year: string;
  status: string;
  /** IN DESIGN reads as a light pill; flown vehicles get a dark one. */
  statusStyle: string;
  name: string;
  desc: React.ReactNode;
  specs: Spec[];
  texture: string;
  /** Efesto's texture is bright grey, so its info box is tinted darker. */
  infoTint?: number;
};

const darkPill = "bg-ground/70 text-prt-text";
const lightPill = "bg-prt-text text-ground";

const projects: Project[] = [
  {
    num: "01",
    year: "2023",
    status: "FLOWN ×3",
    statusStyle: darkPill,
    name: "Cavour",
    desc: "Our first rocket. First Italian team at Spaceport America Cup.",
    specs: [
      { label: "APOGEE", value: "3 143 m" },
      { label: "MOTOR", value: "Solid · L" },
      { label: "SPEED", value: "295 m/s" },
    ],
    texture: "/textures/project-cavour.webp",
  },
  {
    num: "02",
    year: "2024–25",
    status: "FLOWN · MK I",
    statusStyle: darkPill,
    name: "VES",
    desc: "130 mm, all-SRAD systems. Mark I flew EuRoC 2024; Mark II won Design & Build at IREC 2025.",
    specs: [
      { label: "APOGEE", value: "3 160 m" },
      { label: "MOTOR", value: "M · O" },
      { label: "VERSIONS", value: "Mk I · II" },
    ],
    texture: "/textures/project-ves.webp",
  },
  {
    num: "03",
    year: "2023–",
    status: "IN DESIGN",
    statusStyle: lightPill,
    name: "Efesto",
    desc: (
      <>
        The first Italian pressure-fed liquid rocket engine. N<sub>2</sub>O and ethanol, printed
        in copper.
      </>
    ),
    specs: [
      { label: "THRUST", value: "5 kN" },
      { label: "FUEL", value: "N₂O · EtOH" },
      { label: "COOLING", value: "Regen." },
    ],
    texture: "/textures/project-efesto.webp",
    infoTint: 0.82,
  },
];

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="glass-project group relative mx-auto h-[620px] w-full max-w-[480px] rounded-2xl hover:z-10 md:h-[618px] lg:max-w-none">
      {/* Texture: clipped to the card's corners on its own layer, because the
          card itself must not clip the rocket's nose. */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <Image
          src={project.texture}
          alt=""
          fill
          sizes="(min-width: 1024px) 30vw, 480px"
          className="object-cover"
        />
      </div>

      {/* Rocket. Clipped to the card's sides and rounded bottom but open at
          the top, so the nose can leave the card. The canvas reaches below the
          card by the rise, so the hull still meets the bottom edge once the
          wrapper has moved up. */}
      <div className="pointer-events-none absolute inset-0 [clip-path:inset(-400px_0_0_0_round_16px)]">
        <div className="absolute inset-x-0 -bottom-[170px] -top-[260px] transition-transform ease-out [transition-duration:450ms] motion-safe:group-hover:-translate-y-[170px]">
          <RocketCard3D />
        </div>
      </div>

      {/* Top row */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-8">
        <span className="font-mono text-[13px] tracking-[0.15em] text-prt-text/70">
          {project.num} · {project.year}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.15em] ${project.statusStyle}`}
        >
          {project.status}
        </span>
      </div>

      {/* Info box */}
      <div
        className="glass-info absolute inset-x-8 bottom-8 rounded-xl px-6 pb-5 pt-[26px] lg:inset-x-5 lg:bottom-5 xl:inset-x-8 xl:bottom-8"
        style={
          project.infoTint
            ? ({ "--glass-tint": project.infoTint } as React.CSSProperties)
            : undefined
        }
      >
        <h3 className="text-[48px] font-extrabold leading-none tracking-[-0.02em] lg:text-[40px] xl:text-[48px]">
          {project.name}
        </h3>
        <p className="mt-4 text-[15px] leading-[23px] text-prt-text/90 xl:text-base">
          {project.desc}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white-10 pt-4">
          {project.specs.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-[10px] tracking-[0.2em] text-prt-muted">{s.label}</dt>
              <dd className="mt-1.5 font-mono md:whitespace-nowrap text-[13px] text-prt-text">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

export function Projects() {
  return (
    // Board 24 below md: 20px sides, 72px top and bottom, 32px heading, cards
    // stacked full width at 620px.
    <section className="px-5 py-[72px] md:px-16 md:py-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">PROJECTS</p>
            <h2 className="mt-4 text-[32px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
              Built in Torino.
              <br />
              Flown around the world.
            </h2>
          </div>
          <Link
            href="/projects"
            className="group inline-flex shrink-0 items-center gap-3 font-mono text-base text-prt-text transition-colors hover:text-accent md:mb-1"
          >
            All projects
            <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
          </Link>
        </div>

        <div className="mt-8 grid gap-8 md:mt-14 lg:grid-cols-3 lg:gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
