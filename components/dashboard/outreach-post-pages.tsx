import { Pencil, Star, StarOff } from "lucide-react";
import { Latest } from "@/components/landing/latest";
import { PageSky } from "@/components/landing/page-sky";
import { OutreachListPage } from "@/components/outreach/list-page";
import type { PostFrame } from "@/components/outreach/post";
import { postCardOf } from "@/components/outreach/post-card";
import { PostPage } from "@/components/outreach/post-page";
import { featuredCard, newestFirst, slugOf, trackRecordShowing, withEdited, type FeaturedCard, type Neighbouring } from "@/lib/outreach";
import {
  featuredCardFeature,
  featuredOpen,
  listedCardFeature,
  type CardFeature,
  type EditedPost,
  type FeaturedIds,
  type FeaturedOpen,
  type FeatureIds,
} from "@/lib/outreach-featured";
import { mapUpToTwo, type OutreachContent, type OutreachDraft } from "@/lib/outreach-types";
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
 * lives; the other cards are dimmed. A featured post's card is one of the
 * list's Featured cards (issue #496), drawn from the fields with the other
 * cards as they are.
 *
 * On the list each Featured card is framed as the post cards are (issue
 * #431): it offers Unfeature and, unless its post is the one being edited,
 * opens that post's own editor; every post card offers Feature, locked while
 * two posts are featured.
 */
export function PostCardPage({
  page,
  view,
  edited: editedPost,
  featuredHere,
  shown,
  ids,
  featured,
  publishedSlug,
  onEditCard,
  onOpenFeatured,
  onMove,
}: {
  page: Exclude<PostPageId, "post">;
  view: OutreachDraft;
  edited: EditedPost;
  /** Whether the post being edited is a featured one. */
  featuredHere: boolean;
  /** What the public pages show, with the featured posts as the editor last moved them. */
  shown: OutreachContent;
  ids: FeatureIds;
  featured: FeaturedIds;
  publishedSlug: string | null;
  onEditCard: () => void;
  onOpenFeatured: (open: FeaturedOpen) => void;
  onMove: (move: CardFeature) => void;
}) {
  const chip = (move: CardFeature | null) => (move === null ? undefined : <FeatureChip move={move} onMove={onMove} />);
  // A featured post is not listed, so its card is the Featured card drawn from the fields.
  const posts = featuredHere ? [...shown.posts] : withEdited(shown.posts, publishedSlug, view);
  if (page === "list") {
    const features = mapUpToTwo(shown.featured, (post) => {
      const editing = featuredHere && slugOf(post) === publishedSlug;
      return { card: featuredCard(editing ? view : post), editing };
    });
    const editingFeature = (card: FeaturedCard) => (features as readonly { card: FeaturedCard; editing: boolean }[]).some((f) => f.card === card && f.editing);
    const cards = newestFirst(posts).map((p) => ({ post: p, card: postCardOf(p) }));
    const edited = cards.find((c) => c.post === view)?.card;
    return (
      <OutreachListPage
        features={mapUpToTwo(features, (f) => f.card)}
        cards={cards.map((c) => c.card)}
        chrome="none"
        keepInView={edited}
        featureFrame={(card, node, layout) => {
          const editing = editingFeature(card);
          const open = featuredOpen(card, editing);
          return (
            <CardInPlace
              edited={editing}
              onEdit={onEditCard}
              className={layout}
              actions={
                <>
                  {!editing && (
                    <CardChip
                      icon={<Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />}
                      label={`Edit post: ${card.title}`}
                      onClick={() => onOpenFeatured(open)}
                    >
                      Edit post
                    </CardChip>
                  )}
                  {chip(featuredCardFeature(card, editing ? editedPost : null, ids))}
                </>
              }
            >
              {node}
            </CardInPlace>
          );
        }}
        frame={(card, node, layout) => (
          <CardInPlace
            edited={card === edited}
            onEdit={onEditCard}
            className={layout}
            actions={chip(listedCardFeature(card, card === edited ? editedPost : null, ids, featured))}
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

/** A card's Featured control: Feature, off with the reason while it cannot be, or Unfeature. */
function FeatureChip({ move, onMove }: { move: CardFeature; onMove: (move: CardFeature) => void }) {
  if (move.kind === "unfeature") {
    return (
      <CardChip icon={<StarOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label={`Unfeature ${move.title}`} onClick={() => onMove(move)}>
        Unfeature
      </CardChip>
    );
  }
  return (
    <CardChip
      icon={<Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
      label={`Feature ${move.title}`}
      locked={move.kind === "locked" ? move.reason : null}
      onClick={() => onMove(move)}
    >
      Feature
    </CardChip>
  );
}
