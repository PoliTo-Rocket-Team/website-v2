// The view imports its server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PositionsView } from "@/components/dashboard/positions";
import type { RecruitmentControl } from "@/lib/apply/recruitment-switch";
import type { PositionRow, PositionsPage } from "./recruitment";

// Issue #487: a role's open switch is live only where the viewer may change
// the role; elsewhere it is disabled and says "Open" or "Closed" beside it,
// in the table row and on the phone card. The page is rendered as the server
// sends it, so what is checked is the markup a viewer gets.

function position(id: number, title: string, open: boolean, canChange: boolean): PositionRow {
  return {
    id,
    ref: String(id),
    title,
    division: "Test Bench",
    department: "Propulsion",
    open,
    applications: null,
    canChange,
    updated: "2 days ago",
    code: `X-${id}`,
    content: { title, description: "", required: [], desirable: [], questions: [], motivationLetter: false },
  };
}

const recruitment = { recruitment: { isOpen: true }, canSwitch: false } as unknown as RecruitmentControl;

function rendered(rows: readonly PositionRow[]): string {
  const page: PositionsPage = {
    scope: "granted",
    places: [{ kind: "department", name: "Propulsion" }],
    positions: rows,
    newPosition: { divisions: [], nextId: 9 },
    readsApplications: false,
  };
  return renderToStaticMarkup(createElement(PositionsView, { page, recruitment }));
}

/** Every switch in the markup for the role, table row and phone card: its own tag, and what follows it and its hidden form input. */
function switchesOf(html: string, title: string): { readonly tag: string; readonly after: string }[] {
  const label = `aria-label="${title} is open"`;
  return [...html.matchAll(/<button[^>]*role="switch"[^>]*>.*?<\/button>(?:<input[^>]*>)?(.{0,160})/g)]
    .filter((m) => m[0].includes(label))
    .map((m) => ({ tag: m[0].slice(0, m[0].indexOf(">") + 1), after: m[1] }));
}

test("a role the viewer cannot change draws a disabled switch with its state in words, in the row and on the card", () => {
  const html = rendered([position(1, "Injector Engineer", true, false), position(2, "Valve Technician", false, false)]);
  for (const [title, state] of [
    ["Injector Engineer", "Open"],
    ["Valve Technician", "Closed"],
  ] as const) {
    const switches = switchesOf(html, title);
    assert.equal(switches.length, 2, `${title}: a switch in the table row and on the card`);
    for (const { tag, after } of switches) {
      assert.match(tag, /\sdisabled=""/, `${title}: the switch is disabled`);
      assert.match(after, new RegExp(`^<span[^>]*>${state}</span>`), `${title}: "${state}" beside the switch`);
    }
  }
});

test("a viewer who does not read Applications gets no Applications header, cell or track", () => {
  const html = rendered([position(1, "Injector Engineer", true, false)]);
  assert.doesNotMatch(html, />Applications</);
  const tracks = [...html.matchAll(/grid-template-columns:([^;"]+)/g)].map((m) => m[1]);
  assert.ok(tracks.length >= 2, "the header and the row each lay out their tracks");
  for (const t of tracks) assert.equal(t, "minmax(0,1.7fr) minmax(80px,0.8fr) minmax(56px,0.6fr) 112px");
});

test("a role the viewer may change draws a live switch, with no status text added on the card", () => {
  const html = rendered([position(1, "Injector Engineer", true, true)]);
  const switches = switchesOf(html, "Injector Engineer");
  assert.equal(switches.length, 2);
  for (const { tag } of switches) assert.doesNotMatch(tag, /\sdisabled=""/);
  // The table row keeps its "Open" text as before; the card shows the switch alone, as board 57m draws it.
  assert.equal(switches.filter((s) => /^<span[^>]*>Open<\/span>/.test(s.after)).length, 1);
});
