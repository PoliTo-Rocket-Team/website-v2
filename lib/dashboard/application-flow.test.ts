import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMove,
  footerSteps,
  interviewIcs,
  joinChange,
  parseLeadMove,
  pickerWeek,
  romeTime,
  stagePill,
  slotAt,
  studiesLine,
  type ApplicationMove,
  type ApplicationState,
  type SlotTime,
} from "./application-flow";

// Where an application stands and how it moves (boards 58 to 58i, issue #171).

const now = new Date("2026-10-09T16:00:00+02:00");
const slot = (iso: string): SlotTime => slotAt(iso, 30);
const thu = slot("2026-10-15T17:30:00+02:00");
const fri = slot("2026-10-16T18:00:00+02:00");

const STATES: Record<ApplicationState["stage"], ApplicationState> = {
  new: { stage: "new" },
  "in-review": { stage: "in-review" },
  interview: { stage: "interview", offered: [thu, fri], booked: null },
  accepted: { stage: "accepted", acceptedAt: now.toISOString(), ndaArrived: false },
  joined: { stage: "joined", joinedAt: now.toISOString() },
  rejected: { stage: "rejected" },
  withdrawn: { stage: "withdrawn" },
};

function after(state: ApplicationState, move: ApplicationMove): ApplicationState {
  const result = applyMove(state, move, now);
  assert.ok(result.ok, `${move.kind} from ${state.stage}: ${result.ok ? "" : result.reason}`);
  return result.state;
}

/** The stages a move is legal from; every other stage refuses it. */
function legalFrom(move: ApplicationMove): string[] {
  return Object.values(STATES)
    .filter((s) => applyMove(s, move, now).ok)
    .map((s) => s.stage);
}

test("opening a New application moves it to In review; opening any other changes nothing", () => {
  assert.deepEqual(after(STATES.new, { kind: "open" }), { stage: "in-review" });
  for (const state of Object.values(STATES).filter((s) => s.stage !== "new")) {
    assert.deepEqual(after(state, { kind: "open" }), state);
  }
});

test("a move that leaves the state as it was reports no change, so a data source writes nothing", () => {
  const booked = after(STATES.interview, { kind: "book", start: thu.start });
  for (const state of [...Object.values(STATES), booked].filter((s) => s.stage !== "new")) {
    const opened = applyMove(state, { kind: "open" }, now);
    assert.ok(opened.ok);
    assert.equal(opened.changed, false);
  }
  const untouched = applyMove(STATES.accepted, { kind: "set-nda", arrived: false }, now);
  assert.ok(untouched.ok);
  assert.equal(untouched.changed, false);
  for (const [state, move] of [
    [STATES.new, { kind: "open" }],
    [booked, { kind: "offer-interview", slots: [thu, fri] }],
    [STATES.accepted, { kind: "set-nda", arrived: true }],
    [STATES.interview, { kind: "accept" }],
  ] as const) {
    const result = applyMove(state, move, now);
    assert.ok(result.ok);
    assert.equal(result.changed, true);
  }
});

test("each move is legal only from the stages the flow allows", () => {
  assert.deepEqual(legalFrom({ kind: "offer-interview", slots: [thu] }), ["new", "in-review", "interview"]);
  assert.deepEqual(legalFrom({ kind: "book", start: thu.start }), ["interview"]);
  assert.deepEqual(legalFrom({ kind: "accept" }), ["interview"]);
  assert.deepEqual(legalFrom({ kind: "reject" }), ["new", "in-review", "interview", "accepted"]);
  assert.deepEqual(legalFrom({ kind: "set-nda", arrived: true }), ["accepted"]);
  assert.deepEqual(legalFrom({ kind: "withdraw" }), ["new", "in-review", "interview", "accepted"]);
  // Confirm join waits for the NDA, so no stage takes it as it stands.
  assert.deepEqual(legalFrom({ kind: "confirm-join" }), []);
});

test("an interview offer needs times still to come, one length, none twice", () => {
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [] }, now).ok, false);
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [slot("2026-10-08T17:00:00+02:00")] }, now).ok, false);
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [thu, thu] }, now).ok, false);
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [thu, slotAt(fri.start, 60)] }, now).ok, false);
  assert.deepEqual(after(STATES.new, { kind: "offer-interview", slots: [fri, thu] }), { stage: "interview", offered: [thu, fri], booked: null });
});

test("Change times offers new times and clears the booking", () => {
  const booked = after(STATES.interview, { kind: "book", start: thu.start });
  assert.equal(booked.stage === "interview" && booked.booked?.slot.start, thu.start);
  assert.deepEqual(after(booked, { kind: "offer-interview", slots: [fri] }), { stage: "interview", offered: [fri], booked: null });
  assert.equal(applyMove(STATES.interview, { kind: "book", start: slot("2026-10-14T17:00:00+02:00").start }, now).ok, false);
});

test("Accept only marks the application accepted: no one joins the team", () => {
  const result = applyMove(STATES.interview, { kind: "accept" }, now);
  assert.ok(result.ok);
  assert.equal(result.joinsTeam, false);
  assert.deepEqual(result.state, { stage: "accepted", acceptedAt: now.toISOString(), ndaArrived: false });
});

