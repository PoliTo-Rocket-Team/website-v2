"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addOutreachTag, saveOutreachPost } from "@/app/dashboard/actions";
import { Latest } from "@/components/landing/latest";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { OutreachListPage } from "@/components/outreach/list-page";
import type { PostFrame, PostPart } from "@/components/outreach/post";
import { postCardOf } from "@/components/outreach/post-card";
import { PostPage } from "@/components/outreach/post-page";
import type { EditBlocks, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, publicVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { newestFirst, outreachStats, postYears, slugOf, trackRecordShowing, withEdited, type Neighbouring } from "@/lib/outreach";
import { checkPostFields, firstPostError, postFieldsOf, postViewOf, standingErrors, type PostFieldErrors, type PostFields } from "@/lib/outreach-post-fields";
import type { OutreachContent, OutreachPost, OutreachTag, PostView } from "@/lib/outreach-types";
import { CardInPlace, EditableBlock, EditShell } from "./edit-shell";
import { OutreachPostPanel, SECTION_OF, type PostSection } from "./outreach-post-panel";

// An Outreach post under the edit shell (boards 74b to 74h, issues #288 and
// #290). The blocks are the post page's parts, each opening its section of
// the Edit post panel: the cover photo and the photo grid both open Photos.
// The page is drawn from the panel's fields, so it changes as the editor
// types; Save draft and Publish on the bar send the fields to the outreach
// editor, which checks them again. Save draft leaves the published post live.

const POST_BLOCKS: EditBlocks<PostPart, PostSection> = {
  details: { name: "Title and details", section: "details" },
  cover: { name: "Cover photo", section: "photos" },
  text: { name: "Text", section: "text" },
  photos: { name: "Photos", section: "photos" },
  channels: { name: "Original posts", section: "channels" },
};

const outlined: PostFrame = (part, node) => <EditableBlock id={part}>{node}</EditableBlock>;

// The page switch (issue #294, the board 75d pattern): the post's own page,
// then the two pages its card shows on, each with the card drawn from the
// fields being edited, in place among the published posts.
type PostPageId = "post" | "list" | "home";

const PAGE_TARGETS: readonly PageTarget<PostPageId>[] = [
  { id: "post", label: "Post page" },
  { id: "list", label: "Outreach list" },
  { id: "home", label: "Home" },
];

export function OutreachPostEdit({
  item: initial,
  tags: initialTags,
  neighbours,
  published,
}: {
  item: ContentItem<OutreachPost>;
  tags: readonly OutreachTag[];
  neighbours: Neighbouring;
  /** What the public pages show, for the list and home targets. */
  published: OutreachContent;
}) {
  const router = useRouter();
  const [item, setItem] = useState(initial);
  const [tags, setTags] = useState(initialTags);
  const [fields, setFields] = useState<PostFields>(() => postFieldsOf(editorVersion(initial.version)));
  // A save hands the panel the stored fields; it starts afresh on them.
  const [revision, setRevision] = useState(0);
  // The last failed check and the fields it judged; an edited field drops its error.
  const [failed, setFailed] = useState<{ fields: PostFields; errors: PostFieldErrors } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState<PostSection[]>([]);
  const [scrollTo, setScrollTo] = useState<{ section: PostSection } | null>(null);
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState<PostPageId>("post");

  const opened = editorVersion(item.version);
  const view = postViewOf(fields, opened);
  const errors = standingErrors(failed, fields);
  const live = publicVersion(item.version);

  const openSection = useCallback((section: PostSection) => {
    setPanelOpen(true);
    setExpanded([section]);
    setScrollTo({ section });
  }, []);

  const save = (step: PublishStep) => {
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
    setFailed(null);
    startTransition(async () => {
      const result = await saveOutreachPost(item.id, step, fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const saved = editorVersion(result.value.version);
      setItem(result.value);
      setFields(postFieldsOf(saved));
      setRevision((r) => r + 1);
      toast.success(step === "publish" ? "The post is published." : "Draft saved. The published post stays live.");
      if (slugOf(saved) !== slugOf(opened)) router.replace(`/dashboard/outreach/${slugOf(saved)}`);
    });
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
      item={opened.title}
      status={statusOf(item.version)}
      saved={panelOpen ? "Changes show on the page as you type" : undefined}
      onSaveDraft={pending ? null : () => save("save-draft")}
      onPublish={pending ? null : () => save("publish")}
      pages={{ targets: PAGE_TARGETS, current: page, onSelect: setPage }}
      blocks={POST_BLOCKS}
      onEdit={openSection}
      panel={
        panelOpen && (
          <OutreachPostPanel
            key={revision}
            fields={fields}
            onChange={setFields}
            tags={tags}
            onAddTag={addTag}
            photos={opened.photos}
            errors={errors}
            expanded={expanded}
            onExpandedChange={setExpanded}
            scrollTo={scrollTo}
            onClose={() => setPanelOpen(false)}
          />
        )
      }
    >
      {page === "post" ? (
        <PostPage post={view} neighbours={neighbours} frame={outlined} />
      ) : (
        <CardPage
          page={page}
          view={view}
          published={published}
          publishedSlug={live === null ? null : slugOf(live)}
          onEditCard={() => openSection("details")}
        />
      )}
    </EditShell>
  );
}

/**
 * The Outreach list or the home page, with the post's card in place, outlined
 * with an Edit card chip that opens Title and details, where the card summary
 * lives; the other cards are dimmed.
 */
function CardPage({
  page,
  view,
  published,
  publishedSlug,
  onEditCard,
}: {
  page: Exclude<PostPageId, "post">;
  view: PostView;
  published: OutreachContent;
  publishedSlug: string | null;
  onEditCard: () => void;
}) {
  const posts = withEdited(published.posts, publishedSlug, view);
  if (page === "list") {
    const cards = newestFirst(posts).map((p) => ({ post: p, card: postCardOf(p) }));
    const edited = cards.find((c) => c.post === view)?.card;
    return (
      <OutreachListPage
        stats={outreachStats(published)}
        feature={published.feature}
        cards={cards.map((c) => c.card)}
        years={postYears(posts)}
        keepInView={edited}
        frame={(card, node, layout) => (
          <CardInPlace edited={card === edited} onEdit={onEditCard} className={layout}>
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
          tags={published.tags}
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
