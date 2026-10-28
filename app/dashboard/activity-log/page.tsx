import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActivityLogView } from "@/components/dashboard/activity-log";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Activity log · Dashboard · PoliTo Rocket Team",
};

// Board 101 (issue #642): every stored change, with View as starts, stops and
// timeouts. Only the viewers the `activity-log` row of lib/dashboard/access.ts
// admits reach it; anyone else gets the dashboard's not found.
export default function ActivityLogPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="list" />}>
      <LiveActivityLog />
    </Suspense>
  );
}

async function LiveActivityLog() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/activity-log");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "activity-log")) notFound();
  const log = await data.activityLog();
  if (log === null) notFound();
  return <ActivityLogView log={log} />;
}
