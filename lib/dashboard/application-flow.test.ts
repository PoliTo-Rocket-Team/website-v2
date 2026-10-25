import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMove,
  checkOffer,
  interviewIcs,
  joinChange,
  leadSteps,
  memberDivisionNames,
  memberStanding,
  NEW_APPLICANT,
  parseLeadMove,
  pickedCount,
  pickerFirstMonth,
  pickerFirstWeekOf,
  pickerMonth,
  pickerWeek,
  romeTime,
  timesOnDay,
  statusPill,
  slotAt,
  studiesLine,
  takenByJoinElsewhere,
  type ApplicationMove,
  type ApplicationState,
  type LeadMove,
  type SlotTime,
} from "./application-flow";
import type { BuiltInStatusKey } from "./application-status";
import { placeOf, type Interview } from "./my-applications";
import { membershipsOf } from "./team";

// Where an application stands and how it moves (boards 58 to 58i and 97 to
// 97e, issues #171 and #749).

const now = new Date("2026-10-09T16:00:00+02:00");
const NEW = NEW_APPLICANT;
/** On the team in two other divisions (board 58h2). */
const MATTEO_DIVISIONS = membershipsOf([
  { divisionId: 2, role: "member", since: "2024-10-01" },
  { divisionId: 3, role: "lead", since: "2025-10-01" },
]);
const DIVISION_NAMES: Record<number, string> = { 2: "Optimization and Analysis Division", 3: "Design & Manufacturing" };
const MATTEO = memberStanding(MATTEO_DIVISIONS, (id) => DIVISION_NAMES[id], 1, 2024);
const slot = (iso: string): SlotTime => slotAt(iso, 30);
const thu = slot("2026-10-15T17:30:00+02:00");
const fri = slot("2026-10-16T18:00:00+02:00");
const acceptedDay = "2026-10-05T10:00:00.000Z";

const STATES: Record<BuiltInStatusKey, ApplicationState> = {
  new: { status: "new" },
  interview: { status: "interview", offered: [thu, fri], booked: null },
  accepted_email_to_be_sent: { status: "accepted_email_to_be_sent", acceptedAt: acceptedDay },
  accepted_email_sent: { status: "accepted_email_sent", acceptedAt: acceptedDay },
  nda_received: { status: "nda_received", acceptedAt: acceptedDay },
  joined: { status: "joined", joinedAt: acceptedDay },
  rejected_email_to_be_sent: { status: "rejected_email_to_be_sent" },
  rejected_email_sent: { status: "rejected_email_sent" },
  accepted_for_another_position: { status: "accepted_for_another_position" },
  withdrawn: { status: "withdrawn" },
};

function after(state: ApplicationState, move: ApplicationMove): ApplicationState {
  const result = applyMove(state, move, now);
  assert.ok(result.ok, `${move.kind} from ${state.status}: ${result.ok ? "" : result.reason}`);
  return result.state;
}

/** One of each lead move, with times still to come for an offer. */
const LEAD_MOVES: readonly LeadMove[] = [
  { kind: "offer-interview", slots: [thu] },
  { kind: "accept" },
  { kind: "reject" },
  { kind: "withdraw-acceptance" },
  { kind: "mark-email-sent" },
  { kind: "nda-received" },
  { kind: "confirm-join" },
];

/**
 * The owner's button table (2026-10-25, on epic #588), as the owner wrote it:
 * each built-in status's buttons, in order, and the status each one sets.
 */
const OWNER_TABLE: Record<BuiltInStatusKey, readonly (readonly [label: string, move: LeadMove["kind"], sets: BuiltInStatusKey])[]> = {
  new: [
    ["Move to interview", "offer-interview", "interview"],
    ["Reject", "reject", "rejected_email_to_be_sent"],
  ],
  interview: [
    ["Change times", "offer-interview", "interview"],
    ["Accept", "accept", "accepted_email_to_be_sent"],
    ["Reject", "reject", "rejected_email_to_be_sent"],
  ],
  accepted_email_to_be_sent: [
    ["Mark email sent", "mark-email-sent", "accepted_email_sent"],
    ["Withdraw acceptance", "withdraw-acceptance", "new"],
  ],
  accepted_email_sent: [["NDA received", "nda-received", "nda_received"]],
  nda_received: [["Confirm join", "confirm-join", "joined"]],
  rejected_email_to_be_sent: [["Mark email sent", "mark-email-sent", "rejected_email_sent"]],
  joined: [],
  withdrawn: [],
  rejected_email_sent: [],
  accepted_for_another_position: [],
};

