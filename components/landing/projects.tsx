import { homeCardOf } from "@/lib/project-content/record";
import { publishedProjects } from "@/lib/project-content/public";
import { ProjectsSection } from "./projects-section";

// Board 21, projects: the published projects in site order (issue #295), each
// card's copy its project's stored record's home card. The section itself is
// projects-section.tsx, which the edit shell's page switch draws too.

export async function Projects() {
  const cards = (await publishedProjects()).map(homeCardOf);
  return <ProjectsSection cards={cards} />;
}
