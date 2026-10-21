import assert from "node:assert/strict";
import { test } from "node:test";
import { backTo, cameFrom, DASHBOARD_HOME, NO_TRAIL, visited } from "./came-from";

// The Team page editor's back arrow (issue #510): back to the dashboard page
// it was opened from, else the dashboard home.

const EDITOR = "/dashboard/team-page";

test("opened from another dashboard page, the arrow goes back there under that page's name", () => {
  const trail = visited(visited(NO_TRAIL, "/dashboard"), "/dashboard/members");
  // Asked before the trail records the editor, and after: the same answer.
  assert.deepEqual(backTo(cameFrom(trail, EDITOR), EDITOR), { label: "Members", href: "/dashboard/members" });
  assert.deepEqual(backTo(cameFrom(visited(trail, EDITOR), EDITOR), EDITOR), { label: "Members", href: "/dashboard/members" });
});

test("with no known page before it, or only itself or a page off the dashboard, the arrow goes to the dashboard home", () => {
  // A reload or a new tab: the trail starts at the editor.
  assert.deepEqual(backTo(cameFrom(visited(NO_TRAIL, EDITOR), EDITOR), EDITOR), DASHBOARD_HOME);
  assert.deepEqual(backTo(EDITOR, EDITOR), DASHBOARD_HOME);
  assert.deepEqual(backTo("/about/the-team", EDITOR), DASHBOARD_HOME);
  assert.deepEqual(DASHBOARD_HOME, { label: "Dashboard", href: "/dashboard" });
});
