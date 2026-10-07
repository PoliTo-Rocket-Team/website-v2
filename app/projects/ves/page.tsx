import type { Metadata } from "next";
import { ProjectPage, projectPageMetadata } from "@/components/project-page/project-page";

export const metadata: Metadata = projectPageMetadata("ves");

export default function Page() {
  return <ProjectPage slug="ves" />;
}
