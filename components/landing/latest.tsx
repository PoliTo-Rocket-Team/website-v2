import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { Photo } from "@/components/outreach/photo";
import { CopyText } from "@/components/project-page/parts";
import { dayMonthYear, phoneNewsCard, slugOf, type TrackRecord } from "@/lib/outreach";
import { titleOf, type OutreachDraft, type OutreachTag } from "@/lib/outreach-types";
import { RocketArrow } from "./rocket-arrow";

// Board 21, track record: the newest published Outreach posts (issue #293).
// The home page reads them through the same cached published read as
// /outreach, so a publish refreshes this section too. The newest is the
// featured card, the next three are the news cards. The cards are liquid
// glass over the page sky, with no texture of their own. Each card's title is
// its link, and the link's ::after covers the card, so the whole card opens
// the post (.glass-linked). The dashboard's edit shell draws this section
// too, with the post being edited in place (issue #294): `frame` wraps each
// card in a box laid out where the card would be, and the card fills it.

/** What a Track record card shows of a post: a published one, or the editor's view of one. */
export type TrackRecordPost = Pick<OutreachDraft, "title" | "date" | "tags" | "summary" | "photos">;

/** Wraps one card; `layout` holds the classes that place it in the section. */
export type TrackRecordFrame<P extends TrackRecordPost> = (post: P, card: ReactNode, layout: string) => ReactNode;

const cardLink =
  "after:absolute after:inset-0 after:z-[2] after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent";

// Tags pair a -soft fill with the solid text colour (design-system-manifest.md):
// the award tag takes the accent, as on the dashboard list (board 74); every
// other tag is neutral.
function TagLine({ post, awardTags }: { post: TrackRecordPost; awardTags: ReadonlySet<string> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] md:gap-x-5 md:text-[13px]">
      <ul className="flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <li
            key={tag}
            className={`rounded-full px-3.5 py-1 uppercase tracking-widest ${awardTags.has(tag) ? "bg-accent-soft text-accent" : "bg-white-10 text-prt-text"}`}
          >
            {tag}
          </li>
        ))}
      </ul>
      <time dateTime={post.date} className="tracking-wider text-prt-muted">
        {dayMonthYear(post.date)}
      </time>
    </div>
  );
}

type CardProps = { post: TrackRecordPost; awardTags: ReadonlySet<string>; layout: string };

function FeaturedCard({ post, awardTags, layout }: CardProps) {
  return (
    <article className={`glass-card glass-linked group flex-col gap-3.5 rounded-xl p-5 md:p-8 ${layout}`}>
      <div className="flex items-start justify-between gap-3">
        <TagLine post={post} awardTags={awardTags} />
        <p
          aria-hidden
          className="inline-flex shrink-0 items-center gap-3 py-0.5 text-[14px] font-medium text-accent transition-colors group-hover:text-accent-hover md:text-base"
        >
          Read the record
          {/* No room for the arrow beside the tag line on a phone. */}
          <RocketArrow className="hidden opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100 md:inline-block" />
        </p>
      </div>
      <h3 className="text-[20px] font-bold leading-[1.2] tracking-[-0.02em] md:text-[34px]">
        <Link href={`/outreach/${slugOf(post)}`} className={cardLink}>
          {titleOf(post)}
        </Link>
      </h3>
      <p className="text-[14px] leading-[22px] text-text-2 md:text-[17px] md:leading-relaxed">
        <CopyText copy={post.summary} />
      </p>
      {/* From lg the photo takes what the card has left after the text,
          so the card matches the list column. Below lg the card has no
          set height, so the photo keeps a fixed shape. The post's first
          photo is its cover and card photo. */}
      <div className="relative h-[150px] w-full overflow-hidden rounded-[6px] md:aspect-[2.2/1] md:h-auto lg:aspect-auto lg:min-h-0 lg:flex-1">
        <Photo
          photo={post.photos[0]}
          // The featured card's inner width: from lg the 1.58fr of
          // (content − 20px gap), content 100vw − 128px up to 1312px,
          // less its 2 × 44px padding; below lg the whole column.
          sizes="(min-width: 1440px) 703px, (min-width: 1024px) calc(61.2vw - 179px), (min-width: 768px) calc(100vw - 216px), calc(100vw - 80px)"
        />
      </div>
    </article>
  );
}

