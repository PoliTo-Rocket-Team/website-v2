import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { MembersView } from "@/components/dashboard/members";
import { canReach } from "@/lib/dashboard/access";
import { mayExportMembers } from "@/lib/dashboard/members-export";
import { memberIdsOf, membersModelOf } from "@/lib/dashboard/members-view";
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
  // Each member's email alias on their PRT email row: the address, or the request state while it is empty (epic #538, boards 94 to 94e; issue #563).
  // Beside it, the shared team addresses each one holds (epic #578, board 102, issue #786).
  const model = membersModelOf(directory);
  const memberIds = model === null ? [] : memberIdsOf(model);
  const [aliases, teamAddresses] = model === null ? [{}, {}] : await Promise.all([data.memberAliases(memberIds), data.memberTeamAddresses(memberIds)]);
  return (
    <MembersView
      directory={directory}
      aliases={aliases}
      teamAddresses={teamAddresses}
      editable={data.teamWrites !== null}
      exportable={mayExportMembers(data.viewer)}
    />
  );
}
