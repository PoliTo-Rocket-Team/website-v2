// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { FullAccessMoves, HandOverChoice } from "@/components/dashboard/hand-over-choice";
import { roles } from "@/db/schema";
import type { DashboardData } from "./data";
import { fakeDb, keepWrites } from "./access-matrix/fake-db";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { seatOfHandedRole, type HandedRole } from "./hand-over";
import { openDashboard } from "./open";
import { FLAG_OF_SEAT, type FlaggedSeat, type FullAccessSeat } from "./viewer";

// Every hand-over and replacement screen for a role that carries a
// full-access seat says, before its confirm, that full access moves (issue
// #501; Owner decision, 2026-10-21), and a role with no seat says nothing of
// it. Each screen reads the seat from its own data, on the database, and
// shows one shared sentence: lead
// replace and Change head through `HandOverChoice`, the hand-over dialog on
// My profile and the Team Leader box through `FullAccessMoves`, and the
// approver's Overview row in its detail line.

const DM = IDS.division("DM");
const STRUCTURES = IDS.department("DM");
const LEAD = IDS.lead("DM"); // "Lead DM", who has a hand-over request waiting for the head of Structures
const LEAD_ROW = 5_000 + LEAD;
const HEAD_ROW = 6_000; // EXTRA.head's ("Head Structures") head row on Structures
const TEAM_LEADER = accountOf("team leader").userId;

/** A freshly seeded database, with `rowId` flagged as `seat` when one is given, and `userId`'s dashboard on it. */
async function dashboardOf(userId: string, flag: { readonly rowId: number; readonly seat: FlaggedSeat } | null): Promise<DashboardData> {
  seedFixture();
  keepWrites();
  if (flag !== null) await fakeDb.update(roles).set({ fullAccess: FLAG_OF_SEAT[flag.seat] }).where(eq(roles.id, flag.rowId));
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (opening as { data: DashboardData }).data;
}

/** `HandOverChoice` as lead replace and Change head draw it, with the seat their data gives. */
function choice(seat: FullAccessSeat | null, handed: HandedRole, person: string, successor: string): string {
  return renderToStaticMarkup(
    createElement(HandOverChoice, { name: "x", person, handed, unit: "Unit", value: null, leave: { allowed: true }, seat, successor, onChange: () => {} }),
  );
}

describe("lead replace (Edit division)", () => {
  test("a lead whose role carries a seat: the choice says the seat moves to the new lead", async () => {
    const structure = (await (await dashboardOf(TEAM_LEADER, { rowId: LEAD_ROW, seat: "it-lead" })).teamStructure())!;
    const seat = seatOfHandedRole(structure.seats, LEAD, { kind: "lead", divisionId: DM });
    assert.equal(seat, "it-lead");
    assert.ok(choice(seat, { kind: "lead", divisionId: DM }, "Lead DM", "Person DM").includes("Person DM becomes IT lead and gets full access. Lead DM loses full access."));
  });

  test("a lead with no seat: nothing about full access", async () => {
    const structure = (await (await dashboardOf(TEAM_LEADER, null)).teamStructure())!;
    const seat = seatOfHandedRole(structure.seats, LEAD, { kind: "lead", divisionId: DM });
    assert.equal(seat, null);
    assert.ok(!choice(seat, { kind: "lead", divisionId: DM }, "Lead DM", "Person DM").includes("full access"));
  });
});

describe("Change head (Edit department)", () => {
  test("a head whose role carries a seat, on the database: the choice says the seat moves to the new head", async () => {
    const structure = (await (await dashboardOf(TEAM_LEADER, { rowId: HEAD_ROW, seat: "chief-engineer" })).teamStructure())!;
    const seat = seatOfHandedRole(structure.seats, EXTRA.head, { kind: "head", departmentId: STRUCTURES });
    assert.equal(seat, "chief-engineer");
    const html = choice(seat, { kind: "head", departmentId: STRUCTURES }, "Head Structures", "Person DM");
    assert.ok(html.includes("Person DM becomes Chief Engineer and gets full access. Head Structures loses full access."));
  });

  test("a head whose role carries the operations lead's seat: the choice says it moves; a head with no seat: nothing about full access", async () => {
    const flagged = (await (await dashboardOf(TEAM_LEADER, { rowId: HEAD_ROW, seat: "operations-lead" })).teamStructure())!;
    const seat = seatOfHandedRole(flagged.seats, EXTRA.head, { kind: "head", departmentId: STRUCTURES });
    assert.equal(seat, "operations-lead");
    const html = choice(seat, { kind: "head", departmentId: STRUCTURES }, "Head Structures", "Person DM");
    assert.ok(html.includes("Person DM becomes Operations lead and gets full access. Head Structures loses full access."));
    const plain = (await (await dashboardOf(TEAM_LEADER, null)).teamStructure())!;
    const none = seatOfHandedRole(plain.seats, EXTRA.head, { kind: "head", departmentId: STRUCTURES });
    assert.equal(none, null);
    assert.ok(!choice(none, { kind: "head", departmentId: STRUCTURES }, "Head Structures", "Person DM").includes("full access"));
  });
});