test("Accept never skips the interview: from In review it is refused and the state stays as it was", () => {
  const before = { stage: "in-review" } as const;
  const result = applyMove(before, { kind: "accept" }, now);
  assert.deepEqual(result, { ok: false, reason: "Only an application at interview can be accepted." });
  assert.deepEqual(before, { stage: "in-review" });
});

test("after Accept the outlined button reads Withdraw acceptance, and it rejects", () => {
  assert.equal(footerSteps(STATES.interview)?.secondary.label, "Reject");
  const accepted = after(STATES.interview, { kind: "accept" });
  assert.deepEqual(footerSteps(accepted)?.secondary, { label: "Withdraw acceptance", move: "reject" });
  assert.deepEqual(after(accepted, { kind: "reject" }), { stage: "rejected" });
});

test("Confirm join is ready only after the NDA tick, and only it adds the person to the team", () => {
  const accepted = after(STATES.interview, { kind: "accept" });
  assert.equal(footerSteps(accepted)?.primary.ready, false);
  assert.equal(applyMove(accepted, { kind: "confirm-join" }, now).ok, false);
  assert.equal(stagePill(accepted).label, "Accepted · waiting for NDA");

  const arrived = after(accepted, { kind: "set-nda", arrived: true });
  assert.equal(footerSteps(arrived)?.primary.ready, true);
  const joined = applyMove(arrived, { kind: "confirm-join" }, now);
  assert.ok(joined.ok);
  assert.equal(joined.joinsTeam, true);
  assert.deepEqual(joined.state, { stage: "joined", joinedAt: now.toISOString() });

  // Un-ticking takes the readiness back.
  assert.equal(applyMove(after(arrived, { kind: "set-nda", arrived: false }), { kind: "confirm-join" }, now).ok, false);
  // No move but Confirm join ever adds someone.
  for (const state of Object.values(STATES)) {
    for (const move of [{ kind: "open" }, { kind: "accept" }, { kind: "reject" }, { kind: "set-nda", arrived: true }] as const) {
      const result = applyMove(state, move, now);
      assert.ok(!result.ok || !result.joinsTeam);
    }
  }
});

test("the stage pill reads the booked time, or no time yet", () => {
  assert.equal(stagePill(STATES.interview).label, "Interview · no time yet");
  const booked = after(STATES.interview, { kind: "book", start: thu.start });
  assert.equal(stagePill(booked).label, "Interview · Thu 15, 17:30");
  assert.equal(stagePill(booked).short, "Interview · Thu 15");
});

test("a move from the browser is read only in a shape the flow knows", () => {
  assert.deepEqual(parseLeadMove({ kind: "open" }), { kind: "open" });
  assert.deepEqual(parseLeadMove({ kind: "set-nda", arrived: true }), { kind: "set-nda", arrived: true });
  assert.deepEqual(parseLeadMove({ kind: "offer-interview", slots: [{ start: thu.start, end: thu.end }] }), {
    kind: "offer-interview",
    slots: [thu],
  });
  assert.equal(parseLeadMove({ kind: "offer-interview", slots: [{ start: thu.start, end: slotAt(thu.start, 25).end }] }), null);
  assert.equal(parseLeadMove({ kind: "withdraw" }), null);
  assert.equal(parseLeadMove({ kind: "book", start: thu.start }), null);
  assert.equal(parseLeadMove("accept"), null);
});

test("the picker starts on the week after a Friday, in Turin time, with past times marked", () => {
  const week = pickerWeek(now, 0);
  assert.equal(week.title, "12 – 16 October");
  assert.deepEqual(week.days.map((d) => d.label), ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16"]);
  assert.equal(week.days[3].starts[1].start, thu.start);
  const midweek = pickerWeek(new Date("2026-10-14T18:10:00+02:00"), 0);
  assert.equal(midweek.days[2].starts[2].past, true);
  assert.equal(midweek.days[2].starts[3].past, false);
  // Across the clock change on 25 October, 17:00 is still 17:00 in Turin.
  assert.equal(romeTime(2026, 10, 26, 17, 0).toISOString(), "2026-10-26T16:00:00.000Z");
});

test("Add to calendar gives the booked hour as an iCalendar event", () => {
  const ics = interviewIcs({ applicationId: 7, applicant: "Giulia Rossi", position: "Mission Analyst", slot: thu }, now);
  assert.match(ics, /DTSTART:20261015T153000Z\r\n/);
  assert.match(ics, /DTEND:20261015T160000Z\r\n/);
  assert.match(ics, /SUMMARY:Interview: Giulia Rossi\\, Mission Analyst\r\n/);
});

test("the studies column shortens the degree and the year", () => {
  assert.equal(studiesLine("Aerospace Engineering", "Year 1 Master's"), "Aerospace Eng. · MSc 1");
  assert.equal(studiesLine("Physics", "Year 3 Bachelor's"), "Physics · BSc 3");
  assert.equal(studiesLine(null, null), null);
});

test("Confirm join gives a new person a member row and a role, a returning one a role, and someone on the team nothing", () => {
  assert.equal(joinChange("applicant"), "new-member");
  assert.equal(joinChange("alumnus"), "new-role");
  assert.equal(joinChange("member"), "nothing");
});
