"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addOutreachTag, saveOutreachPost } from "@/app/dashboard/actions";
import { pinOutreachPost, unpinOutreachPost } from "@/app/dashboard/outreach-actions";
import type { PostFrame, PostPart } from "@/components/outreach/post";
import type { EditBlocks, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, publicVersion, statusOf, type PublishStep } from "@/lib/content/versioned";
import { slugOf, type Neighbouring } from "@/lib/outreach";
import { runPinMove, withPinned, type CardPin, type FeaturedOpen, type PinState } from "@/lib/outreach-pin";
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
import { titleOf, type IsoDate, type OutreachContent, type OutreachDraft, type OutreachTag, type PostItem } from "@/lib/outreach-types";
import { EditableBlock, EditShell } from "./edit-shell";
import { EditedPostPage, PostCardPage, type PostPageId } from "./outreach-post-pages";
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
//
// The pages themselves, drawn without the site's navbar and footer (issue
// #495), are in outreach-post-pages.tsx.

const POST_BLOCKS: EditBlocks<PostPart, PostSection> = {
  details: { name: "Title and details", section: "details" },
  cover: { name: "Cover photo", section: "photos" },
  text: { name: "Text", section: "text" },
  photos: { name: "Photos", section: "photos" },
  channels: { name: "Original posts", section: "channels" },
  gallery: { name: "Gallery", section: "gallery" },
};

const outlined: PostFrame = (part, node) => <EditableBlock id={part}>{node}</EditableBlock>;

const PAGE_TARGETS: readonly PageTarget<PostPageId>[] = [
  { id: "post", label: "Post page" },
  { id: "list", label: "Outreach list" },
  { id: "home", label: "Home" },
];

// The pinned post (issue #392) shows in the Outreach list's Featured card and
// on no home card, so its switch offers the post page and the list alone.
const PINNED_PAGE_TARGETS = PAGE_TARGETS.filter((t) => t.id !== "home");

/** What the editor opens on: a stored post, or a new one not saved yet, dated `today`. */
type Opening = { readonly item: PostItem } | { readonly item: null; readonly today: IsoDate };

export function OutreachPostEdit({
  pins,
  tags: initialTags,
  neighbours,
  published,
  ...opening
}: Opening & {
  /**
   * The post pinned to the top of /outreach (issue #392) and every published
   * post's id, so the Outreach list target pins and unpins from its cards
   * (issue #431).
   */
  pins: PinState;
  tags: readonly OutreachTag[];
  neighbours: Neighbouring;
  /** What the public pages show, for the list and home targets. */
  published: OutreachContent;
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
  // The page keeps each pin move's answer, as the Outreach list keeps its rows.
  const [pinnedId, setPinnedId] = useState(pins.pinned);
  const [pinning, startPinning] = useTransition();

  const opened = item === null ? start : editorVersion(item.version);
  const view = postViewOf(fields, opened);
  const errors = standingErrors(failed, fields);
  const live = item === null ? null : publicVersion(item.version);
  const pinned = item !== null && item.id === pinnedId;
  const shown = withPinned(published, pins.ids, pinnedId);
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

  const movePin = (pin: CardPin) => {
    if (pin.kind === "locked") {
      toast.error(pin.reason);
      return;
    }
    if (pinning) return;
    startPinning(async () => {
      const result = await runPinMove(pin, { pin: pinOutreachPost, unpin: unpinOutreachPost });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPinnedId(pin.kind === "pin" ? pin.id : null);
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
      pages={item === null ? undefined : { targets: pinned ? PINNED_PAGE_TARGETS : PAGE_TARGETS, current: page, onSelect: setPage }}
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
        <EditedPostPage post={view} neighbours={neighbours} frame={outlined} />
      ) : (
        <PostCardPage
          page={page}
          view={view}
          edited={{ id: item.id, live: live !== null }}
          pinned={pinned}
          shown={shown}
          ids={pins.ids}
          publishedSlug={live === null ? null : slugOf(live)}
          onEditCard={() => openSection("details")}
          onOpenFeatured={openFeatured}
          onPin={movePin}
        />
      )}
    </EditShell>
  );
}
