import assert from "node:assert/strict";
import { test } from "node:test";
import { attentionOf, memberLeftNotices, noticeOf } from "./notices";

const missionAnalysis = { id: 1, name: "Mission Analysis Division" };
const hardware = { id: 9, name: "Hardware Division" };

test("a leaver with roles in two divisions tells the lead of each", () => {
  const leads = [
    { memberId: 20, divisionId: 1 },
    { memberId: 30, divisionId: 9 },
    { memberId: 40, divisionId: 5 }, // leads a division the leaver was not in
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], leads, "Graduating."), [
    { recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division"], reason: "Graduating." } } },
    { recipientId: 30, notice: { kind: "member-left", data: { divisions: ["Hardware Division"], reason: "Graduating." } } },
  ]);
});

test("a lead of both divisions gets one notice naming both, and a leaving lead is not told about themselves", () => {
  const leads = [
    { memberId: 20, divisionId: 1 },
    { memberId: 20, divisionId: 9 },
    { memberId: 7, divisionId: 9 },
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], leads, null), [
    { recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division", "Hardware Division"], reason: null } } },
  ]);
});

test("a leaver whose division has no lead writes no notice", () => {
  assert.deepEqual(memberLeftNotices(7, [hardware], [{ memberId: 20, divisionId: 1 }], null), []);
  assert.deepEqual(memberLeftNotices(7, [], [], null), []);
});

test("a stored notice reads as an attention row with Dismiss; an unknown kind or bad data is not shown", () => {
  const row = {
    id: 3,
    kind: "member-left",
    subject: "Valentina Sala",
    createdAt: "2026-10-08T16:20:00Z",
    data: { divisions: ["Mission Analysis Division"], reason: "Internship abroad." },
  };
  const notice = noticeOf(row);
  assert.ok(notice);
  assert.deepEqual(attentionOf(notice, new Date("2026-10-09T12:00:00Z")), {
    kind: "notice",
    title: "Valentina Sala left the team",
    detail: 'Mission Analysis Division · 8 Oct · "Internship abroad."',
    action: { label: "Dismiss", dismissNotice: 3 },
  });
  assert.equal(noticeOf({ ...row, kind: "promoted" }), null);
  assert.equal(noticeOf({ ...row, data: { divisions: "Mission Analysis" } }), null);
});
