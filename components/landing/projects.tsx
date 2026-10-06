import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { RocketCardStage } from "./rocket-card-stage";
import { RocketArrow } from "./rocket-arrow";
import { SwipeRow } from "./swipe-row";

// Board 21, projects. Three vehicles on their brand textures, each with
// Cavour live in 3D and a liquid glass info box. Data from
// design/specs-from-old-site.md.
//
// Hover: the rocket rises 170px over 450ms ease-out and its nose leaves the
// top of the card, and the card's glass edge brightens. The rise is a CSS
// transform on the canvas wrapper, so it is exact in px and drops out under
// reduced motion; only the edge change is left then.
//
// Board 24 below md: the cards sit side by side in a horizontal swipe row,
// 210 x 360 each, 10px apart, with scroll-snap, the next card peeking and
// pager dots below (swipe-row.tsx). Phone copy is shorter: `phone` text
// replaces the desktop text below md.

/** Text with an optional shorter phone version (board 24). */
type Copy<T = string> = { text: T; phone?: T };

type Spec = { label: Copy; value: Copy };
type Project = {
  num: string;
  year: Copy;
  status: string;
  /** IN DESIGN reads as a light pill; flown vehicles get a dark one. */
  statusStyle: string;
  name: string;
  desc: Copy<ReactNode>;
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
    year: { text: "2023" },
    status: "FLOWN ×3",
    statusStyle: darkPill,
    name: "Cavour",
    desc: { text: "Our first rocket. First Italian team at Spaceport America Cup." },
    specs: [
      { label: { text: "APOGEE" }, value: { text: "3 143 m" } },
      { label: { text: "MOTOR" }, value: { text: "Solid · L", phone: "Solid L" } },
      { label: { text: "SPEED" }, value: { text: "295 m/s" } },
    ],
    texture: "/textures/project-cavour.webp",
  },
  {
    num: "02",
    year: { text: "2024–25", phone: "24–25" },
    status: "FLOWN · MK I",
    statusStyle: darkPill,
    name: "VES",
    desc: {
      text: "130 mm, all-SRAD systems. Mark I flew EuRoC 2024; Mark II won Design & Build at IREC 2025.",
      phone: "130 mm, all-SRAD systems. Mark II won Design & Build at IREC 2025.",
    },
    specs: [
      { label: { text: "APOGEE" }, value: { text: "3 160 m" } },
      { label: { text: "MOTOR" }, value: { text: "M · O" } },
      { label: { text: "VERSIONS", phone: "MARKS" }, value: { text: "Mk I · II", phone: "Mk I–II" } },
    ],
    texture: "/textures/project-ves.webp",
  },
  {
    num: "03",
    year: { text: "2023–" },
    status: "IN DESIGN",
    statusStyle: lightPill,
    name: "Efesto",
    desc: {
      text: (
        <>
          The first Italian pressure-fed liquid rocket engine. N<sub>2</sub>O and ethanol, printed
          in copper.
        </>
      ),
    },
    specs: [
      { label: { text: "THRUST" }, value: { text: "5 kN" } },
      { label: { text: "FUEL" }, value: { text: "N₂O · EtOH", phone: "Ethanol" } },
      { label: { text: "COOLING" }, value: { text: "Regen." } },
    ],
    texture: "/textures/project-efesto.webp",
    infoTint: 0.82,
  },
];

