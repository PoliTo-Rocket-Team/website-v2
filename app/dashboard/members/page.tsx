import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { MembersView } from "@/components/dashboard/members";
import { canReach } from "@/lib/dashboard/access";
import { mayExportMembers } from "@/lib/dashboard/members-export";
import { NO_TEAM_ADDRESSES } from "@/lib/dashboard/team-address";
import { memberIdsOf, membersModelOf } from "@/lib/dashboard/members-view";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Members · Dashboard · PoliTo Rocket Team",
};

type Search = Promise<{ division?: string | string[] }>;

// Boards 46 (operations lead: the whole team), 73 to 73c (the team leader:
// the whole team with every member field, issue #252), 61e to 61h2 (division lead:
// every division they reach, with the people waiting for Confirm NDA and the
// member panels, issue #903) and 69 to 69c (department head: every division of
// the department). Each opens on the viewer's whole scope; `?division=` opens it
// with that division chosen in the division select, where the scope holds it.
// It replaces the legacy members page.
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
  const directory = await data.members();
  // Each member's email alias on their PRT email row: the address, or the request state while it is empty (epic #538, boards 94 to 94e; issue #563).
  // Beside it, the shared team addresses each one holds and Request team address (epic #578, boards 102 and 102b, issues #786 and #787).
  const model = membersModelOf(directory);
  const memberIds = model === null ? [] : memberIdsOf(model);
  const [aliases, teamAddresses] = model === null ? [{}, NO_TEAM_ADDRESSES] : await Promise.all([data.memberAliases(memberIds), data.memberTeamAddresses(memberIds)]);
  return (
    <MembersView
      directory={directory}
      aliases={aliases}
      teamAddresses={teamAddresses}
      editable={data.teamWrites !== null}
      exportable={mayExportMembers(data.viewer)}
      askedDivision={Number.isSafeInteger(divisionId) && divisionId > 0 ? divisionId : null}
    />
  );
}
