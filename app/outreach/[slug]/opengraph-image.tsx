import { notFound } from "next/navigation";
import { SHARE_IMAGE_ALT, SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shareImage } from "@/components/share-image/share-image";
import { postBySlug, postsWithPages, slugOf } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";
import { postShareCard } from "@/lib/share-image";

type Params = { params: Promise<{ slug: string }> };

// An outreach post's share image (board 90, ruh9r, issue #454), read off
// the published posts as the page is, so every post with a page has one.

export const alt = SHARE_IMAGE_ALT;
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return postsWithPages(await publishedOutreach()).map((p) => ({ slug: slugOf(p) }));
}

export default async function Image({ params }: Params) {
  const post = postBySlug(postsWithPages(await publishedOutreach()), (await params).slug);
  if (post === undefined) notFound();
  return shareImage(postShareCard(post));
}
