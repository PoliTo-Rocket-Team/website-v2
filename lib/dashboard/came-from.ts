import { pageTitleFor } from "./access";

// Where an editor's back arrow goes (issue #510): the dashboard page it was
// opened from. Dashboard pages change by client-side navigation, so the
// browser's referrer keeps the page that first loaded the app; the dashboard
// keeps its own trail of the pages this tab visited instead. A reload or a
// new tab starts a new trail, and the arrow then goes to the dashboard home.

/** The page this tab shows now and the one before it, by pathname; null where none is known. */
export type Trail = { readonly current: string | null; readonly previous: string | null };

export const NO_TRAIL: Trail = { current: null, previous: null };

/** The trail once `pathname` shows; showing the same page again changes nothing. */
export function visited(trail: Trail, pathname: string): Trail {
  return trail.current === pathname ? trail : { current: pathname, previous: trail.current };
}

/**
 * The page the visit to `here` came from. The trail may not have recorded
 * `here` yet when the page asks, so the page it shows is then the one before.
 */
export function cameFrom(trail: Trail, here: string): string | null {
  return trail.current === here ? trail.previous : trail.current;
}

/** The back arrow and the breadcrumb's first step. */
export type BackLink = { readonly label: string; readonly href: string };

export const DASHBOARD_HOME: BackLink = { label: "Dashboard", href: "/dashboard" };

/**
 * Back to `from` under its page's name when it is another dashboard page than
 * `here`; the dashboard home in every other case: no page known, the page
 * itself, or a page off the dashboard.
 */
export function backTo(from: string | null, here: string): BackLink {
  if (from === null || from === here) return DASHBOARD_HOME;
  const label = pageTitleFor(from);
  return label === null ? DASHBOARD_HOME : { label, href: from };
}
