"use client";

import type { ReactNode } from "react";
import type { PostPart } from "@/components/outreach/post";
import type { EditBlocks } from "@/lib/content/edit-shell";
import type { ContentStatus } from "@/lib/content/versioned";
import { EditShell } from "./edit-shell";

// An Outreach post under the edit shell (board 74b, issue #288). The blocks
// are the post page's parts, each opening its section of the Edit post panel
// (board 74h): the cover photo and the photo grid both open Photos.

type PostSection = "details" | "text" | "photos" | "channels";

const POST_BLOCKS: EditBlocks<PostPart, PostSection> = {
  details: { name: "Title and details", section: "details" },
  cover: { name: "Cover photo", section: "photos" },
  text: { name: "Text", section: "text" },
  photos: { name: "Photos", section: "photos" },
  channels: { name: "Original posts", section: "channels" },
};

// The Edit post panel is the next slice (issue #290); until it lands, Edit has
// nothing to open and the post cannot be saved or published from here.
const noPanelYet = (_section: PostSection) => {};

export function OutreachPostEdit({ title, status, children }: { title: string; status: ContentStatus; children: ReactNode }) {
  return (
    <EditShell
      section={{ label: "Outreach", href: "/dashboard/outreach" }}
      item={title}
      status={status}
      onSaveDraft={null}
      onPublish={null}
      blocks={POST_BLOCKS}
      onEdit={noPanelYet}
    >
      {children}
    </EditShell>
  );
}
