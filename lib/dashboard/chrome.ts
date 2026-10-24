import { sidebarFor, userMenuPageFor, type MenuPage, type NavSection, type SidebarFacts } from "./access";
import type { DashboardOpening } from "./opening";
import type { ViewAsOpening } from "./view-as";
import { userCardRole, type DashboardViewer } from "./viewer";

/**
 * What the dashboard frame shows around a page: the viewer's sidebar, user
 * card and user menu. The frame paints at once and this arrives after it
 * (issue #397), so a page never waits for the sidebar and the sidebar never
 * waits for a page. Off an open dashboard it carries only how the request
 * opened: signed out goes to /login, an account that did not resolve gets its
 * own screen (./opening.ts).
 */
export type DashboardChrome =
  | {
      readonly kind: "open";
      /** The viewer, with the user card's line under the name (`userCardRole`). */
      readonly viewer: DashboardViewer;
      readonly sections: readonly NavSection[];
      readonly menuPage: MenuPage | null;
      /** The View as dialog's opening (issue #610): only an account the View as gate allows has one, and only it sees "View as…". */
      readonly viewAs: ViewAsOpening | null;
    }
  | { readonly kind: Exclude<DashboardOpening["kind"], "open"> };

/** The chrome of an open dashboard, from its viewer, what the sidebar knows about them and their View as opening. */
export function openChrome(viewer: DashboardViewer, facts: SidebarFacts, viewAs: ViewAsOpening | null): DashboardChrome {
  return {
    kind: "open",
    viewer: { ...viewer, role: userCardRole(viewer, facts.hasShownApplications) },
    sections: sidebarFor(viewer, facts),
    menuPage: userMenuPageFor(viewer.kind),
    viewAs,
  };
}
