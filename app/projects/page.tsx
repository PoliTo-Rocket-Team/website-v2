import type { Metadata } from "next";
import { ProjectsListPage } from "@/components/projects/list-page";
import { listingsNewestFirst } from "@/lib/project-content/record";
import { footerProjects, publishedProjects } from "@/lib/project-content/public";

export const metadata: Metadata = {
  title: "Projects · PoliTo Rocket Team",
  description:
    "Cavour, VES and Efesto: the rockets and the liquid engine designed, built and flown by students of Politecnico di Torino.",
};

// Approved /projects page per Pencil boards 22 (desktop) and 22m (phone, 390):
// the published projects (issue #295), newest first as the home row lists
// them (issue #381), drawn by components/projects/list-page.tsx, which the
// edit shell's page switch draws too (issue #300).
export default async function ProjectsPage() {
  return <ProjectsListPage projects={listingsNewestFirst(await publishedProjects())} footerProjects={await footerProjects()} />;
}
