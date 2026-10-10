import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplyListing, Role } from "@/lib/apply/positions";
import { applicantOverview } from "./applicant-overview";
import type { ActiveApplication, ActiveStage, MyApplications, PastApplication, PastOutcome } from "./my-applications";

const slot = { id: 1, start: "2026-10-14T18:00:00+02:00", end: "2026-10-14T18:30:00+02:00" };

function active(id: number, stage: ActiveStage): ActiveApplication {
  return {
    id,
    code: `AER-MSA-${id}`,
    title: `Role ${id}`,
    department: "Aerospace",
    division: "Mission Analysis Division",
    sent: "2026-10-09T14:32:00+02:00",
    stage,
    files: [],
    answers: [],
  };
}

function past(id: number, outcome: PastOutcome): PastApplication {
  return { id, title: `Role ${id}`, department: "Operations", division: null, sent: "2026-03-03T12:00:00+01:00", outcome };
}

function mine(a: readonly ActiveApplication[], p: readonly PastApplication[] = []): MyApplications {
  return { firstName: "Chiara", email: "chiara@example.com", active: a, past: p };
}

const none: ApplyListing = { kind: "none", placeholders: [] };
const interview = (chosen: typeof slot | null, slots = [slot]): ActiveStage => ({
  kind: "interview",
  interview: { lead: "Marco Bianchi", slots, chosen },
});

test("the Next step card waits only on an interview with offered times and none picked", () => {
  assert.equal(applicantOverview("Chiara", mine([active(1, { kind: "in-review" })]), none).nextStep, null);
  assert.equal(applicantOverview("Chiara", mine([active(1, interview(slot))]), none).nextStep, null);
  assert.equal(applicantOverview("Chiara", mine([active(1, interview(null, []))]), none).nextStep, null);

  const step = applicantOverview("Chiara", mine([active(1, { kind: "received" }), active(2, interview(null))]), none).nextStep;
  assert.deepEqual(step, {
    title: "Pick an interview time for Role 2",
    detail: "The Mission Analysis lead offered 1 time. Pick the one that suits you.",
    action: { label: "Pick a time", href: "/dashboard/my-applications#application-2" },
  });
});

test("rows read open then past, each with its pill and its My applications anchor; a withdrawn one is not listed", () => {
  const overview = applicantOverview(
    "Chiara",
    mine(
      [active(1, interview(null)), active(2, { kind: "in-review" }), active(3, { kind: "received" }), active(4, { kind: "accepted" })],
      [past(5, { kind: "not-selected" }), past(6, { kind: "withdrawn" })],
    ),
    none,
  );
  assert.deepEqual(
    overview.applications.rows.map((r) => [r.id, r.pill, r.unit, r.href]),
    [
      [1, "interview", "Mission Analysis", "/dashboard/my-applications#application-1"],
      [2, "in-review", "Mission Analysis", "/dashboard/my-applications#application-2"],
      [3, "received", "Mission Analysis", "/dashboard/my-applications#application-3"],
      [4, "accepted", "Mission Analysis", "/dashboard/my-applications#application-4"],
      [5, "not-selected", "Operations", "/dashboard/my-applications#application-5"],
    ],
  );
  assert.equal(overview.applications.summary, "4 open · 1 past");
  assert.equal(overview.person.line, "Applicant · chiara@example.com");
});

test("open positions count every open role and division of /apply's listing and list the first four", () => {
  const role = (n: number, division: string): Role => ({
    key: `position-${n}`,
    title: `Role ${n}`,
    division,
    code: "",
    description: "",
    required: [],
    desirable: [],
    status: "open",
    href: `/apply/${n}-role-${n}`,
  });
  const listing: ApplyListing = {
    kind: "many",
    open: [
      { department: "Aerospace", roles: [role(1, "Avionics Division"), role(2, "Avionics Division"), role(3, "Propulsion Division")] },
      { department: "Operations", roles: [role(4, ""), role(5, "")] },
    ],
  };
  const { openPositions } = applicantOverview("Chiara", mine([active(1, { kind: "received" })]), listing);
  assert.equal(openPositions.summary, "5 roles open across 3 divisions");
  assert.deepEqual(
    openPositions.roles.map((r) => [r.title, r.unit, r.href]),
    [
      ["Role 1", "Avionics", "/apply/1-role-1"],
      ["Role 2", "Avionics", "/apply/2-role-2"],
      ["Role 3", "Propulsion", "/apply/3-role-3"],
      ["Role 4", "Operations", "/apply/4-role-4"],
    ],
  );
});
