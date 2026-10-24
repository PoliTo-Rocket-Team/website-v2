"use server";

import { getCurrentUser } from "@/lib/current-user";
import { searchViewAsPeople } from "@/lib/dashboard/database-view-as-dialog";
import type { ViewAsSearch } from "@/lib/dashboard/view-as";

// The View as dialog's search (issue #610). The account is read from the
// session on the server, and one the View as gate refuses is answered with
// the refusal, never a name.

/** The longest text one search reads; a name is far shorter. */
const MAX_TEXT = 100;

export async function findViewAsPeople(text: unknown): Promise<ViewAsSearch> {
  const query = typeof text === "string" ? text.slice(0, MAX_TEXT) : "";
  return searchViewAsPeople(await getCurrentUser(), query);
}
