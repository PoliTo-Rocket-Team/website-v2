import type { Metadata } from "next";
import { ProjectPage, projectPageMetadata } from "@/components/project-page/project-page";
import { publishedProjects } from "@/lib/project-content/public";

type Params = { params: Promise<{ slug: string }> };

// One route for every project page (issue #301): Cavour, VES, Efesto and any
// project published later keep /projects/<slug>. Every published project's
// page is built ahead; one published later is built on its first visit. Any
// other address, a project with only a draft included, is not found.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return (await publishedProjects()).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return projectPageMetadata((await params).slug);
}

export default async function Page({ params }: Params) {
  return <ProjectPage slug={(await params).slug} />;
}
