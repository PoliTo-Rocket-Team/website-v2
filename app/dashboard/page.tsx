import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OverviewSectionSkeleton, PageSkeleton } from "@/components/dashboard/page-skeleton";
import type { ReadyAddress } from "@/components/dashboard/alias-setup";
import {
  OverviewBodySection,
  OverviewPersonSection,
  OverviewReadySection,
  OverviewView,
} from "@/components/dashboard/overview";
import { canReach } from "@/lib/dashboard/access";
import { showsAliasCard, type OwnAlias } from "@/lib/dashboard/alias-setup";
import { teamAddressCardsOf, type OwnTeamAddress } from "@/lib/dashboard/team-address";
import { applicantOverview } from "@/lib/dashboard/applicant-overview";
import type { DashboardData } from "@/lib/dashboard/data";
import { alumniOverview } from "@/lib/dashboard/my-alumni";
import { openDashboard } from "@/lib/dashboard/open";
import type { PersonalPanels, ScopeBoard } from "@/lib/dashboard/overview";

export const metadata: Metadata = {
  title: "Overview · Dashboard · PoliTo Rocket Team",
};

// Board 40 (the operations lead), 72 (the team leader), 56 (a division
// lead), 52 (a member), 50e and 50f (a non-member, with and without an
// application shown) and issue #317's board 56 (an alumnus). Every viewer
// reaches it and lands on it (lib/dashboard/access.ts); what it shows is the
// viewer's own overview.
export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="overview" />}>
      <LiveOverview />
    </Suspense>
  );
}

async function LiveOverview() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard");
  // The layout shows the sign-out screen in place of this page.
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "overview")) notFound();
  switch (data.viewer.kind) {
    case "non-member": {
      const mine = await data.myApplications();
      if (mine === null) notFound();
      return <OverviewView overview={applicantOverview(data.viewer, mine)} />;
    }
    case "alumni": {
      // Off the team, the Overview reads the applications My applications shows
      // (issue #211) and lists no open positions (issue #317); an alumnus's adds
      // their Alumni entry.
      const [mine, me] = await Promise.all([data.myApplications(), data.myAlumni()]);
      if (mine === null || me === null) notFound();
      return <OverviewView overview={alumniOverview(data.viewer, me, mine)} />;
    }
    default:
      return <TeamOverview data={data} />;
  }
}

// A team seat's Overview streams in by section (issue #397): the person
// shows at once, and the alias card and the rest each arrive on their own,
// their reads started together here. The board's and the personal panels'
// reads share one section, since boards 99 and 99b set their panels side by
// side in one pair of columns (issue #652).
function TeamOverview({ data }: { data: DashboardData }) {
  const { person, board, panels } = data.overviewSections();
  // The viewer's own email alias card (board 94f, issue #542), until the alias is set up,
  // and the same card for each team address they hold and have not set up.
  const alias = data.myAlias();
  const teamAddresses = data.myTeamAddresses();
  return (
    <>
      <OverviewPersonSection person={person} />
      <Suspense fallback={null}>
        <LiveReadyCards alias={alias} teamAddresses={teamAddresses} />
      </Suspense>
      <Suspense fallback={<OverviewSectionSkeleton section="board" />}>
        <LiveBody board={board} panels={panels} />
      </Suspense>
    </>
  );
}

async function LiveReadyCards({ alias, teamAddresses }: { alias: Promise<OwnAlias | null>; teamAddresses: Promise<OwnTeamAddress[]> }) {
  const [own, held] = await Promise.all([alias, teamAddresses]);
  const cards: ReadyAddress[] = [
    ...(showsAliasCard(own) ? [{ kind: "alias", own } as const] : []),
    ...teamAddressCardsOf(held).map((address) => ({ kind: "team-address", own: address }) as const),
  ];
  return <OverviewReadySection cards={cards} />;
}

async function LiveBody({ board, panels }: { board: Promise<ScopeBoard>; panels: Promise<Omit<PersonalPanels, "person">> }) {
  const [scope, own] = await Promise.all([board, panels]);
  return <OverviewBodySection board={scope} panels={own} />;
}
