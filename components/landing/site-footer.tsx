import { footerProjects } from "@/lib/project-content/public";
import { LandingFooter } from "./footer";

// The footer as a server page draws it: its PROJECTS column read off the
// published projects (issue #378), through the same cached read as /projects.
export async function SiteFooter({ inSky = false }: { inSky?: boolean }) {
  return <LandingFooter inSky={inSky} projects={await footerProjects()} />;
}