function Text<T extends ReactNode>({ copy }: { copy: Copy<T> }) {
  if (copy.phone === undefined) return <>{copy.text}</>;
  return (
    <>
      <span className="md:hidden">{copy.phone}</span>
      <span className="hidden md:inline">{copy.text}</span>
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    // isolate: the card is its own stacking context, so the z-indexes below
    // order its own layers and never reach a neighbouring card.
    <article className="glass-project group relative isolate h-[360px] w-[210px] shrink-0 snap-start rounded-2xl hover:z-10 md:mx-auto md:h-[618px] md:w-full md:max-w-[480px] lg:max-w-none">
      {/* Texture: clipped to the card's corners on its own layer, because the
          card itself must not clip the rocket's nose. */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <Image
          src={project.texture}
          alt=""
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 480px, 210px"
          className="object-cover"
        />
      </div>

      {/* Rocket. Clipped to the card's sides and rounded bottom but open at
          the top, so the nose can leave the card. The canvas reaches below the
          card by the rise, so the hull still meets the bottom edge once the
          wrapper has moved up. On phones the canvas is shorter (593px over a
          360px card) and sits 25px left, so the vehicle draws at about board
          24's size with its nose about 20px below the card top, near the
          middle, and the same nose-to-mid-body framing.
          Layers: the glass edge rings (.glass-project ::before and ::after)
          sit at z-index 1, so the rocket at 2 draws over them where its nose
          crosses the card's top edge. The top row and the info box are also
          at 2 and come later, so they stay above the rocket as before.
          will-change keeps the rising wrapper on its own compositor layer
          from the start, so the rise never waits on a repaint of the canvas
          and the hover does not stutter while the canvas draws frames. */}
      <div className="pointer-events-none absolute inset-0 z-[2] [clip-path:inset(-400px_0_0_0_round_16px)]">
        <div className="absolute -bottom-[89px] -top-[144px] left-[-25px] right-[25px] transition-transform ease-out will-change-transform [transition-duration:450ms] motion-safe:group-hover:-translate-y-[170px] md:-bottom-[170px] md:-top-[260px] md:left-0 md:right-0">
          <RocketCardStage />
        </div>
      </div>

      {/* Top row */}
      <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3.5 md:p-8">
        <span className="font-mono text-[9px] tracking-[0.15em] text-prt-text/70 md:text-[13px]">
          {project.num} · <Text copy={project.year} />
        </span>
        <span
          className={`rounded-full px-2 py-1 font-mono text-[9px] tracking-[0.15em] md:px-3 md:py-1.5 md:text-[11px] ${project.statusStyle}`}
        >
          {project.status}
        </span>
      </div>

      {/* Info box */}
      <div
        className="glass-info absolute inset-x-3.5 bottom-3.5 z-[2] rounded-xl px-3 pb-3 pt-3 md:inset-x-8 md:bottom-8 md:px-6 md:pb-5 md:pt-[26px] lg:inset-x-5 lg:bottom-5 xl:inset-x-8 xl:bottom-8"
        style={
          project.infoTint
            ? ({ "--glass-tint": project.infoTint } as React.CSSProperties)
            : undefined
        }
      >
        <h3 className="text-[24px] font-extrabold leading-none tracking-[-0.02em] md:text-[48px] lg:text-[40px] xl:text-[48px]">
          {project.name}
        </h3>
        <p className="mt-2 text-[11px] leading-[15px] text-prt-text/90 md:mt-4 md:text-[15px] md:leading-[23px] xl:text-base">
          <Text copy={project.desc} />
        </p>
        <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white-10 pt-2.5 md:mt-4 md:gap-3 md:pt-4">
          {project.specs.map((s) => (
            <div key={s.label.text}>
              <dt className="font-mono text-[8px] tracking-[0.2em] text-prt-muted md:text-[10px]">
                <Text copy={s.label} />
              </dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-[10px] text-prt-text md:mt-1.5 md:text-[13px]">
                <Text copy={s.value} />
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
    // Board 24 below md: 20px sides, 56px top and bottom, 26px heading, then
    // the swipe row.
    <section className="px-5 py-14 md:px-16 md:py-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">PROJECTS</p>
            <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
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

        <SwipeRow
          label="Projects"
          className="mt-6 md:mt-14 md:grid md:gap-8 lg:grid-cols-3 lg:gap-4"
        >
          {projects.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
        </SwipeRow>
      </div>
    </section>
  );
}
