import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MeetingMinutesView } from "@/components/dashboard/meeting-minutes";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { canReach } from "@/lib/dashboard/access";
import { minutesPageOf } from "@/lib/dashboard/meeting-minutes";
import { MINUTES_LINKS } from "@/lib/dashboard/meeting-minutes-links";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Meeting Minutes & Requests · Dashboard · PoliTo Rocket Team",
};

// Links to the divisions' meeting minutes and to the Requests Hub. Only the
// viewers the `meeting-minutes` row of lib/dashboard/access.ts admits reach
// it; anyone else gets the dashboard's not found.
export default function MeetingMinutesPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="plain" />}>
      <LiveMeetingMinutes />
    </Suspense>
  );
}

async function LiveMeetingMinutes() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/meeting-minutes");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "meeting-minutes")) notFound();
  return <MeetingMinutesView page={minutesPageOf(MINUTES_LINKS)} />;
}
