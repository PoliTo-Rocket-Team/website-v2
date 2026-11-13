import "server-only";

import { revalidatePath } from "next/cache";

// One refresh for every dashboard write (issue #984). A server action calls
// it once its write lands. Every dashboard page reads the database again, and
// the browser drops the copies of dashboard pages it kept, so the page the
// write ran on and any page the viewer goes back to both show the change at
// once, with no reload. A refused write calls nothing, so the page keeps what
// it showed. Next's `refresh()` alone renders only the current page and leaves
// the kept copies, which is why the dashboard does not use it.

/** After a dashboard write lands: every dashboard page reads again. */
export function refreshDashboard(): void {
  revalidatePath("/dashboard", "layout");
}
