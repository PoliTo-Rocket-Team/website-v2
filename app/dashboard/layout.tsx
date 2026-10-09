import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { sidebarFor } from "@/lib/dashboard/access";
import { openDashboardData } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Dashboard · PoliTo Rocket Team",
};

// Every dashboard page sits in the shell: the viewer's sidebar and the page.
// Who the viewer is comes from the dashboard data interface, read on request
// only, so a build never reads a cookie or the database.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-ground" />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: ReactNode }) {
  const data = await openDashboardData();
  if (!data) redirect("/login?cb=/dashboard");
  const counts = await data.navCounts();
  return (
    <DashboardShell viewer={data.viewer} sections={sidebarFor(data.viewer.kind, counts)}>
      {children}
    </DashboardShell>
  );
}
