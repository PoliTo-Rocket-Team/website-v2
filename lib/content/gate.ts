import type { ViewerStanding } from "@/lib/dashboard/viewer";

// Who may change the public site's content from the dashboard (issue #256),
// by the site-content rule in docs/dashboard-rules.md: full access (the team
// leader, the operations lead and the IT lead, issue #238) and anyone given
// site-content access (a `website` scope row). A division lead or department
// head gets nothing from their role here. Whoever may edit may also publish:
// the boards name no separate right to publish.

export function maySiteContent(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead" || viewer.siteContent;
}

export const SITE_CONTENT_REFUSAL = "Only the full admins and people with site-content access change the site's content.";
