import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Avatar } from "@/components/dashboard/avatar";
import { ClosedOpening, DashboardShell, TopBarAccount } from "@/components/dashboard/shell";
import { SidebarPages, SidebarPlaceholder } from "@/components/dashboard/sidebar";
import { ViewAsDialogSlot } from "@/components/dashboard/view-as-dialog";
import { getCurrentUser } from "@/lib/current-user";
import { openChrome, type DashboardChrome } from "@/lib/dashboard/chrome";
import { readViewAsBanner } from "@/lib/dashboard/database-view-as-banner";
import { readViewAsOpening } from "@/lib/dashboard/database-view-as-dialog";
import { openDashboard } from "@/lib/dashboard/open";
import { userCardRole } from "@/lib/dashboard/viewer";

export const metadata: Metadata = {
  title: "Dashboard · PoliTo Rocket Team",
  // No share image here or on any dashboard page: this drops the root's
  // default one (app/opengraph-image.tsx, issue #454). On a layout it takes
  // an empty image list: `openGraph: null` here lets the root's image back
  // in on the pages below (measured on a Next.js 16.2 build).
  openGraph: { images: [] },
};

// Every dashboard page sits in the shell: the viewer's sidebar, their user
// menu, the View as dialog for an account allowed it, the View as banner in a
// View as session, and the page.
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
      chrome={chrome}
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
        <Suspense fallback={<Avatar person={null} accent />}>
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
      {/* The View as dialog (issue #610) opens over any page from its address; it mounts only for an account the View as gate allows. */}
      <Suspense fallback={null}>
        <ViewAsDialogSlot chrome={chrome} />
      </Suspense>
    </DashboardShell>
  );
}

async function chromeOf(): Promise<DashboardChrome> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return { kind: opening.kind };
  const { data } = opening;
  const [counts, hasShownApplications, user] = await Promise.all([data.navCounts(), data.hasShownApplications(), getCurrentUser()]);
  // The banner names the person as their user card does (`userCardRole`).
  const person = { name: data.viewer.name, role: userCardRole(data.viewer, hasShownApplications) };
  const [viewAs, viewingAs] = await Promise.all([readViewAsOpening(user), readViewAsBanner(user, person)]);
  return openChrome(data.viewer, { counts, hasShownApplications }, viewAs, viewingAs);
}
