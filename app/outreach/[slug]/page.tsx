import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostPage } from "@/components/outreach/post-page";
import { neighboursOf, postBySlug, postsWithPages, slugOf } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";
import { footerProjects } from "@/lib/project-content/public";

type Params = { params: Promise<{ slug: string }> };

// Every published post's page is built ahead, the featured ones' included
// (issue #496); a post published later is built on its first visit. Any
// other address, a post with only a draft included, finds no post and is a
// 404.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return postsWithPages(await publishedOutreach()).map((p) => ({ slug: slugOf(p) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = postBySlug(postsWithPages(await publishedOutreach()), (await params).slug);
  if (post === undefined) return {};
  return { title: `${post.title} · Outreach · PoliTo Rocket Team`, description: post.lead };
}

// Boards 33 (desktop) and 33m (phone): one published outreach post, read
// from the store (issue #287, lib/outreach-public.ts) and drawn by the
// shared post page (components/outreach/post-page.tsx). The older and newer
// posts are the listed ones, so a featured post's page has none.
export default async function OutreachPostPage({ params }: Params) {
  const content = await publishedOutreach();
  const post = postBySlug(postsWithPages(content), (await params).slug);
  if (post === undefined) notFound();
  return <PostPage post={post} neighbours={neighboursOf(content.posts, post)} footerProjects={await footerProjects()} />;
}
