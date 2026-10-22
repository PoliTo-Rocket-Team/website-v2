import type { ViewerStanding } from "@/lib/dashboard/viewer";

// Who may change the public site's content from the dashboard (issue #256),
// by the site-content rule in docs/dashboard-rules.md: full access (issue
// #238) and anyone given a Content grant (issue #504). That covers the
// Projects, Outreach, Partners, FAQ and Team page editors. The Alumni page is
// not site content here: it reads its own Alumni grant (`canReach`,
// lib/dashboard/access.ts), and an Alumni grant opens no editor below. A
// division lead or department head gets nothing from their role here.
// Whoever may edit may also publish: the boards name no separate right to
// publish.

export function maySiteContent(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead" || viewer.siteContent;
}

export const SITE_CONTENT_REFUSAL = "Only full access and people with Content access change the site's content.";
