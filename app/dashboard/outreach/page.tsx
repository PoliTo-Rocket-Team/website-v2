import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OutreachView } from "@/components/dashboard/outreach";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { editorVersion, publicVersion } from "@/lib/content/versioned";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { slugOf } from "@/lib/outreach";
import { newestRowsFirst, outreachRow } from "@/lib/outreach-list";

export const metadata: Metadata = {
  title: "Outreach · Dashboard · PoliTo Rocket Team",
};

// Board 74 (issue #289): every post, newest first, with tag and status
// filters and each row's menu, where a post is featured at the top of
// /outreach or unfeatured (issue #496). Full access and
// anyone with site-content access reach it (lib/content/gate.ts); everyone
// else gets the dashboard's not found.
export default function OutreachPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="list" />}>
      <LiveOutreach />
    </Suspense>
  );
}

async function LiveOutreach() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/outreach");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "outreach")) notFound();
  const [items, tags, featured] = await Promise.all([data.outreach.posts.list(), data.outreach.tags(), data.outreach.featured()]);
  if (items === null || tags === null) notFound();
  // A live post keeps the address the site shows it at, whatever its draft retitles it to.
  const rows = newestRowsFirst(items.map((item) => outreachRow(item, slugOf(publicVersion(item.version) ?? editorVersion(item.version)))));
  return <OutreachView rows={rows} tags={tags} featured={featured} />;
}
