import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TeamTreeView } from "@/components/dashboard/team-tree";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Team tree · Dashboard · PoliTo Rocket Team",
};

// Boards 42 (folded on the viewer's path) and 42b (every department open).
export default function TeamTreePage() {
  return (
    <Suspense fallback={null}>
      <LiveTeamTree />
    </Suspense>
  );
}

async function LiveTeamTree() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/team-tree");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "team-tree")) notFound();
  return <TeamTreeView tree={await data.teamTree()} />;
}
