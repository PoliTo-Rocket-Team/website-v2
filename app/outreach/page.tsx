import type { Metadata } from "next";
import { OutreachListPage } from "@/components/outreach/list-page";
import { postCardOf } from "@/components/outreach/post-card";
import { featuredCard, newestFirst, outreachCopy } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";
import { mapUpToTwo } from "@/lib/outreach-types";
import { footerProjects } from "@/lib/project-content/public";

export const metadata: Metadata = {
  title: "Outreach · PoliTo Rocket Team",
  description: outreachCopy.description,
};

// Boards 32 (desktop) and 32m (phone): the header (no figures), a Featured
// card for each featured post, none to two (issue #496), then every other
// published post as a card, read from the store (issue #287,
// lib/outreach-public.ts).
export default async function OutreachPage() {
  const content = await publishedOutreach();
  return (
    <OutreachListPage
      features={mapUpToTwo(content.featured, featuredCard)}
      cards={newestFirst(content.posts).map(postCardOf)}
      footerProjects={await footerProjects()}
    />
  );
}
