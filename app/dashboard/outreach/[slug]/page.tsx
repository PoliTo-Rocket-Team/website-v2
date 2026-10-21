import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OutreachPostEdit } from "@/components/dashboard/outreach-post-edit";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { editorVersion, publicVersion } from "@/lib/content/versioned";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { neighboursOf, slugOf } from "@/lib/outreach";
import { pinStateOf } from "@/lib/outreach-pin";
import { publishedOutreach } from "@/lib/outreach-public";

export const metadata: Metadata = {
  title: "Edit post · Outreach · Dashboard · PoliTo Rocket Team",
};

type Params = { params: Promise<{ slug: string }> };

// Boards 74b to 74h (issues #288 and #290): an Outreach post on its real page
// under the edit shell, each part outlined as a block, with the Edit post
// panel beside it. The page opens on the version the editor works on (the
// draft when there is one) and redraws as they type. The address is the slug
// of that version's title, or of the published one's, so a link made before a
// draft renamed the post still opens it. The Outreach page's reach decides who
// opens it (lib/dashboard/access.ts, the site-content rule); everyone else gets
// the dashboard's not found.
export default function OutreachPostEditPage({ params }: Params) {
  return (
    <Suspense fallback={<PageSkeleton kind="editor" />}>
      <LivePost params={params} />
    </Suspense>
  );
}

async function LivePost({ params }: Params) {
  const { slug } = await params;
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect(`/login?cb=/dashboard/outreach/${encodeURIComponent(slug)}`);
  if (opening.kind === "account-unresolved") return null;
  if (!canReach(opening.data.viewer, "outreach")) notFound();
  const { outreach } = opening.data;
  // Every read here is independent of the others, so they go out together (issue #397).
  const [items, tags, pinned, content] = await Promise.all([
    outreach.posts.list(),
    outreach.tags(),
    outreach.pinned(),
    publishedOutreach(),
  ]);
  if (items === null || tags === null) notFound();
  const item =
    items.find((i) => slugOf(editorVersion(i.version)) === slug) ??
    items.find((i) => {
      const published = publicVersion(i.version);
      return published !== null && slugOf(published) === slug;
    });
  if (item === undefined) notFound();
  // The posts either side are the public page's: the published listed ones,
  // so the pinned post (issue #392) has none. The published content also
  // fills the page switch's list and home pages.
  const published = publicVersion(item.version);
  const neighbours = published === null ? {} : neighboursOf(content.posts, published);
  return (
    <OutreachPostEdit
      item={item}
      pins={pinStateOf(items, pinned)}
      tags={tags}
      neighbours={neighbours}
      published={content}
    />
  );
}
