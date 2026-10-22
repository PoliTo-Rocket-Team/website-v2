import Image from "next/image";
import Link from "next/link";
import type { Hero, Photo, TopVisual } from "@/lib/project-pages";
import type { Project } from "@/lib/projects";
import { stageStillOf, stageTextureOf, type OwnRocket } from "@/lib/rocket-model";
import { CopyText, FactList, Pill } from "./parts";

// Boards 23, 24 and 25 hero (1440): breadcrumb, the 128px name, intro left
// with the status pill and dates right, then the visual panel on the
// project's background (when its visual is a model or a photo) and up to six
// key facts. Boards 23m, 24m and 25m (390): the same stack at 20px sides,
// pill and dates in one row under the intro, facts 3 x 2.

/**
 * The panel's rocket slot: a still of the project's own model, or of the
 * shared placeholder when it has none (lib/rocket-model.ts). The still is
 * rendered for the desktop box; contain keeps the rocket whole and centred on
 * a phone's shorter, narrower panel (cavour-assets.ts).
 */
function RocketStill({ own }: { own: OwnRocket | undefined }) {
  const still = stageStillOf(own);
  return (
    <Image
      src={still.src}
      alt={still.alt}
      fill
      priority
      sizes="(min-width: 768px) 1312px, 100vw"
      className="object-contain"
    />
  );
}

/** An uploaded photo filling the panel; one from the public store, or a preview's data URL, is served as it is. */
function PhotoFill({ photo }: { photo: Photo }) {
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      priority
      sizes="(min-width: 768px) 1312px, 100vw"
      unoptimized={!photo.src.startsWith("/")}
      className="object-cover"
    />
  );
}

/**
 * The visual panel. A model's still lies on the project's background; an
 * engine's still is centred on the orange streak texture in its place
 * (stageTextureOf, issue #382). A photo fills the panel.
 */
function VisualPanel({ texture, visual }: { texture: string; visual: Exclude<TopVisual, { kind: "none" }> }) {
  return (
    <div className="glass-project relative mt-6 h-[220px] overflow-hidden rounded-2xl md:mt-10 md:h-[620px]">
      {visual.kind === "model" ? (
        <>
          <Image
            src={stageTextureOf(visual.own, texture)}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 1312px, 100vw"
            // An uploaded background (issue #529) is served as it is, as uploaded photos are.
            unoptimized={!stageTextureOf(visual.own, texture).startsWith("/")}
            className="object-cover"
          />
          <RocketStill own={visual.own} />
        </>
      ) : (
        <PhotoFill photo={visual.photo} />
      )}
      <p className="pointer-events-none absolute bottom-4 left-5 z-[2] font-mono text-[10px] tracking-[0.2em] text-prt-text/80 md:bottom-12 md:left-8 md:text-[11px]">
        {visual.caption}
      </p>
    </div>
  );
}

export function ProjectHero({
  project,
  hero,
  underNavbar = true,
}: {
  project: Pick<Project, "index" | "name" | "texture">;
  hero: Hero;
  /**
   * The top clears the site's fixed bar (64px, 72px from md, navbar.tsx) and
   * then keeps 24px, 92px from md. The editor draws the page with no navbar
   * (issue #495), so it keeps the second part alone.
   */
  underNavbar?: boolean;
}) {
  const { visual } = hero;
  return (
    <section className={underNavbar ? "px-5 pt-[88px] md:px-16 md:pt-[164px]" : "px-5 pt-6 md:px-16 md:pt-[92px]"}>
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

        {visual.kind !== "none" && <VisualPanel texture={project.texture} visual={visual} />}

        <FactList facts={hero.facts} className="mt-6 md:mt-10" />
      </div>
    </section>
  );
}
