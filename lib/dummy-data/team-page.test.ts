import assert from "node:assert/strict";
import { test } from "node:test";
import { team } from "@/lib/about/team";
import { NO_TEAM_LAYER, type TeamPageLayer } from "@/lib/about/team-layer";
import { publicTeamPage } from "@/lib/about/team-page-editor";
import { teamPageFromRoles } from "@/lib/about/team-roles";
import { NO_CONTENT_EDITS } from "./content-edits";
import { NO_EDITS } from "./edits";
import { dummyDashboardData } from "./index";
import { NO_OUTREACH_EDITS } from "./outreach";
import { NO_OWN_CHANGES } from "./own";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { advisorRowsOf } from "@/lib/about/advisors";
import {
  dummyAdvisorSeed,
  dummyTeamPageLayerSeed,
  dummyTeamRoles,
  parseTeamPageLayerEdits,
  serializeTeamPageLayerEdits,
  type DummyTeamPageLayerEdits,
  type DummyTeamPageLayerEditsStore,
} from "./team-page";

// The Team page's visual layer on previews (issue #283): it lives in the test
// developer's own cookie, the dummy side lays it on the dummy team, and
// nothing else they hold changes. The public page reads the seed, never the
// cookie.

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie(): DummyTeamPageLayerEditsStore & { value: string | undefined } {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyTeamPageLayerEdits {
      return parseTeamPageLayerEdits(jar.value);
    },
    save: async (next: DummyTeamPageLayerEdits) => {
      jar.value = serializeTeamPageLayerEdits(next);
    },
  };
  return jar;
}

/** A store that fails the test if anything is saved to it. */
function untouched<T>(name: string, current: T) {
  return {
    current,
    save: async () => {
      assert.fail(`the Team page layer wrote ${name}`);
    },
  };
}

/** Today's advisors as the panel holds them: a save that leaves them as they are. */
const seedRows = advisorRowsOf(dummyAdvisorSeed());

const edited: TeamPageLayer ={ ...NO_TEAM_LAYER, leader: { role: "President" }, spots: { "head:1:0": { name: "Chiara R." } } };

/** The dummy dashboard of a full-access test developer whose only writable store is the Team page cookie. */
function dashboard(jar: DummyTeamPageLayerEditsStore, viewer: "operations-lead" | "division-lead" = "operations-lead") {
  return dummyDashboardData(
    viewer,
    untouched("the recruitment switch", dummyRecruitmentOf(undefined)),
    untouched("positions or applications", EMPTY_DUMMY_STATE),
    // Roles, divisions, departments, access and member records all live here on the dummy side.
    untouched("the team (roles, divisions, departments, scopes, members)", NO_EDITS),
    untouched("own pages", NO_OWN_CHANGES),
    "sample",
    untouched("partners", NO_CONTENT_EDITS),
    untouched("the FAQ", NO_CONTENT_EDITS),
    untouched("Outreach", NO_OUTREACH_EDITS),
    jar,
  );
}

test("on previews the layer lives in the test developer's cookie, and the dummy side lays it on the dummy team", async () => {
  const jar = cookie();
  assert.ok((await dashboard(jar).teamPage.save("save-draft", edited, seedRows)).ok);
  assert.ok(jar.value !== undefined, "kept in the cookie");

  // The next request reads the cookie back and lays the draft on the dummy team.
  const opened = await dashboard(jar).teamPage.open();
  assert.equal(opened?.status, "draft");
  assert.equal(opened?.page.orgChart.leader.role, "President");
  assert.ok(opened?.page.departments.groups[0].members.some((m) => m.name === "Chiara R."));

  assert.ok((await dashboard(jar).teamPage.save("publish", edited, seedRows)).ok);
  assert.equal((await dashboard(jar).teamPage.open())?.status, "published");
  assert.ok((await dashboard(jar).teamPage.reset()).ok);
  const reset = await dashboard(jar).teamPage.open();
  assert.equal(reset?.status, "draft-changes");
  assert.deepEqual(reset?.layer, NO_TEAM_LAYER);
});

test("no Team page write touches anything but the layer's cookie, and a viewer without site-content access is refused", async () => {
  const jar = cookie();
  const lead = dashboard(jar, "division-lead").teamPage;
  assert.equal(await lead.open(), null);
  assert.equal((await lead.save("publish", edited, seedRows)).ok, false);
  assert.equal((await lead.reset()).ok, false);
  assert.equal(jar.value, undefined);
});

test("the public page on previews is the dummy team with the seed's published layer, never the cookie", () => {
  assert.deepEqual(dummyTeamPageLayerSeed(), []);
  assert.deepEqual(publicTeamPage(dummyTeamRoles(), team, dummyTeamPageLayerSeed()), teamPageFromRoles(dummyTeamRoles(), team));
});

test("a cookie this code did not write reads as no edits", () => {
  const forged = { saved: [{ id: 1, siteOrder: 1, version: { state: "published", published: { ...NO_TEAM_LAYER, leader: { email: "x@y.z" } }, draft: null } }], removed: [], order: [] };
  assert.deepEqual(parseTeamPageLayerEdits(encodeURIComponent(JSON.stringify(forged))), NO_CONTENT_EDITS);
  assert.deepEqual(parseTeamPageLayerEdits("not json"), NO_CONTENT_EDITS);
});
