"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addOutreachTag, saveOutreachPost } from "@/app/dashboard/actions";
import { EditableBlock } from "@/components/dashboard/edit-shell";
import type { PostFrame, PostPart } from "@/components/outreach/post";
import { PostPage } from "@/components/outreach/post-page";
import type { EditBlocks } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { slugOf, type Neighbouring } from "@/lib/outreach";
import { checkPostFields, firstPostError, postFieldsOf, postViewOf, standingErrors, type PostFieldErrors, type PostFields } from "@/lib/outreach-post-fields";
import type { OutreachPost, OutreachTag } from "@/lib/outreach-types";
import { EditShell } from "./edit-shell";
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

export function OutreachPostEdit({
  item: initial,
  tags: initialTags,
  neighbours,
}: {
  item: ContentItem<OutreachPost>;
  tags: readonly OutreachTag[];
  neighbours: Neighbouring;
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

  const opened = editorVersion(item.version);
  const view = postViewOf(fields, opened);
  const errors = standingErrors(failed, fields);

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
            errors={errors}
            expanded={expanded}
            onExpandedChange={setExpanded}
            scrollTo={scrollTo}
            onClose={() => setPanelOpen(false)}
          />
        )
      }
    >
      <PostPage post={view} neighbours={neighbours} frame={outlined} />
    </EditShell>
  );
}
