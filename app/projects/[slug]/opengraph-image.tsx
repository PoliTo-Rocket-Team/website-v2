import { notFound } from "next/navigation";
import { SHARE_IMAGE_ALT, SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shareImage } from "@/components/share-image/share-image";
import { publishedProjects } from "@/lib/project-content/public";
import { publishedPageOf } from "@/lib/project-content/record";
import { projectShareCard } from "@/lib/share-image";

type Params = { params: Promise<{ slug: string }> };

// A project page's share image (board 90, IWf1F, issue #454), read off the
// published projects as the page is, so every project has one.

export const alt = SHARE_IMAGE_ALT;
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return (await publishedProjects()).map((r) => ({ slug: r.slug }));
}

export default async function Image({ params }: Params) {
  const found = publishedPageOf(await publishedProjects(), (await params).slug);
  if (found === null) notFound();
  return shareImage(projectShareCard(found.record, found.position));
}
