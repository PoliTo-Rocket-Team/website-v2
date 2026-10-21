"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { addOutreachTag, saveOutreachPost } from "@/app/dashboard/actions";
import { featureOutreachPost, unfeatureOutreachPost } from "@/app/dashboard/outreach-actions";
import { Latest } from "@/components/landing/latest";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { OutreachListPage } from "@/components/outreach/list-page";
import type { PostFrame, PostPart } from "@/components/outreach/post";
import { postCardOf } from "@/components/outreach/post-card";
import { PostPage } from "@/components/outreach/post-page";
import type { EditBlocks, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, publicVersion, statusOf, type PublishStep } from "@/lib/content/versioned";
import type { FooterProject } from "@/lib/landing-links";
import { featuredCard, newestFirst, outreachStats, slugOf, trackRecordShowing, withEdited, type FeaturedCard, type Neighbouring } from "@/lib/outreach";
import {
  featuredAfter,
  featuredCardFeature,
  featuredOpen,
  isFeatured,
  listedCardFeature,
  runFeatureMove,
  withFeatured,
  type CardFeature,
  type EditedPost,
  type FeaturedIds,
  type FeaturedOpen,
  type FeatureIds,
  type FeatureState,
} from "@/lib/outreach-featured";
import {
  blankPost,
  blankPostFields,
  checkPostFields,
  firstPostError,
  postFieldsOf,
  postViewOf,
  publishChecklist,
  standingErrors,
  type PostFieldErrors,
  type PostFields,
} from "@/lib/outreach-post-fields";
import { mapUpToTwo, titleOf, type IsoDate, type OutreachContent, type OutreachDraft, type OutreachTag, type PostItem } from "@/lib/outreach-types";
import { CardChip, CardInPlace, EditableBlock, EditShell } from "./edit-shell";
import { OutreachPostPanel, SECTION_OF, type PostSection } from "./outreach-post-panel";

// An Outreach post under the edit shell (boards 74b to 74h, issues #288 and
// #290). The blocks are the post page's parts, each opening its section of
// the Edit post panel: the cover photo and the photo grid both open Photos.
// The page is drawn from the panel's fields, so it changes as the editor
// types; Save draft and Publish on the bar send the fields to the outreach
// editor, which checks them again. Save draft leaves the published post live.
//
// New post (board 74f, issue #292) opens the same editor on an empty post
// dated today, with "Start here" on Title and details. Until the post is
// first published, Save draft keeps it as it is, blanks and all; Publish
// waits on the checklist under it. The first save gives the post its
// address, and the editor moves there.

const POST_BLOCKS: EditBlocks<PostPart, PostSection> = {
  details: { name: "Title and details", section: "details" },
  cover: { name: "Cover photo", section: "photos" },
  text: { name: "Text", section: "text" },
  photos: { name: "Photos", section: "photos" },
  channels: { name: "Original posts", section: "channels" },
  gallery: { name: "Gallery", section: "gallery" },
};

const outlined: PostFrame = (part, node) => <EditableBlock id={part}>{node}</EditableBlock>;

// The page switch (issue #294, the board 75d pattern): the post's own page,
// then the two pages its card shows on, each with the card drawn from the
// fields being edited, in place among the published posts. A new post has
// none until it is saved (board 74f).
type PostPageId = "post" | "list" | "home";

const PAGE_TARGETS: readonly PageTarget<PostPageId>[] = [
  { id: "post", label: "Post page" },
  { id: "list", label: "Outreach list" },
  { id: "home", label: "Home" },
];

// A featured post (issue #496) shows in a Featured card on the Outreach list
// and on no home card, so its switch offers the post page and the list alone.
const FEATURED_PAGE_TARGETS = PAGE_TARGETS.filter((t) => t.id !== "home");

/** What the editor opens on: a stored post, or a new one not saved yet, dated `today`. */
type Opening = { readonly item: PostItem } | { readonly item: null; readonly today: IsoDate };