for (const [status, row] of Object.entries(OWNER_TABLE) as [BuiltInStatusKey, (typeof OWNER_TABLE)[BuiltInStatusKey]][]) {
  test(`${status}: offers exactly the table's buttons, and each sets the status the table names`, () => {
    assert.deepEqual(
      leadSteps(status).map((s) => [s.label, s.move, s.sets]),
      row.map((r) => [...r]),
    );
    // The move a button runs is legal here and lands on the status the table names; every other lead move is refused.
    for (const move of LEAD_MOVES) {
      const result = applyMove(STATES[status], move, now);
      const button = row.find(([, kind]) => kind === move.kind);
      if (button) {
        assert.ok(result.ok, `${move.kind} from ${status}: ${result.ok ? "" : result.reason}`);
        assert.equal(result.state.status, button[2], `${move.kind} from ${status}`);
      } else {
        assert.equal(result.ok, false, `${move.kind} is refused from ${status}`);
      }
    }
  });
}

test("an added status offers its parent's buttons", () => {
  const secondInterview = { kind: "added", key: "second_interview", parent: "interview" } as const;
  assert.deepEqual(leadSteps(secondInterview), leadSteps("interview"));
  assert.deepEqual(leadSteps({ kind: "added", key: "waiting_for_papers", parent: "nda_received" }), leadSteps("nda_received"));
  assert.deepEqual(leadSteps({ kind: "added", key: "on_hold", parent: "joined" }), []);
});

test("Accept records the day, and the email and NDA statuses after it keep that day", () => {
  const accepted = after(STATES.interview, { kind: "accept" });
  assert.deepEqual(accepted, { status: "accepted_email_to_be_sent", acceptedAt: now.toISOString() });
  const sent = after(accepted, { kind: "mark-email-sent" });
  assert.deepEqual(sent, { status: "accepted_email_sent", acceptedAt: now.toISOString() });
  assert.deepEqual(after(sent, { kind: "nda-received" }), { status: "nda_received", acceptedAt: now.toISOString() });
});

test("only Confirm join adds the person to the team", () => {
  const joined = applyMove(STATES.nda_received, { kind: "confirm-join" }, now);
  assert.ok(joined.ok);
  assert.equal(joined.joinsTeam, true);
  assert.deepEqual(joined.state, { status: "joined", joinedAt: now.toISOString() });
  for (const state of Object.values(STATES)) {
    for (const move of LEAD_MOVES.filter((m) => m.kind !== "confirm-join")) {
      const result = applyMove(state, move, now);
      assert.ok(!result.ok || !result.joinsTeam, `${move.kind} from ${state.status}`);
    }
  }
});

test("Confirm join sets a person's other open applications to Accepted for another position, and none of their decided ones", () => {
  const open: BuiltInStatusKey[] = ["new", "interview", "accepted_email_to_be_sent", "accepted_email_sent", "nda_received"];
  for (const status of Object.keys(STATES) as BuiltInStatusKey[]) {
    assert.equal(takenByJoinElsewhere({ kind: "built-in", key: status }), open.includes(status), status);
  }
  // An added status goes with its parent.
  assert.equal(takenByJoinElsewhere({ kind: "added", key: "second_interview", parent: "interview" }), true);
  assert.equal(takenByJoinElsewhere({ kind: "added", key: "late_refusal", parent: "rejected_email_sent" }), false);
});

test("a person already on the team reaches Joined only through NDA received and Confirm join (ADR 0014, 2026-10-25)", () => {
  // The standing changes nothing about the buttons: Confirm join is offered only from NDA received.
  for (const status of Object.keys(STATES) as BuiltInStatusKey[]) {
    const joins = leadSteps(status).some((s) => s.move === "confirm-join");
    assert.equal(joins, status === "nda_received", status);
  }
  const accepted = after(STATES.interview, { kind: "accept" });
  assert.equal(applyMove(accepted, { kind: "confirm-join" }, now).ok, false);
  assert.equal(applyMove(after(accepted, { kind: "mark-email-sent" }), { kind: "confirm-join" }, now).ok, false);
  // What Confirm join adds for them is still only the new division (board 58h2).
  assert.equal(joinChange(MATTEO), "new-division");
});

test("the applicant withdraws an open application only", () => {
  for (const status of Object.keys(STATES) as BuiltInStatusKey[]) {
    const result = applyMove(STATES[status], { kind: "withdraw" }, now);
    const open = ["new", "interview", "accepted_email_to_be_sent", "accepted_email_sent", "nda_received"].includes(status);
    assert.equal(result.ok, open, status);
    if (result.ok) assert.deepEqual(result.state, { status: "withdrawn" });
  }
});

