import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";
import { openChrome, type DashboardChrome } from "@/lib/dashboard/chrome";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Dashboard · PoliTo Rocket Team",
};

// Every dashboard page sits in the shell: the viewer's sidebar, their user
// menu and the page.
// Who the viewer is comes from the dashboard data interface, read on request
// only, so a build never reads a cookie or the database. The frame does not
// wait for it (issue #397): it paints at once, the sidebar and the user menu
// stream in when the viewer is read, and the page streams in beside them. The
// layout and the page share one opening of the dashboard (`openDashboard` is
// cached per request).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell chrome={chromeOf()}>{children}</DashboardShell>;
}

async function chromeOf(): Promise<DashboardChrome> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return { kind: opening.kind };
  const { data } = opening;
  const [counts, hasShownApplications] = await Promise.all([data.navCounts(), data.hasShownApplications()]);
  return openChrome(data.viewer, { counts, hasShownApplications });
}