export function OutreachPostEdit({
  features,
  tags: initialTags,
  neighbours,
  published,
  footerProjects,
  ...opening
}: Opening & {
  /**
   * The posts featured at the top of /outreach (issue #496) and every
   * published post's id, so the Outreach list target features and unfeatures
   * from its cards (issue #431).
   */
  features: FeatureState;
  tags: readonly OutreachTag[];
  neighbours: Neighbouring;
  /** What the public pages show, for the list and home targets. */
  published: OutreachContent;
  /** The published projects the page's footer lists (issue #378). */
  footerProjects: readonly FooterProject[];
}) {
  const router = useRouter();
  // What the page opened on; for a new post, the blank dated the day it opened.
  const [start] = useState<OutreachDraft>(() => (opening.item === null ? blankPost(opening.today) : editorVersion(opening.item.version)));
  const [item, setItem] = useState<PostItem | null>(opening.item);
  const [tags, setTags] = useState(initialTags);
  const [fields, setFields] = useState<PostFields>(() => (opening.item === null ? blankPostFields(opening.today) : postFieldsOf(start)));
  // A save hands the panel the stored fields; it starts afresh on them.
  const [revision, setRevision] = useState(0);
  // The last failed check and the fields it judged; an edited field drops its error.
  const [failed, setFailed] = useState<{ fields: PostFields; errors: PostFieldErrors } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState<PostSection[]>([]);
  const [scrollTo, setScrollTo] = useState<{ section: PostSection } | null>(null);
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState<PostPageId>("post");
  // The page keeps each feature move's answer, as the Outreach list keeps its rows.
  const [featuredIds, setFeaturedIds] = useState<FeaturedIds>(features.featured);
  const [moving, startMoving] = useTransition();

  const opened = item === null ? start : editorVersion(item.version);
  const view = postViewOf(fields, opened);
  const errors = standingErrors(failed, fields);
  const live = item === null ? null : publicVersion(item.version);
  const featuredHere = item !== null && isFeatured(featuredIds, item.id);
  const shown = withFeatured(published, features.ids, featuredIds);
  // A post never published may be saved as a draft as it is; a live post's draft must be whole.
  const unfinishedDraft = live === null;

  const openSection = useCallback((section: PostSection) => {
    setPanelOpen(true);
    setExpanded([section]);
    setScrollTo({ section });
  }, []);

  const save = (step: PublishStep) => {
    if (step === "publish" || !unfinishedDraft) {
      const check = checkPostFields(fields, opened, tags);
      if (!check.ok) {
        setFailed({ fields, errors: check.errors });
        const first = firstPostError(check.errors);
        if (first !== undefined) {
          openSection(SECTION_OF[first.field]);
          toast.error(first.error);
        }
        return;
      }
    }
    setFailed(null);
    startTransition(async () => {
      const result = await saveOutreachPost(item?.id ?? null, step, fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const saved = editorVersion(result.value.version);
      setItem(result.value);
      setFields(postFieldsOf(saved));
      setRevision((r) => r + 1);
      toast.success(step === "publish" ? "The post is published." : live === null ? "Draft saved." : "Draft saved. The published post stays live.");
      if (item === null || slugOf(saved) !== slugOf(opened)) router.replace(`/dashboard/outreach/${slugOf(saved)}`);
    });
  };

  const moveFeature = (move: CardFeature) => {
    if (move.kind === "locked") {
      toast.error(move.reason);
      return;
    }
    if (moving) return;
    startMoving(async () => {
      const result = await runFeatureMove(move, { feature: featureOutreachPost, unfeature: unfeatureOutreachPost });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFeaturedIds((ids) => featuredAfter(ids, move));
      toast.success(result.value);
    });
  };

  const openFeatured = (open: FeaturedOpen) => {
    if (open.kind === "details") openSection("details");
    else router.push(open.href);
  };

  const addTag = async (name: string) => {
    const result = await addOutreachTag(name);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setTags((list) => [...list, result.value]);
    return true;
  };

  return (
    <EditShell
      section={{ label: "Outreach", href: "/dashboard/outreach" }}
      heading={item === null ? "New post" : `Editing ${titleOf(opened)}`}
      status={item === null ? "draft" : statusOf(item.version)}
      saved={item === null ? "Not saved yet" : panelOpen ? "Changes show on the page as you type" : undefined}
      onSaveDraft={pending ? null : () => save("save-draft")}
      onPublish={pending ? null : () => save("publish")}
      publishChecklist={publishChecklist(fields)}
      pages={item === null ? undefined : { targets: featuredHere ? FEATURED_PAGE_TARGETS : PAGE_TARGETS, current: page, onSelect: setPage }}
      blocks={POST_BLOCKS}
      startHere={item === null && !panelOpen ? "details" : undefined}
      onEdit={openSection}
      panel={
        panelOpen && (
          <OutreachPostPanel
            key={revision}
            fields={fields}
            onChange={setFields}
            tags={tags}
            onAddTag={addTag}
            errors={errors}
            expanded={expanded}
            onExpandedChange={setExpanded}
            scrollTo={scrollTo}
            onClose={() => setPanelOpen(false)}
          />
        )
      }
    >
      {page === "post" || item === null ? (
        <PostPage post={view} neighbours={neighbours} footerProjects={footerProjects} frame={outlined} hints />
      ) : (
        <CardPage
          page={page}
          view={view}
          edited={{ id: item.id, live: live !== null }}
          featuredHere={featuredHere}
          shown={shown}
          ids={features.ids}
          featured={featuredIds}
          footerProjects={footerProjects}
          publishedSlug={live === null ? null : slugOf(live)}
          onEditCard={() => openSection("details")}
          onOpenFeatured={openFeatured}
          onMove={moveFeature}
        />
      )}
    </EditShell>
  );
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
function CardPage({
  page,
  view,
  edited: editedPost,
  featuredHere,
  shown,
  ids,
  featured,
  footerProjects,
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
  footerProjects: readonly FooterProject[];
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
        stats={outreachStats(shown)}
        features={mapUpToTwo(features, (f) => f.card)}
        cards={cards.map((c) => c.card)}
        footerProjects={footerProjects}
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
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky className="pt-16 md:pt-[72px]">
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