describe("Hand over your role (My profile)", () => {
  /** The dialog's note, as it draws it from the offer: `ConfirmDialog` renders through a portal, so the note is rendered with the dialog's own props. */
  const note = (seat: FullAccessSeat | null, successor: string | null) => renderToStaticMarkup(createElement(FullAccessMoves, { seat, successor, from: null, step: null }));

  test("a lead whose role carries a seat is offered it with the seat, and the dialog says it moves", async () => {
    const offer = (await (await dashboardOf("lead-dm", { rowId: LEAD_ROW, seat: "project-manager" })).myProfile())!.handOver!;
    assert.equal(offer.seat, "project-manager");
    assert.ok(note(offer.seat, "Person DM").includes("Person DM becomes Project Manager and gets full access. You lose full access."));
    assert.ok(note(offer.seat, null).includes("Whoever takes over becomes Project Manager and gets full access. You lose full access."), "before anyone is picked");
  });

  test("a lead with no seat: the offer carries none and the dialog says nothing of full access", async () => {
    const offer = (await (await dashboardOf("lead-dm", null)).myProfile())!.handOver!;
    assert.equal(offer.seat, null);
    assert.equal(note(offer.seat, "Person DM"), "");
  });

  test("a head whose role carries the operations lead's seat is offered it with the seat, and a head with no seat none", async () => {
    const flagged = (await (await dashboardOf("head-str", { rowId: HEAD_ROW, seat: "operations-lead" })).myProfile())!.handOver!;
    assert.equal(flagged.seat, "operations-lead");
    const plain = (await (await dashboardOf("head-str", null)).myProfile())!.handOver!;
    assert.equal(plain.seat, null);
  });
});

describe("the approver's row on the Overview", () => {
  test("a request for a role that carries a seat says, before Confirm, that full access moves", async () => {
    const overview = await (await dashboardOf("head-str", { rowId: LEAD_ROW, seat: "operations-lead" })).overview();
    const row = overview.attention.find((a) => a.kind === "hand-over")!;
    assert.ok(row.detail.endsWith("Person DM becomes Operations lead and gets full access. Lead loses full access."), row.detail);
  });

  test("a request for a role with no seat reads as before", async () => {
    const overview = await (await dashboardOf("head-str", null)).overview();
    const row = overview.attention.find((a) => a.kind === "hand-over")!;
    assert.ok(!row.detail.includes("full access"), row.detail);
  });
});

describe("the Team Leader box", () => {
  /** The drawer's note with the props it passes: the team leader's role is the team-leader seat. `SidePanel` renders through a portal. */
  const note = (outcome: "advisor" | "leave" | null) =>
    renderToStaticMarkup(
      createElement(FullAccessMoves, {
        seat: "team-leader",
        successor: "Sara Conti",
        from: null,
        step: outcome === null ? null : outcome === "leave" ? { kind: "leave" } : { kind: "advisor", place: { kind: "team" }, access: "keeps-full-access" },
      }),
    );

  test("says the new Team Leader gets full access, and what becomes of the leader's own once they choose", () => {
    assert.ok(note(null).includes("<span>Sara Conti becomes Team Leader and gets full access.</span>"));
    assert.ok(note("advisor").includes("Sara Conti becomes Team Leader and gets full access. You keep full access until the new Team Leader changes it in Access."));
    assert.ok(note("leave").includes("Sara Conti becomes Team Leader and gets full access. You lose full access."));
  });
});
