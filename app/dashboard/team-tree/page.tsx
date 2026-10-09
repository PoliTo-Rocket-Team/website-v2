import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TeamTreeView } from "@/components/dashboard/team-tree";
import { EXPANDED_VIEW } from "@/lib/dashboard/team";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Team tree · Dashboard · PoliTo Rocket Team",
};

type Search = Promise<{ view?: string | string[] }>;

// Boards 54 (folded on the viewer's path) and 54b (every department open, at ?view=all).
export default function TeamTreePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={null}>
      <LiveTeamTree searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveTeamTree({ searchParams }: { searchParams: Search }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/team-tree");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "team-tree")) notFound();
  const [tree, { view }] = await Promise.all([data.teamTree(), searchParams]);
  return <TeamTreeView tree={tree} startExpanded={view === EXPANDED_VIEW} />;
}
