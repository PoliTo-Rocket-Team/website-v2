import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { MembersView } from "@/components/dashboard/members";
import { canReach } from "@/lib/dashboard/access";
import { mayExportMembers } from "@/lib/dashboard/members-export";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Members · Dashboard · PoliTo Rocket Team",
};

type Search = Promise<{ division?: string | string[] }>;

// Boards 46 (operations lead: the whole team), 73 to 73c (the team leader:
// the whole team with every member field, issue #252), 61e to 61h2 (division lead:
// one of their divisions, `?division=` picking which, with the people waiting
// for Confirm NDA and the member panels) and 69 to 69c (department head: every
// division of the department as a tab). It replaces the legacy members page.
export default function MembersPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton kind="list" />}>
      <LiveMembers searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveMembers({ searchParams }: { searchParams: Search }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/members");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "members")) notFound();
  const { division } = await searchParams;
  const divisionId = Number(typeof division === "string" ? division : undefined);
  const directory = await data.members(Number.isSafeInteger(divisionId) && divisionId > 0 ? divisionId : null);
  return <MembersView directory={directory} editable={data.teamWrites !== null} exportable={mayExportMembers(data.viewer)} />;
}
