import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostPage } from "@/components/outreach/post-page";
import { postBySlug, postsNewestFirst, slugOf } from "@/lib/outreach";

type Params = { params: Promise<{ slug: string }> };

// Every post page is built ahead from the record's posts; any other address
// finds no post and is a 404.
export function generateStaticParams(): { slug: string }[] {
  return postsNewestFirst.map((p) => ({ slug: slugOf(p) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (post === undefined) return {};
  return { title: `${post.title} · Outreach · PoliTo Rocket Team`, description: post.lead };
}

// Boards 33 (desktop) and 33m (phone): one outreach post from the record
// (lib/outreach.ts).
export default async function OutreachPostPage({ params }: Params) {
  const post = postBySlug((await params).slug);
  if (post === undefined) notFound();
  return <PostPage post={post} />;
}
