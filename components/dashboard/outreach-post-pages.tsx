import { Pencil, Pin, PinOff } from "lucide-react";
import { Latest } from "@/components/landing/latest";
import { PageSky } from "@/components/landing/page-sky";
import { OutreachListPage } from "@/components/outreach/list-page";
import type { PostFrame } from "@/components/outreach/post";
import { postCardOf } from "@/components/outreach/post-card";
import { PostPage } from "@/components/outreach/post-page";
import { featuredCard, newestFirst, outreachStats, trackRecordShowing, withEdited, type Neighbouring } from "@/lib/outreach";
import { featuredCardPin, featuredOpen, listedCardPin, type CardPin, type EditedPost, type FeaturedOpen, type PinIds } from "@/lib/outreach-pin";
import type { OutreachContent, OutreachDraft } from "@/lib/outreach-types";
import { CardChip, CardInPlace } from "./edit-shell";

// The pages the Outreach post editor draws under the edit shell
// (outreach-post-edit.tsx): the post's own page, and the Outreach list and
// home page with its card in place. Each is drawn without the site's navbar
// and footer (issue #495): they are not the editor's to change.

// The page switch (issue #294, the board 75d pattern): the post's own page,
// then the two pages its card shows on, each with the card drawn from the
// fields being edited, in place among the published posts. A new post has
// none until it is saved (board 74f).
export type PostPageId = "post" | "list" | "home";

/** The post's own page, its parts outlined through `frame`, a blank part saying what goes there (board 74f). */
export function EditedPostPage({ post, neighbours, frame }: { post: OutreachDraft; neighbours: Neighbouring; frame: PostFrame }) {
  return <PostPage post={post} neighbours={neighbours} chrome="none" frame={frame} hints />;
}

/**
 * The Outreach list or the home page, with the post's card in place, outlined
 * with an Edit card chip that opens Title and details, where the card summary
 * lives; the other cards are dimmed. The pinned post's card is the list's
 * Featured card (issue #392), drawn from the fields with the cards below it
 * as they are.
 *
 * On the list the Featured card is framed as the post cards are (issue #431):
 * it offers Unpin, and, while another post is being edited, opens the pinned
 * post's own editor; every post card offers Pin to top.
 */
export function PostCardPage({
  page,
  view,
  edited: editedPost,
  pinned,
  shown,
  ids,
  publishedSlug,
  onEditCard,
  onOpenFeatured,
  onPin,
}: {
  page: Exclude<PostPageId, "post">;
  view: OutreachDraft;
  edited: EditedPost;
  /** Whether the post being edited is the pinned one. */
  pinned: boolean;
  /** What the public pages show, with the pin as the editor last moved it. */
  shown: OutreachContent;
  ids: PinIds;
  publishedSlug: string | null;
  onEditCard: () => void;
  onOpenFeatured: (open: FeaturedOpen) => void;
  onPin: (pin: CardPin) => void;
}) {
  const pinChip = (pin: CardPin | null) => (pin === null ? undefined : <PinChip pin={pin} onMove={onPin} />);
  if (pinned) {
    const feature = featuredCard(shown.feature, view);
    return (
      <OutreachListPage
        stats={outreachStats(shown)}
        feature={feature}
        cards={newestFirst(shown.posts).map(postCardOf)}
        chrome="none"
        featureFrame={(node, layout) => (
          <CardInPlace edited onEdit={onEditCard} className={layout} actions={pinChip(featuredCardPin(feature))}>
            {node}
          </CardInPlace>
        )}
        frame={(card, node, layout) => (
          <CardInPlace edited={false} onEdit={onEditCard} className={layout} actions={pinChip(listedCardPin(card, null, ids))}>
            {node}
          </CardInPlace>
        )}
      />
    );
  }
  const posts = withEdited(shown.posts, publishedSlug, view);
  if (page === "list") {
    const cards = newestFirst(posts).map((p) => ({ post: p, card: postCardOf(p) }));
    const edited = cards.find((c) => c.post === view)?.card;
    const feature = featuredCard(shown.feature, shown.pinned);
    const open = featuredOpen(feature, false);
    return (
      <OutreachListPage
        stats={outreachStats(shown)}
        feature={feature}
        cards={cards.map((c) => c.card)}
        chrome="none"
        keepInView={edited}
        featureFrame={(node, layout) => (
          <CardInPlace
            edited={false}
            onEdit={onEditCard}
            className={layout}
            actions={
              open === null ? undefined : (
                <>
                  <CardChip
                    icon={<Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />}
                    label={`Edit post: ${feature.title}`}
                    onClick={() => onOpenFeatured(open)}
                  >
                    Edit post
                  </CardChip>
                  {pinChip(featuredCardPin(feature))}
                </>
              )
            }
          >
            {node}
          </CardInPlace>
        )}
        frame={(card, node, layout) => (
          <CardInPlace
            edited={card === edited}
            onEdit={onEditCard}
            className={layout}
            actions={pinChip(listedCardPin(card, card === edited ? editedPost : null, ids))}
          >
            {node}
          </CardInPlace>
        )}
      />
    );
  }
  // Home's Track record alone, on the page sky, with no navbar above it.
  return (
    <div className="relative bg-ground">
      <PageSky>
        <Latest
          cards={trackRecordShowing(posts, view)}
          tags={shown.tags}
          edited={view}
          frame={(post, node, layout) => (
            <CardInPlace edited={post === view} onEdit={onEditCard} className={layout}>
              {node}
            </CardInPlace>
          )}
        />
      </PageSky>
    </div>
  );
}

/** A card's pin control: Pin to top, off with the reason while the post is not published, or Unpin. */
function PinChip({ pin, onMove }: { pin: CardPin; onMove: (pin: CardPin) => void }) {
  if (pin.kind === "unpin") {
    return (
      <CardChip icon={<PinOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label={`Unpin ${pin.title}`} onClick={() => onMove(pin)}>
        Unpin
      </CardChip>
    );
  }
  return (
    <CardChip
      icon={<Pin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
      label={`Pin to top: ${pin.title}`}
      locked={pin.kind === "locked" ? pin.reason : null}
      onClick={() => onMove(pin)}
    >
      Pin to top
    </CardChip>
  );
}
