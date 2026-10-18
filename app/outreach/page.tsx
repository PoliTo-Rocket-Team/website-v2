import type { Metadata } from "next";
import { OutreachListPage } from "@/components/outreach/list-page";
import { postCardOf } from "@/components/outreach/post-card";
import { newestFirst, outreachCopy, outreachStats, postYears } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";
import { footerProjects } from "@/lib/project-content/public";

export const metadata: Metadata = {
  title: "Outreach · PoliTo Rocket Team",
  description: outreachCopy.description,
};

// Boards 32 (desktop) and 32m (phone): the header and its figures, the summit
// we started, then every published post as a card, read from the store
// (issue #287, lib/outreach-public.ts).
export default async function OutreachPage() {
  const content = await publishedOutreach();
  return (
    <OutreachListPage
      stats={outreachStats(content)}
      feature={content.feature}
      cards={newestFirst(content.posts).map(postCardOf)}
      years={postYears(content.posts)}
      footerProjects={await footerProjects()}
    />
  );
}
