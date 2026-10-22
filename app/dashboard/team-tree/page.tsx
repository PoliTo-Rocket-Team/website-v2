import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { TeamTreeView } from "@/components/dashboard/team-tree";
import { TeamTreeEditView } from "@/components/dashboard/team-tree-edit";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { showsTreeEdit } from "@/lib/dashboard/team-structure";

export const metadata: Metadata = {
  title: "Team tree · Dashboard · PoliTo Rocket Team",
};

type Search = Promise<{ edit?: string | string[] }>;

const EDIT_HREF = "/dashboard/team-tree?edit=1";

// Board 54c (the family tree on a pan and zoom canvas) and, on phones, 54c-m.
// With `?edit=1` it is the edit view (boards 77b and 66t-b, issue #251), for
// a viewer who edits structure; anyone else gets the tree.
export default function TeamTreePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton kind="tree" />}>
      <LiveTeamTree searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveTeamTree({ searchParams }: { searchParams: Search }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/team-tree");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "team-tree")) notFound();
  const edits = showsTreeEdit(data.viewer);
  if (edits && (await searchParams).edit !== undefined) {
    const structure = await data.teamStructure();
    if (structure !== null) return <TeamTreeEditView structure={structure} />;
  }
  return <TeamTreeView tree={await data.teamTree()} editHref={edits ? EDIT_HREF : null} />;
}
