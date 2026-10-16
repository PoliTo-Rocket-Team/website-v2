import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { Neighbours, PostBody, PostHeader } from "@/components/outreach/post";
import { neighboursOf, postBySlug, slugOf } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";

type Params = { params: Promise<{ slug: string }> };

// Every published post's page is built ahead; a post published later is
// built on its first visit. Any other address, a post with only a draft
// included, finds no post and is a 404.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return (await publishedOutreach()).posts.map((p) => ({ slug: slugOf(p) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = postBySlug((await publishedOutreach()).posts, (await params).slug);
  if (post === undefined) return {};
  return { title: `${post.title} · Outreach · PoliTo Rocket Team`, description: post.lead };
}

// Boards 33 (desktop) and 33m (phone): one published outreach post, read
// from the store (issue #287, lib/outreach-public.ts). No apply band on this
// page (issue #110).
export default async function OutreachPostPage({ params }: Params) {
  const { posts } = await publishedOutreach();
  const post = postBySlug(posts, (await params).slug);
  if (post === undefined) notFound();
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="px-5 pb-section pt-16 md:px-16 md:pt-[72px]">
          <div className="pt-8 md:pt-16">
            <PostHeader post={post} />
            <PostBody post={post} />
            <Neighbours {...neighboursOf(posts, post)} />
          </div>
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
