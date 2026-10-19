import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { ProjectsView } from "@/components/dashboard/projects";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Projects · Dashboard · PoliTo Rocket Team",
};

// Board 75 (issue #297): every stored project as its home card, in site
// order, with its status and "edited by" line; dragging a card sets the
// order Home and /projects follow. Full access and anyone with site-content
// access reach it (lib/content/gate.ts); everyone else gets the dashboard's
// not found.
export default function ProjectsPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="cards" />}>
      <LiveProjects />
    </Suspense>
  );
}

async function LiveProjects() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/projects");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "projects")) notFound();
  const board = await data.projects.board();
  if (board === null) notFound();
  return <ProjectsView items={board.items} edited={board.edited} />;
}
