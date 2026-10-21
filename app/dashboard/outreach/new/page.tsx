import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OutreachPostEdit } from "@/components/dashboard/outreach-post-edit";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { todayInRome } from "@/lib/outreach";
import { pinStateOf } from "@/lib/outreach-pin";
import { publishedOutreach } from "@/lib/outreach-public";

export const metadata: Metadata = {
  title: "New post · Outreach · Dashboard · PoliTo Rocket Team",
};

// Board 74f (issue #292): New post on the Outreach list opens an empty post
// on the post page under the edit shell, dated today, with "Start here" on
// Title and details. Nothing is stored until Save draft or Publish; the
// first save gives the post its address, and the editor moves there
// (/dashboard/outreach/<slug>). This page's own address is kept from every
// post's (`NEW_POST_ADDRESS` in lib/outreach-editor.ts). The Outreach page's
// reach decides who opens it, as for every post.
export default function NewOutreachPostPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="editor" />}>
      <NewPost />
    </Suspense>
  );
}

async function NewPost() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/outreach/new");
  if (opening.kind === "account-unresolved") return null;
  if (!canReach(opening.data.viewer, "outreach")) notFound();
  // Independent reads, so they go out together (issue #397). The posts and
  // the pin let the list target pin from its cards once the post is saved
  // (issue #431).
  const { outreach } = opening.data;
  const [items, tags, pinned, published] = await Promise.all([
    outreach.posts.list(),
    outreach.tags(),
    outreach.pinned(),
    publishedOutreach(),
  ]);
  if (items === null || tags === null) notFound();
  return (
    <OutreachPostEdit
      item={null}
      pins={pinStateOf(items, pinned)}
      today={todayInRome()}
      tags={tags}
      neighbours={{}}
      published={published}
    />
  );
}
