import type { ViewerStanding } from "@/lib/dashboard/viewer";

// Who may change the public site's content from the dashboard (issue #256),
// by the site-content rule in docs/dashboard-rules.md: full access (issue
// #238) and anyone given a Content grant (issue #504), which is an edit grant
// (`holdsContentGrant`, lib/dashboard/viewer.ts). That covers the Projects,
// Outreach, Partners, Alumni, FAQ and Team page editors: the Alumni page is
// site content under the Content grant (Owner decision, 2026-10-22, issue
// #589), with no grant of its own. A division lead or department head gets
// nothing from their role here.
// Whoever may edit may also publish: the boards name no separate right to
// publish.

export function maySiteContent(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead" || viewer.siteContent;
}

export const SITE_CONTENT_REFUSAL = "Only full access and people with Content access change the site's content.";
