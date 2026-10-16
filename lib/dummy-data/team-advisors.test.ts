import assert from "node:assert/strict";
import { test } from "node:test";
import { advisorRowsOf, publicAdvisors, withAdvisors, type AdvisorRow } from "@/lib/about/advisors";
import { team } from "@/lib/about/team";
import { NO_TEAM_LAYER, type TeamPageLayer } from "@/lib/about/team-layer";
import { publicTeamPage } from "@/lib/about/team-page-editor";
import { NO_CONTENT_EDITS } from "./content-edits";
import { NO_EDITS, type TeamEdits } from "./edits";
import { dummyDashboardData } from "./index";
import { NO_OUTREACH_EDITS } from "./outreach";
import { NO_OWN_CHANGES } from "./own";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import {
  dummyAdvisorSeed,
  dummyTeamPageLayerSeed,
  dummyTeamRoles,
  parseAdvisorEdits,
  parseTeamPageLayerEdits,
  serializeAdvisorEdits,
  serializeTeamPageLayerEdits,
} from "./team-page";

// The Team page's advisors on previews (issue #286): they live in the test
// developer's own cookie over today's advisors; End advising adds an entry to
// the Alumni edits and changes nothing else of the team; Reset to team never
// reaches them; the public page reads the seed, never the cookie.

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie<T>(parse: (value: string | undefined) => T, serialize: (next: T) => string) {
  const jar = {
    value: undefined as string | undefined,
    get current(): T {
      return parse(jar.value);
    },
    save: async (next: T) => {
      jar.value = serialize(next);
    },
  };
  return jar;
}

const advisorJar = () => cookie(parseAdvisorEdits, serializeAdvisorEdits);
const layerJar = () => cookie(parseTeamPageLayerEdits, serializeTeamPageLayerEdits);

/** The team edits, which hold roles, divisions, departments, access and member records on the dummy side. */
function teamJar() {
  const jar = { current: NO_EDITS as TeamEdits, saves: 0, save: async (next: TeamEdits) => void ((jar.current = next), jar.saves++) };
  return jar;
}

function untouched<T>(name: string, current: T) {
  return {
    current,
    save: async () => {
      assert.fail(`the advisors wrote ${name}`);
    },
  };
}

function dashboard(advisors: ReturnType<typeof advisorJar>, teamEdits: ReturnType<typeof teamJar>, layer = layerJar()) {
  return dummyDashboardData(
    "operations-lead",
    untouched("the recruitment switch", dummyRecruitmentOf(undefined)),
    untouched("positions or applications", EMPTY_DUMMY_STATE),
    teamEdits,
    untouched("own pages", NO_OWN_CHANGES),
    "sample",
    untouched("partners", NO_CONTENT_EDITS),
    untouched("the FAQ", NO_CONTENT_EDITS),
    untouched("Outreach", NO_OUTREACH_EDITS),
    layer,
    advisors,
  );
}

test("on previews a test developer's advisor draft lives in their cookie and the team edits stay as they were", async () => {
  const advisors = advisorJar();
  const teamEdits = teamJar();
  const rows = advisorRowsOf((await dashboard(advisors, teamEdits).teamAdvisors.list())!);
  const added: AdvisorRow = { id: null, fields: { name: "Prof. Ada Rossi", role: "Propulsion", standing: "specialist", photo: null, linkedin: "", email: "" } };
  assert.ok((await dashboard(advisors, teamEdits).teamAdvisors.save("save-draft", [...rows, added])).ok);
  assert.ok(advisors.value !== undefined, "kept in the cookie");
  assert.equal(teamEdits.saves, 0);
  const reopened = advisorRowsOf((await dashboard(advisors, teamEdits).teamAdvisors.list())!);
  assert.equal(reopened.at(-1)?.fields.name, "Prof. Ada Rossi");
});

test("End advising on a preview takes the advisor off and adds them to the Alumni edits' advisors, and nothing else of the team", async () => {
  const advisors = advisorJar();
  const teamEdits = teamJar();
  const flora = advisorRowsOf((await dashboard(advisors, teamEdits).teamAdvisors.list())!).find((r) => r.fields.name === "Flora Punzi")!;
  assert.ok((await dashboard(advisors, teamEdits).teamAdvisors.end(flora.id!, { from: 2024, to: 2026 })).ok);
  assert.ok(!advisorRowsOf((await dashboard(advisors, teamEdits).teamAdvisors.list())!).some((r) => r.id === flora.id));
  assert.deepEqual(teamEdits.current, {
    ...NO_EDITS,
    alumni: { ...NO_EDITS.alumni, advisors: [{ name: "Flora Punzi", role: "Senior FEA Analyst & Counselor", from: 2024, to: 2026 }] },
  });
  // The dashboard's Alumni page lists them in its Advisors group.
  const listed = await dashboard(advisors, teamEdits).alumni();
  assert.ok(JSON.stringify(listed).includes("Flora Punzi"));
});

test("Reset to team leaves the advisors unchanged", async () => {
  const advisors = advisorJar();
  const teamEdits = teamJar();
  const layer = layerJar();
  const open = dashboard(advisors, teamEdits, layer);
  const rows = advisorRowsOf((await open.teamAdvisors.list())!);
  const swapped = [rows[1], rows[0], ...rows.slice(2)];
  assert.ok((await open.teamAdvisors.save("save-draft", swapped)).ok);
  const edited: TeamPageLayer = { ...NO_TEAM_LAYER, leader: { role: "President" } };
  assert.ok((await dashboard(advisors, teamEdits, layer).teamPage.save("save-draft", edited)).ok);
  const before = { cookie: advisors.value, items: await dashboard(advisors, teamEdits, layer).teamAdvisors.list() };

  assert.ok((await dashboard(advisors, teamEdits, layer).teamPage.reset()).ok);
  assert.equal(advisors.value, before.cookie);
  assert.deepEqual(await dashboard(advisors, teamEdits, layer).teamAdvisors.list(), before.items);
});

test("the public page on previews shows today's advisors from the seed, never the cookie", () => {
  const page = withAdvisors(publicTeamPage(dummyTeamRoles(), team, dummyTeamPageLayerSeed()), publicAdvisors(dummyAdvisorSeed()));
  assert.deepEqual(page.advisors, team.advisors);
});
