import assert from "node:assert/strict";
import { test } from "node:test";
import { roleLabelOf } from "./role-label";
import { viewAsLineOf, type ViewAsRole } from "./view-as";
import { userCardRole, viewerStandingOf } from "./viewer";

// One role label (issue #650): the View as dialog's row opens with the label
// the banner then shows for that person. The banner's role is the user card's
// line (app/dashboard/layout.tsx), which on the team is `roleLabelOf`.

function bannerRoleOf(roles: readonly ViewAsRole[]): string {
  const standing = viewerStandingOf({ scopes: [], activeRoles: roles.map((r) => ({ type: r.type, divisionId: 17, fullAccess: r.seat })) });
  return userCardRole({ ...standing, name: "Elif Kaya", role: roleLabelOf(roles), photoUrl: null }, false);
}

test("the dialog's row starts with the label the banner shows, for a seat holder and a division member with a stored title", () => {
  const itLead: ViewAsRole[] = [{ id: 1, type: "lead", title: "IT Lead", seat: "it-lead", startedAt: "2024-10-01", unitName: "Information Technology" }];
  const developer: ViewAsRole[] = [
    { id: 2, type: "core", title: "Desktop App Developer", seat: null, startedAt: "2024-10-01", unitName: "Information Technology" },
  ];
  for (const [roles, label] of [
    [itLead, "IT Lead"],
    [developer, "Desktop App Developer"],
  ] as const) {
    assert.equal(bannerRoleOf(roles), label);
    assert.ok(viewAsLineOf({ roles, alumnus: null }).startsWith(label), label);
  }
});

test("two member roles started on one day give the dialog and the banner one label, whichever order each reads them in", () => {
  const developer: ViewAsRole = { id: 7, type: "core", title: "Desktop App Developer", seat: null, startedAt: "2024-10-01", unitName: "Information Technology" };
  const analyst: ViewAsRole = { id: 9, type: "advisor", title: "Trajectory Analyst", seat: null, startedAt: "2024-10-01", unitName: "Mission Analysis" };
  const banner = bannerRoleOf([analyst, developer]);
  const line = viewAsLineOf({ roles: [developer, analyst], alumnus: null });
  assert.equal(banner, "Desktop App Developer");
  assert.ok(line.startsWith(banner), line);
  assert.equal(viewAsLineOf({ roles: [analyst, developer], alumnus: null }), line);
});
