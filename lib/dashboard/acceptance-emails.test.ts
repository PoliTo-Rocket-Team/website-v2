import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptanceEmailsFor, acceptanceEmailsToSend, copyAllLine, type AcceptanceCandidate } from "./acceptance-emails";
import type { ApplicationStatus } from "./application-status";
import { viewerStandingOf, type ActiveRoleRef } from "./viewer";

// Issue #744 (board 100): the team leader's list of applications waiting for
// their acceptance email, which only the team leader is sent.

type Candidate = AcceptanceCandidate & { readonly id: number; readonly email: string };

const builtIn = (key: Extract<ApplicationStatus, { kind: "built-in" }>["key"]): ApplicationStatus => ({ kind: "built-in", key });

const toBeSent: Candidate = { id: 1, email: "a@example.com", status: builtIn("accepted_email_to_be_sent"), acceptedAt: "2026-10-12T10:00:00.000Z" };
const addedUnder: Candidate = {
  id: 2,
  email: "b@example.com",
  status: { kind: "added", key: "waiting_for_nda_draft_x1", parent: "accepted_email_to_be_sent" },
  acceptedAt: "2026-10-08T10:00:00.000Z",
};
const alreadySent: Candidate = { id: 3, email: "c@example.com", status: builtIn("accepted_email_sent"), acceptedAt: "2026-10-01T10:00:00.000Z" };
const addedElsewhere: Candidate = {
  id: 4,
  email: "d@example.com",
  status: { kind: "added", key: "second_interview_x2", parent: "interview" },
  acceptedAt: null,
};

test("the list holds the built-in status and a status added under it, oldest acceptance first, and nothing else", () => {
  const listed = acceptanceEmailsToSend([alreadySent, toBeSent, addedElsewhere, addedUnder]);
  assert.deepEqual(
    listed.map((c) => c.id),
    [2, 1],
  );
});

test("an application with no stored acceptance day goes last", () => {
  const undated: Candidate = { ...toBeSent, id: 5, acceptedAt: null };
  assert.deepEqual(
    acceptanceEmailsToSend([undated, toBeSent, addedUnder]).map((c) => c.id),
    [2, 1, 5],
  );
});

test("copy all copies every listed email, the hidden rows included, once each, comma-separated", () => {
  const many = Array.from({ length: 7 }, (_, i): Candidate => ({ ...toBeSent, id: 10 + i, email: `p${i}@example.com` }));
  const twice: Candidate = { ...addedUnder, id: 30, email: "p0@example.com" };
  assert.equal(
    copyAllLine(acceptanceEmailsToSend([...many, twice])),
    "p0@example.com, p1@example.com, p2@example.com, p3@example.com, p4@example.com, p5@example.com, p6@example.com",
  );
});

test("only the team leader gets the list; a division lead and a department head get none", () => {
  const viewer = (roles: ActiveRoleRef[]) => viewerStandingOf({ scopes: [], activeRoles: roles });
  const teamLeader = viewer([{ type: "president", divisionId: null, divisionCode: null, divisionClosedAt: null, fullAccess: null }]);
  const head = viewer([{ type: "head", divisionId: null, divisionCode: null, divisionClosedAt: null, fullAccess: null }]);
  const lead = viewer([{ type: "lead", divisionId: 1, divisionCode: null, divisionClosedAt: null, fullAccess: null }]);
  const all = [toBeSent, addedUnder, alreadySent];
  assert.deepEqual(
    acceptanceEmailsFor(teamLeader, all)?.map((c) => c.id),
    [2, 1],
  );
  assert.equal(acceptanceEmailsFor(head, all), null);
  assert.equal(acceptanceEmailsFor(lead, all), null);
});