function NewsCard({ post, awardTags, layout }: CardProps) {
  return (
    <article className={`glass-card glass-linked flex-col justify-center gap-2.5 rounded-xl p-5 md:p-8 lg:py-0 ${layout}`}>
      <TagLine post={post} awardTags={awardTags} />
      <h3 className="text-[16px] font-semibold leading-[1.2] md:text-[21px] md:leading-snug">
        <Link href={`/outreach/${slugOf(post)}`} className={cardLink}>
          {titleOf(post)}
        </Link>
      </h3>
      <p className="text-[14px] leading-[21px] text-text-2 md:text-[17px] md:leading-relaxed">
        <CopyText copy={post.summary} />
      </p>
    </article>
  );
}

function awardTagNames(tags: readonly OutreachTag[]): ReadonlySet<string> {
  return new Set(tags.filter((t) => t.award).map((t) => t.name));
}

/** A card unframed carries its own layout; framed, the frame's box does and the card fills it. */
const FILLS_FRAME = "flex w-full";

export function Latest<P extends TrackRecordPost>({
  cards,
  tags,
  frame,
  edited,
}: {
  /** Null when no post is published: the section then shows no cards. */
  cards: TrackRecord<P> | null;
  tags: readonly OutreachTag[];
  frame?: TrackRecordFrame<P>;
  /** The post being edited, when the edit shell draws the section: a phone then shows its news card. */
  edited?: P;
}) {
  const awardTags = awardTagNames(tags);
  const onPhone = cards === null ? undefined : phoneNewsCard(cards, edited);
  const place = (post: P, layout: string, card: (layout: string) => ReactNode) =>
    frame === undefined ? card(layout) : frame(post, card(FILLS_FRAME), layout);
  return (
    // Board 24 below md: 20px sides, 56px top and bottom, 26px heading, one
    // column: the featured card (photo 150px tall) and one news card, the
    // first (in the edit shell, the edited post's). The others are
    // desktop-only.
    // Board 21 from lg: the section fits one 1440 x 900 screen below the
    // navbar, so the gaps around the cards are 40px and the cards row is
    // 560px tall.
    <section className="px-5 py-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-8">
          <div className="md:max-w-[760px]">
            <p className="font-mono text-xs tracking-[0.3em] text-accent">TRACK RECORD</p>
            <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
              <span className="md:block">We fly against the best</span> student teams on earth.
            </h2>
          </div>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-text-2 md:text-[17px]">
            Four international campaigns since 2021. Every vehicle designed, built and qualified
            in-house.
          </p>
        </div>

        {/* Grid: featured card + list. From lg the row is at least 560px and
            both columns stretch to it; it grows only if the list needs more.
            With no published post there are no cards. */}
        {cards !== null && (
          <div className="mt-6 grid gap-5 md:mt-10 lg:grid-cols-[1.58fr_1fr] lg:grid-rows-[minmax(560px,auto)]">
            {/* Featured */}
            {place(cards.featured, "flex", (layout) => (
              <FeaturedCard post={cards.featured} awardTags={awardTags} layout={layout} />
            ))}

            {/* List: on phones only one news card shows. */}
            <div className="flex flex-col gap-5 lg:gap-3">
              {cards.news.map((post, i) => (
                <Fragment key={i}>
                  {place(post, `flex-1 md:flex ${post === onPhone ? "flex" : "hidden"}`, (layout) => (
                    <NewsCard post={post} awardTags={awardTags} layout={layout} />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center md:mt-10">
          <Link
            href="/outreach"
            className="group inline-flex items-center gap-3 font-mono text-base tracking-wide text-prt-text transition-colors hover:text-accent"
          >
            All news
            <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </section>
  );
}
