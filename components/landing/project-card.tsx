import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { HomeCardView } from "@/lib/project-content/record";
import { withSubscriptDigits } from "@/lib/project-content/subscript";
import type { Copy, ProjectPage } from "@/lib/projects";
import { rocketModelOf } from "@/lib/rocket-model";
import { RocketCardStage } from "./rocket-card-stage";
import { RocketTurnBox } from "./rocket-turn";

// One home project card (board 21; board 24 below md): a project on its brand
// texture, with its rocket live in 3D and a liquid glass info box. The home
// Projects section draws one per published project (projects.tsx), and the
// dashboard Projects page (board 75, issue #297) draws the same card, scaled.
// It reads nothing on the server, so a client page may draw it too. On Home
// the card links to its project's page; elsewhere it is a plain card.
//
// Hover: only the card's glass edge brightens. The rocket stays where it
// rests (Huey, 2026-10-06: no hover rise). On the home row it turns slowly
// about its own long axis in that rest pose (issue #385).

/** IN DESIGN reads as a light pill; flown vehicles get a dark one. */
const pill: Record<HomeCardView["statusTone"], string> = {
  dark: "bg-ground/70 text-prt-text",
  light: "bg-prt-text text-ground",
};

/** Text with an optional shorter phone version (board 24): `phone` replaces `text` below md. */
function Text({ copy, draw = (text) => text }: { copy: Copy; draw?: (text: string) => ReactNode }) {
  if (copy.phone === undefined) return <>{draw(copy.text)}</>;
  return (
    <>
      <span className="md:hidden">{draw(copy.phone)}</span>
      <span className="hidden md:inline">{draw(copy.text)}</span>
    </>
  );
}

/**
 * Where a card sits in the Projects swipe row: 210 x 360 on phones (board
 * 24); from md 618px tall and as wide as two cards to a view (below lg) or
 * three (from lg, board 21: 427px at 1440) leave room for, less the 16px gaps.
 * The row's next card peeks past the edge. The edit shell's page switch
 * (board 75d) puts this box on the frame round the card instead, and the card
 * fills the frame.
 */
export const HOME_CARD_LAYOUT = "h-[360px] w-[210px] shrink-0 snap-start md:h-[618px] md:w-[calc((100%-16px)/2)] lg:w-[calc((100%-32px)/3)]";

/** A card inside a frame that carries its layout. */
export const FILLS_FRAME = "h-full w-full";

/** The card-sized box the rocket shows in, open at the top (see the Rocket layer below). */
const ROCKET_BOX = "pointer-events-none absolute inset-0 z-[2] [clip-path:inset(-400px_0_0_0_round_16px)]";

/**
 * `href` makes the whole card one link to that page, named by the project's
 * name (issue #372). Home passes it; the dashboard, the edit shell's page
 * switch and the placeholder preview do not, so their cards stay plain.
 */
export function HomeProjectCard({
  project,
  href,
  layout = HOME_CARD_LAYOUT,
  rocketTurns = false,
}: {
  project: HomeCardView;
  href?: ProjectPage;
  layout?: string;
  /**
   * The rocket turns slowly about its long axis while its motion gate is open
   * (issue #385, rocket-turn.tsx). Only the home Projects row sets it; every
   * other card's rocket holds still.
   */
  rocketTurns?: boolean;
}) {
  const rocket = (
    <div className="absolute -bottom-[89px] -top-[144px] left-[-25px] right-[25px] md:-bottom-[170px] md:-top-[260px] md:left-0 md:right-0">
      <RocketCardStage model={rocketModelOf(project.rocket)} />
    </div>
  );
  return (
    // isolate: the card is its own stacking context, so the z-indexes below
    // order its own layers and never reach a neighbouring card.
    <article className={`glass-project group relative isolate rounded-2xl hover:z-10 ${layout}`}>
      {/* The link: an empty layer over the whole card, above its other
          layers, so the card is the target and the project's name is the
          link's name. The info box is its own positioned glass layer, so a
          link on the name inside it could only stretch over the box. A swipe
          or drag scrolls the row and fires no click, so it opens nothing.
          On keyboard focus the edge brightens as on hover
          (.glass-project:has(> a:focus-visible)) and an accent ring sits
          round the card, as on the /projects cards. */}
      {href !== undefined && (
        <Link
          href={href}
          aria-label={project.name}
          className="absolute inset-0 z-[3] rounded-2xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        />
      )}
      {/* Texture: clipped to the card's corners on its own layer, because the
          card itself must not clip the rocket's nose. */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <Image
          src={project.texture}
          alt=""
          fill
          // Three to a view from lg: (content − 2 × 16px gap) / 3, where the
          // content is 100vw − 128px up to its 1312px cap at 1440; two from
          // md: (content − 16px) / 2.
          sizes="(min-width: 1440px) 427px, (min-width: 1024px) calc((100vw - 160px) / 3), (min-width: 768px) calc((100vw - 144px) / 2), 210px"
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
      {rocketTurns ? (
        <RocketTurnBox className={ROCKET_BOX}>{rocket}</RocketTurnBox>
      ) : (
        <div className={ROCKET_BOX}>{rocket}</div>
      )}

      {/* Top row */}
      <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3.5 md:p-8">
        <span className="font-mono text-[9px] tracking-[0.15em] text-prt-text/70 md:text-[13px]">
          {project.num} · <Text copy={project.year} />
        </span>
        <span
          className={`rounded-full px-2 py-1 font-mono text-[9px] tracking-[0.15em] md:px-3 md:py-1.5 md:text-[11px] ${pill[project.statusTone]}`}
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
          <Text copy={project.desc} draw={withSubscriptDigits} />
        </p>
        <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white-10 pt-2.5 md:mt-4 md:gap-3 md:pt-4">
          {project.specs.map((s, i) => (
            // By place: a label being typed in the editor may be blank or repeat another.
            <div key={i}>
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
