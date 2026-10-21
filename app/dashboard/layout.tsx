import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Avatar } from "@/components/dashboard/avatar";
import { ClosedOpening, DashboardShell, TopBarAccount } from "@/components/dashboard/shell";
import { SidebarPages, SidebarPlaceholder } from "@/components/dashboard/sidebar";
import { openChrome, type DashboardChrome } from "@/lib/dashboard/chrome";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Dashboard · PoliTo Rocket Team",
  // No share image here or on any dashboard page: this drops the root's
  // default one (app/opengraph-image.tsx, issue #454).
  openGraph: null,
};

// Every dashboard page sits in the shell: the viewer's sidebar, their user
// menu and the page.
// Who the viewer is comes from the dashboard data interface, read on request
// only, so a build never reads a cookie or the database. The frame does not
// wait for it (issue #397): it paints at once, and each part that needs the
// viewer streams in behind its own Suspense when the viewer is read, while
// the page streams in beside them. The layout and the page share one opening
// of the dashboard (`openDashboard` is cached per request).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const chrome = chromeOf();
  return (
    <DashboardShell
      sidebarPages={
        <Suspense fallback={<SidebarPlaceholder />}>
          <SidebarPages chrome={chrome} userMenu="dropdown" />
        </Suspense>
      }
      sheetPages={
        <Suspense fallback={<SidebarPlaceholder />}>
          <SidebarPages chrome={chrome} userMenu="sheet" />
        </Suspense>
      }
      account={
        <Suspense fallback={<Avatar accent />}>
          <TopBarAccount chrome={chrome} />
        </Suspense>
      }
      closed={
        <Suspense fallback={null}>
          <ClosedOpening chrome={chrome} />
        </Suspense>
      }
    >
      {children}
    </DashboardShell>
  );
}

async function chromeOf(): Promise<DashboardChrome> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return { kind: opening.kind };
  const { data } = opening;
  const [counts, hasShownApplications] = await Promise.all([data.navCounts(), data.hasShownApplications()]);
  return openChrome(data.viewer, { counts, hasShownApplications });
}