test("Change times to the times already offered reports no change, so a data source writes nothing", () => {
  const again = applyMove(STATES.interview, { kind: "offer-interview", slots: [thu, fri] }, now);
  assert.ok(again.ok);
  assert.equal(again.changed, false);
});

test("an interview offer needs times still to come, one length, none twice", () => {
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [] }, now).ok, false);
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [slot("2026-10-08T17:00:00+02:00")] }, now).ok, false);
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [thu, thu] }, now).ok, false);
  assert.equal(applyMove(STATES.new, { kind: "offer-interview", slots: [thu, slotAt(fri.start, 60)] }, now).ok, false);
  assert.deepEqual(after(STATES.new, { kind: "offer-interview", slots: [fri, thu] }), { status: "interview", offered: [thu, fri], booked: null });
});

test("Change times offers new times and clears the booking", () => {
  const booked = after(STATES.interview, { kind: "book", start: thu.start });
  assert.equal(booked.status === "interview" && booked.booked?.slot.start, thu.start);
  assert.deepEqual(after(booked, { kind: "offer-interview", slots: [fri] }), { status: "interview", offered: [fri], booked: null });
  assert.equal(applyMove(STATES.interview, { kind: "book", start: slot("2026-10-14T17:00:00+02:00").start }, now).ok, false);
});

test("the status pill reads the booked time, or no time yet, and every other status by its name", () => {
  assert.equal(statusPill(STATES.interview).label, "Interview · no time yet");
  const booked = after(STATES.interview, { kind: "book", start: thu.start });
  assert.equal(statusPill(booked).label, "Interview · Thu 15, 17:30");
  assert.equal(statusPill(booked).short, "Interview · Thu 15");
  assert.equal(statusPill(STATES.accepted_email_to_be_sent).label, "Accepted · email to be sent");
});

