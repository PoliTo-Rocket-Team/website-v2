import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { ProjectEdit } from "@/components/dashboard/project-edit";
import { editorVersion, publicVersion } from "@/lib/content/versioned";
import { openDashboard } from "@/lib/dashboard/open";
import { footerProjects } from "@/lib/project-content/public";
import { placeOf } from "@/lib/project-content/record";

export const metadata: Metadata = {
  title: "Edit project · Projects · Dashboard · PoliTo Rocket Team",
};

type Params = { params: Promise<{ slug: string }> };

// Boards 75b and 75c (issue #298): a project on its real page under the edit
// shell, its story sections outlined as blocks, with the Edit <project> panel
// beside it. The page opens on the version the editor works on (the draft
// when there is one) and redraws as they type. The address is that version's
// slug, or the published one's. The projects editor answers only the full
// admins and holders of site-content access (lib/content/gate.ts); everyone
// else gets the dashboard's not found.
export default function ProjectEditPage({ params }: Params) {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveProject params={params} />
    </Suspense>
  );
}

async function LiveProject({ params }: Params) {
  const { slug } = await params;
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect(`/login?cb=/dashboard/projects/${encodeURIComponent(slug)}`);
  if (opening.kind === "account-unresolved") return null;
  // The footer's projects need nothing of the editor's, so both are read at once (issue #397).
  const [items, projects] = await Promise.all([opening.data.projects.list(), footerProjects()]);
  if (items === null) notFound();
  const item =
    items.find((i) => editorVersion(i.version).slug === slug) ?? items.find((i) => publicVersion(i.version)?.slug === slug);
  const place = item === undefined ? null : placeOf(items, item.id);
  if (item === undefined || place === null) notFound();
  return <ProjectEdit item={item} place={place} footerProjects={projects} />;
}
