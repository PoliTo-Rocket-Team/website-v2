import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OutreachPostEdit } from "@/components/dashboard/outreach-post-edit";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { todayInRome } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";
import { footerProjects } from "@/lib/project-content/public";

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
    <Suspense fallback={<DashboardPageFallback />}>
      <NewPost />
    </Suspense>
  );
}

async function NewPost() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/outreach/new");
  if (opening.kind === "account-unresolved") return null;
  if (!canReach(opening.data.viewer, "outreach")) notFound();
  // Three independent reads, so they go out together (issue #397).
  const [tags, published, projects] = await Promise.all([opening.data.outreach.tags(), publishedOutreach(), footerProjects()]);
  if (tags === null) notFound();
  return (
    <OutreachPostEdit
      item={null}
      today={todayInRome()}
      tags={tags}
      neighbours={{}}
      published={published}
      footerProjects={projects}
    />
  );
}
