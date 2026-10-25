import assert from "node:assert/strict";
import { test } from "node:test";
import { sidebarFor, userMenuPageFor } from "./access";
import { openChrome } from "./chrome";
import { hasOwnProfile, isOffTeam, plainSeatStanding, type DashboardViewer } from "./viewer";

// The frame's chrome now streams in on its own (issue #397); it must carry
// the same sidebar, user card line and user menu the layout built before.

/** A placeholder viewer; on the team they have member record 1 unless `memberId` says none. */
function viewerOf(
  kind: Parameters<typeof plainSeatStanding>[0],
  role: string,
  memberId?: number | null,
): DashboardViewer {
  const standing = plainSeatStanding(kind);
  const record = memberId === undefined ? (isOffTeam(standing.kind) ? null : 1) : memberId;
  return { ...standing, name: "Ada Lovelace", role, photoUrl: null, hasOwnProfile: hasOwnProfile({ kind: standing.kind, memberId: record }) };
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

// Issue #725: the user menu offers My profile only to an account with a
// member record, the same rule the My profile page reads.

test("a viewer who reaches My profile with a member record gets it in the user menu", () => {
  const viewer = viewerOf("member", "Member", 1);
  const facts = { counts: {}, hasShownApplications: false };
  const chrome = openChrome(viewer, facts, null, null);
  assert.equal(chrome.kind, "open");
  if (chrome.kind !== "open") return;
  assert.equal(chrome.menuPage?.key, "my-profile");
  assert.deepEqual(chrome.sections, sidebarFor(viewer, facts));
});

test("the same viewer with no member record gets no user menu page and the same sidebar", () => {
  const facts = { counts: {}, hasShownApplications: false };
  for (const kind of ["operations-lead", "department-head", "division-lead", "member"] as const) {
    const viewer = viewerOf(kind, "Placeholder", null);
    const chrome = openChrome(viewer, facts, null, null);
    assert.equal(chrome.kind, "open");
    if (chrome.kind !== "open") return;
    assert.equal(chrome.menuPage, null, kind);
    assert.deepEqual(chrome.sections, sidebarFor(viewerOf(kind, "Placeholder", 1), facts), kind);
  }
});

test("a viewer off the team keeps My account in the user menu", () => {
  const facts = { counts: {}, hasShownApplications: false };
  for (const kind of ["alumni", "non-member"] as const) {
    const chrome = openChrome(viewerOf(kind, "Signed in"), facts, null, null);
    assert.equal(chrome.kind, "open");
    if (chrome.kind !== "open") return;
    assert.deepEqual(chrome.menuPage, userMenuPageFor(kind), kind);
    assert.equal(chrome.menuPage?.label, "My account", kind);
  }
});
