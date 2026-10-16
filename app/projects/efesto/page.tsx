import type { Metadata } from "next";
import { ProjectPage, projectPageMetadata } from "@/components/project-page/project-page";

export function generateMetadata(): Promise<Metadata> {
  return projectPageMetadata("efesto");
}

export default function Page() {
  return <ProjectPage slug="efesto" />;
}
