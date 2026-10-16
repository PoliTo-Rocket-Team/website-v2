import type { Metadata } from "next";
import { ProjectsListPage } from "@/components/projects/list-page";
import { listingOf } from "@/lib/project-content/record";
import { publishedProjects } from "@/lib/project-content/public";

export const metadata: Metadata = {
  title: "Projects · PoliTo Rocket Team",
  description:
    "Cavour, VES and Efesto: the rockets and the liquid engine designed, built and flown by students of Politecnico di Torino.",
};

// Approved /projects page per Pencil boards 22 (desktop) and 22m (phone, 390):
// the published projects in site order (issue #295), drawn by
// components/projects/list-page.tsx, which the edit shell's page switch
// draws too (issue #300).
export default async function ProjectsPage() {
  return <ProjectsListPage projects={(await publishedProjects()).map(listingOf)} />;
}