test("a move from the browser is read only in a shape the flow knows", () => {
  assert.deepEqual(parseLeadMove({ kind: "mark-email-sent" }), { kind: "mark-email-sent" });
  assert.deepEqual(parseLeadMove({ kind: "offer-interview", slots: [{ start: thu.start, end: thu.end }] }), {
    kind: "offer-interview",
    slots: [thu],
  });
  assert.equal(parseLeadMove({ kind: "offer-interview", slots: [{ start: thu.start, end: slotAt(thu.start, 25).end }] }), null);
  // Opening no longer moves an application (ruling R1.2 on #745), and the NDA tick is now the NDA received button.
  assert.equal(parseLeadMove({ kind: "open" }), null);
  assert.equal(parseLeadMove({ kind: "set-nda", arrived: true }), null);
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

test("the picker has no last week: week 10 is a whole week of times to come", () => {
  const week = pickerWeek(now, 10);
  assert.equal(week.title, "21 – 25 December");
  assert.deepEqual(week.month, { year: 2026, month: 12 });
  assert.deepEqual(week.days.map((d) => d.label), ["Mon 21", "Tue 22", "Wed 23", "Thu 24", "Fri 25"]);
  // Winter time in Turin: 17:00 is 16:00 UTC.
  assert.equal(week.days[0].starts[0].start, "2026-12-21T16:00:00.000Z");
  assert.ok(week.days.every((d) => d.starts.every((s) => !s.past)));
});

test("the header names the month holding most of a week's days, and the selector lands on that month's first week", () => {
  assert.deepEqual(pickerWeek(now, 0).month, { year: 2026, month: 10 });
  // 26 – 30 October; 2 November is the first week November names, as 1 November is a Sunday.
  assert.deepEqual(pickerWeek(now, 2).month, { year: 2026, month: 10 });
  assert.equal(pickerFirstWeekOf(now, { year: 2026, month: 11 }), 3);
  assert.equal(pickerWeek(now, 3).title, "2 – 6 November");
  // 1 December is a Tuesday: the week of 30 November belongs to December.
  assert.equal(pickerFirstWeekOf(now, { year: 2026, month: 12 }), 7);
  assert.equal(pickerWeek(now, 7).title, "30 Nov – 4 Dec");
  // The first month, and any before it, starts on the first week.
  assert.deepEqual(pickerFirstMonth(now), { year: 2026, month: 10 });
  assert.equal(pickerFirstWeekOf(now, { year: 2026, month: 10 }), 0);
  assert.equal(pickerFirstWeekOf(now, { year: 2026, month: 9 }), 0);
});

test("the month grid runs Monday to Sunday, marks today and past days, and counts picked times per Turin day", () => {
  const picked = [
    thu.start,
    slot("2026-10-15T18:00:00+02:00").start,
    fri.start,
    // 17:00 on 26 October, after the clock change.
    "2026-10-26T16:00:00.000Z",
  ];
  const month = pickerMonth(now, { year: 2026, month: 10 }, picked);
  assert.equal(month.title, "October 2026");
  // 1 October 2026 is a Thursday: the grid opens on Monday 28 September and closes on Sunday 1 November.
  assert.equal(month.days.length, 35);
  const day = (date: string) => {
    const found = month.days.find((d) => d.date === date);
    assert.ok(found, date);
    return found;
  };
  assert.deepEqual(day("2026-09-28"), { date: "2026-09-28", day: 28, label: "Mon 28 Sep", inMonth: false, today: false, count: 0, past: true });
  assert.equal(month.days[month.days.length - 1].date, "2026-11-01");
  assert.equal(day("2026-11-01").inMonth, false);
  assert.equal(day("2026-10-08").past, true);
  // Today, a Friday, is not past; the picker starts from tomorrow, so it opens the first week.
  assert.deepEqual(day("2026-10-09"), { date: "2026-10-09", day: 9, label: "Fri 9 Oct", inMonth: true, today: true, count: 0, past: false, week: 0 });
  assert.deepEqual(day("2026-10-11"), { date: "2026-10-11", day: 11, label: "Sun 11 Oct", inMonth: true, today: false, count: 0, past: false, week: 0 });
  assert.deepEqual(day("2026-10-15"), { date: "2026-10-15", day: 15, label: "Thu 15 Oct", inMonth: true, today: false, count: 2, past: false, week: 0 });
  assert.equal(day("2026-10-16").count, 1);
  assert.deepEqual(day("2026-10-26"), { date: "2026-10-26", day: 26, label: "Mon 26 Oct", inMonth: true, today: false, count: 1, past: false, week: 2 });
  assert.equal(month.days.filter((d) => d.today).length, 1);
});

test("a time late in the UTC day counts on its Turin day", () => {
  const month = pickerMonth(now, { year: 2026, month: 10 }, ["2026-10-20T23:30:00.000Z"]);
  assert.equal(month.days.find((d) => d.date === "2026-10-21")?.count, 1);
  assert.equal(month.days.find((d) => d.date === "2026-10-20")?.count, 0);
});

test("the count line gives the times and the days they fall on", () => {
  assert.equal(pickedCount([]), "0 times picked across 0 days");
  assert.equal(pickedCount([thu.start]), "1 time picked across 1 day");
  assert.equal(pickedCount([thu.start, slot("2026-10-15T18:00:00+02:00").start]), "2 times picked across 1 day");
  assert.equal(pickedCount([thu.start, fri.start, "2026-12-21T16:00:00.000Z"]), "3 times picked across 3 days");
  assert.equal(timesOnDay(1), "1 time");
  assert.equal(timesOnDay(2), "2 times");
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

test("Confirm join gives a new person a member row, a returning one a role, a member the new division, and someone already in it nothing", () => {
  assert.equal(joinChange(NEW), "new-member");
  assert.equal(joinChange({ kind: "alumnus" }), "new-role");
  assert.equal(joinChange(MATTEO), "new-division");
  assert.equal(joinChange(memberStanding(MATTEO_DIVISIONS, (id) => DIVISION_NAMES[id], 3, 2024)), "nothing");
  // The dialogs name their divisions home first: the one they lead.
  assert.deepEqual(memberDivisionNames(MATTEO), ["Design & Manufacturing", "Optimization and Analysis"]);
});

test("a time offered more than 4 weeks ahead passes the offer and reaches the applicant's picker (#212, #222)", () => {
  // Ten weeks after `now`: past the old 4-week picker limit that #212 removed.
  const farAhead = slot("2026-12-17T17:30:00+01:00");
  assert.ok(Date.parse(farAhead.start) - now.getTime() > 4 * 7 * 24 * 60 * 60 * 1000);

  const offer = checkOffer([farAhead], now);
  assert.ok(offer.ok, offer.ok ? "" : offer.reason);
  assert.deepEqual(after(STATES.new, { kind: "offer-interview", slots: [farAhead] }), {
    status: "interview",
    offered: [farAhead],
    booked: null,
  });

  // The applicant's side (board 50c): the stored offer comes back as their interview stage.
  const interview: Interview = { lead: "Marco Bianchi", slots: [{ id: 1, start: farAhead.start, end: farAhead.end }], chosen: null };
  const place = placeOf({ status: "interview", appliedAt: "2026-10-01T09:00:00.000Z", withdrawnAt: null, acceptedAt: null, rejectedAt: null, joinedAt: null }, interview, null);
  assert.deepEqual(place, { kind: "active", stage: { kind: "interview", interview } });
});
