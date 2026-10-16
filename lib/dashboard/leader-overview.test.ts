import assert from "node:assert/strict";
import { test } from "node:test";
import { departmentSummaries, leaderAttention } from "./leader-overview";
import { membershipsOf, type OrgChart } from "./team";

const NOW = new Date("2026-10-09T16:00:00+02:00");

const order = (status: "waiting" | "approved" | "changes-requested" | "rejected", item: string, requestedOn: string, requestedBy = "Marco Bianchi") => ({
  status,
  item,
  requestedOn,
  requestedBy,
});

test("Needs your attention holds the orders to decide, then the approved orders not ordered (board 72)", () => {
  const items = leaderAttention({
    orders: [
      order("waiting", "Loctite", "2026-10-07"),
      order("approved", "Pitot tube", "2026-09-20"),
      order("waiting", "Steel wire", "2026-10-09"),
      order("rejected", "Drone", "2026-09-01"),
      order("waiting", "Bolts", "2026-10-05", "Sara Conti"),
      order("approved", "Loctite", "2026-09-22"),
      order("changes-requested", "Epoxy", "2026-09-30"),
    ],
    now: NOW,
  });
  assert.deepEqual(
    items.map((i) => [i.kind, i.title, i.detail]),
    [
      ["orders-to-decide", "3 orders wait for your decision", "Oldest: Bolts, sent 5 Oct by Sara Conti"],
      ["approved-orders", "2 approved orders are not ordered yet", "Pitot tube, Loctite"],
    ],
  );
});

test("the approved row names three items and counts the rest", () => {
  const items = ["Loctite", "Pitot tube", "Epoxy", "SD cards", "Bolts"].map((item) => order("approved", item, "2026-09-20"));
  assert.equal(leaderAttention({ orders: items, now: NOW })[0].detail, "Loctite, Pitot tube, Epoxy and 2 more");
});

test("an attention row with nothing to say is left out, and one order or one approval reads in the singular", () => {
  assert.deepEqual(leaderAttention({ orders: [], now: NOW }), []);
  const items = leaderAttention({ orders: [order("waiting", "Steel wire", "2026-10-09"), order("approved", "Pitot tube", "2026-09-20")], now: NOW });
  assert.deepEqual(
    items.map((i) => i.title),
    ["1 order waits for your decision", "1 approved order is not ordered yet"],
  );
});

test("the Departments panel counts each department's heads, divisions and people once, with what waits there", () => {
  const org: OrgChart = {
    departments: [
      { id: 1, name: "Aerodynamics" },
      { id: 2, name: "Structures" },
    ],
    divisions: [
      { id: 10, name: "Mission Analysis Division", departmentId: 1 },
      { id: 11, name: "Optimization and Analysis Division", departmentId: 1 },
      { id: 20, name: "Design & Manufacturing Division", departmentId: 2 },
    ],
  };
  const person = (name: string, divisions: readonly number[], headOf: number | null = null) => ({
    name,
    memberships: membershipsOf(divisions.map((divisionId) => ({ divisionId, role: "member" as const, since: "2025-10-01" }))),
    beyondDivisions: headOf === null ? [] : [{ kind: "head" as const, departmentId: headOf }],
  });
  const summaries = departmentSummaries(
    [person("Chiara", [], 1), person("Anna", [10, 11]), person("Matteo", [20, 11]), person("Luca", [10])],
    org,
    [
      { divisionId: 10, open: true, newApplications: 4 },
      { divisionId: 11, open: false, newApplications: 1 },
      { divisionId: 20, open: true, newApplications: 0 },
    ],
  );
  assert.deepEqual(summaries, [
    { id: 1, name: "Aerodynamics", heads: ["Chiara"], divisions: 2, people: 4, newApplications: 5, openPositions: 1 },
    { id: 2, name: "Structures", heads: [], divisions: 1, people: 1, newApplications: 0, openPositions: 1 },
  ]);
});
