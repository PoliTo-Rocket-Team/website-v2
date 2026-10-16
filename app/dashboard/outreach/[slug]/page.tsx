import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditableBlock } from "@/components/dashboard/edit-shell";
import { OutreachPostEdit } from "@/components/dashboard/outreach-post-edit";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import type { PostFrame } from "@/components/outreach/post";
import { PostPage } from "@/components/outreach/post-page";
import { maySiteContent } from "@/lib/content/gate";
import { openDashboard } from "@/lib/dashboard/open";
import { postBySlug } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";

export const metadata: Metadata = {
  title: "Edit post · Outreach · Dashboard · PoliTo Rocket Team",
};

type Params = { params: Promise<{ slug: string }> };

// Board 74b (issue #288): an Outreach post on its real page under the edit
// shell, each part outlined as a block. The post is read as the public page
// reads it (lib/outreach-public.ts), so it shows as published and
// nothing on it can be changed yet. The site-content rule decides who opens
// it (lib/content/gate.ts); everyone else gets the dashboard's not found.
export default function OutreachPostEditPage({ params }: Params) {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LivePost params={params} />
    </Suspense>
  );
}

const outlined: PostFrame = (part, node) => <EditableBlock id={part}>{node}</EditableBlock>;

async function LivePost({ params }: Params) {
  const { slug } = await params;
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect(`/login?cb=/dashboard/outreach/${encodeURIComponent(slug)}`);
  if (opening.kind === "account-unresolved") return null;
  if (!maySiteContent(opening.data.viewer)) notFound();
  const { posts } = await publishedOutreach();
  const post = postBySlug(posts, slug);
  if (post === undefined) notFound();
  return (
    <OutreachPostEdit title={post.title} status="published">
      <PostPage post={post} posts={posts} frame={outlined} />
    </OutreachPostEdit>
  );
}
