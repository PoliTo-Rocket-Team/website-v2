import "server-only";

import type { CurrentUser } from "@/lib/current-user";
import { actingTitleOf } from "./acting-account";
import { actingTitleIn, readActingTitles } from "./database-acting-account";
import { viewAsSiteOf, type ViewAsBanner, type ViewAsSite } from "./view-as";

/**
 * The View as banner for this request (issue #611), or null for a session
 * that is not a View as one. The acting account is the session's own
 * `impersonatedBy` (lib/current-user.ts), and the variant is the site the
 * server runs on, so nothing the request names decides either. On both sites
 * the line names the acting account's title as its writes record it.
 */
export async function readViewAsBanner(
  user: CurrentUser | null,
  person: { readonly name: string; readonly role: string },
  site: ViewAsSite = viewAsSiteOf(),
): Promise<ViewAsBanner | null> {
  if (user === null || user.actingAccountId === null) return null;
  const { name, role } = person;
  // Every acting account given gets a title (readActingTitles); the fallback only keeps the banner from ever dropping.
  const actingTitle = actingTitleIn(await readActingTitles([user.actingAccountId]), user.actingAccountId) ?? actingTitleOf([]);
  return { site, name, role, actingTitle };
}
