import assert from "node:assert/strict";
import { test } from "node:test";
import { sidebarFor, userMenuPageFor } from "./access";
import { openChrome } from "./chrome";
import { testDeveloperStanding, type DashboardViewer } from "./viewer";

// The frame's chrome now streams in on its own (issue #397); it must carry
// the same sidebar, user card line and user menu the layout built before.

function viewerOf(kind: Parameters<typeof testDeveloperStanding>[0], role: string): DashboardViewer {
  return { ...testDeveloperStanding(kind), name: "Ada Lovelace", role, photoUrl: null, session: "account" };
}

test("an applicant with nothing shown reads Signed in, with the sidebar and menu their standing gives", () => {
  const viewer = viewerOf("non-member", "Applicant");
  const facts = { counts: {}, hasShownApplications: false };
  assert.deepEqual(openChrome(viewer, facts, null, null), {
    kind: "open",
    viewer: { ...viewer, role: "Signed in" },
    sections: sidebarFor(viewer, facts),
    menuPage: userMenuPageFor("non-member"),
    viewAs: null,
    viewingAs: null,
  });
});

test("a lead keeps their role's title and the new-application count on their sidebar", () => {
  const viewer = viewerOf("division-lead", "Avionics Lead");
  const facts = { counts: { applications: 3 }, hasShownApplications: false };
  const chrome = openChrome(viewer, facts, null, null);
  assert.equal(chrome.kind, "open");
  if (chrome.kind !== "open") return;
  assert.equal(chrome.viewer.role, "Avionics Lead");
  assert.deepEqual(chrome.sections, sidebarFor(viewer, facts));
});
