import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activityOf,
  activityPeople,
  filterActivity,
  OPENING_FILTERS,
  sentenceOf,
  whenLabel,
  type ActivityEntry,
  type ActivityNames,
  type LogRow,
} from "./activity-log";

// Placeholder people and accounts only (issue #642).
const NAMES: ActivityNames = {
  accounts: new Map([
    ["acct-a", { name: "Person A", memberId: 1, title: "Team Leader" }],
    ["acct-b", { name: "Person B", memberId: 2, title: "Division Lead" }],
    ["acct-c", { name: "Person C", memberId: 3, title: "Seat Title" }],
    ["acct-d", { name: "Applicant D", memberId: null, title: null }],
  ]),
  members: new Map([
    [1, "Person A"],
    [2, "Person B"],
    [3, "Person C"],
    [4, "Person E"],
  ]),
  divisions: new Map([[10, "Division X"]]),
  departments: new Map([[20, "Department Y"]]),
  positions: new Map([[30, "Role Z"]]),
  applications: new Map([[40, { accountId: "acct-d", positionId: 30 }]]),
  actingTitles: new Map([["acct-c", "Seat Title"]]),
  statuses: new Map([
    ["new", "New"],
    ["interview", "Interview"],
    ["accepted_email_sent", "Accepted · email sent"],
    ["rejected_email_to_be_sent", "Rejected · email to be sent"],
    ["nda_received", "NDA received"],
    ["second_call", "Second call"],
  ]),
};

const NOW = new Date("2026-10-25T12:00:00.000Z");
const HOUR = 60 * 60;

let nextId = 1;
function row(fields: Partial<LogRow> & Pick<LogRow, "table" | "operation">): LogRow {
  const at = fields.at ?? "2026-10-25T10:00:00.000Z";
  return {
    id: nextId++,
    schema: "public",
    recordId: null,
    before: null,
    after: null,
    label: null,
    by: "acct-a",
    acting: null,
    ...fields,
    at,
    stamp: fields.stamp ?? at,
  };
}

const read = (rows: readonly LogRow[], expiries = new Map<string, string | null>()) => activityOf(rows, NAMES, expiries, NOW, HOUR);
const sentences = (entries: readonly ActivityEntry[]) => entries.map((e) => sentenceOf(e.change));

test("a stored row reads as one plain sentence in its area", () => {
  const cases: [LogRow, string, string][] = [
    [
      row({ table: "applications", operation: "UPDATE", before: { user_id: "acct-d", apply_position_id: 30, status_key: "new" }, after: { user_id: "acct-d", apply_position_id: 30, status_key: "interview" } }),
      "Moved Applicant D to Interview for Role Z",
      "applications",
    ],
    [
      row({ table: "orders", operation: "UPDATE", before: { name: "Sheet", status: "pending", price: 120, quantity: 2 }, after: { name: "Sheet", status: "accepted", price: 120, quantity: 2 } }),
      'Approved order "Sheet" · €240.00',
      "orders",
    ],
    [row({ table: "scopes", operation: "INSERT", after: { member_id: 4, target: "content", scope: "website" } }), "Gave Content access to Person E", "access"],
    [
      row({ table: "roles", operation: "UPDATE", before: { member_id: 4, title: "Engineer", division_id: 10 }, after: { member_id: 4, title: "Lead Engineer", division_id: 10 } }),
      "Changed the role title of Person E: Engineer → Lead Engineer",
      "team-tree",
    ],
    [row({ table: "roles", operation: "INSERT", after: { member_id: 4, title: "Engineer", division_id: 10 } }), "Added Person E to Division X", "members"],
    [
      row({ table: "outreach_post_versions", operation: "INSERT", after: { version: "published" }, label: "Post title" }),
      'Published the post "Post title"',
      "outreach",
    ],
    [row({ table: "recruitment_setting", operation: "UPDATE", before: { is_open: false }, after: { is_open: true } }), "Opened recruitment", "positions"],
  ];
  for (const [stored, sentence, area] of cases) {
    const [entry] = read([stored]);
    assert.equal(sentenceOf(entry.change), sentence);
    assert.deepEqual(entry.change.kind === "write" && entry.change.area, area, sentence);
  }
});

test("the rows one write stored at once read as one change, said by the row that means most", () => {
  const at = "2026-10-25T09:00:00.000Z";
  const entries = read([
    row({ table: "interview_slots", operation: "INSERT", at, after: { application_id: 40 } }),
    row({ table: "applications", operation: "UPDATE", at, before: { user_id: "acct-d", apply_position_id: 30, status_key: "new" }, after: { user_id: "acct-d", apply_position_id: 30, status_key: "interview" } }),
    row({ table: "interview_slots", operation: "INSERT", at, after: { application_id: 40 } }),
  ]);
  assert.deepEqual(sentences(entries), ["Moved Applicant D to Interview for Role Z"]);
});

test("a personal PRT email removal's answer reads as itself, not as the PRT email it clears (issue #931)", () => {
  const at = "2026-10-25T09:00:00.000Z";
  const removal = (outcome: string) =>
    row({ table: "prt_email_removals", operation: "UPDATE", at, before: { member_id: 4, address: "e@team.test", outcome: null }, after: { member_id: 4, address: "e@team.test", outcome } });
  const cleared = row({ table: "members", operation: "UPDATE", at, before: { member_id: 4, prt_email: "e@team.test" }, after: { member_id: 4, prt_email: null } });
  assert.deepEqual(sentences(read([cleared, removal("removed")])), ["Removed e@team.test of Person E"]);
  assert.deepEqual(sentences(read([removal("kept")])), ["Kept e@team.test for Person E"]);
});

test("a sign-in email change names the old and the new address, whether the address changed on the row or the record moved rows (issue #864)", () => {
  const at = "2026-10-25T09:00:00.000Z";
  const users = (operation: string, before: Record<string, unknown> | null, after: Record<string, unknown>) => row({ table: "users", operation, at, before, after });
  const details = row({ table: "members", operation: "UPDATE", at, before: { member_id: 4, discord: null }, after: { member_id: 4, discord: null } });
  const retyped = read([details, users("UPDATE", { id: "added:1", email: "old@mail.test", member: 4 }, { id: "added:1", email: "new@mail.test", member: 4 })]);
  assert.deepEqual(sentences(retyped), ["Changed the sign-in email of Person E: old@mail.test → new@mail.test"]);
  const moved = read([
    details,
    users("INSERT", null, { id: "added:2", email: "new@mail.test", member: null }),
    users("UPDATE", { id: "added:2", email: "new@mail.test", member: null }, { id: "added:2", email: "new@mail.test", member: 4 }),
    users("UPDATE", { id: "login-old", email: "old@mail.test", member: 4 }, { id: "login-old", email: "old@mail.test", member: null }),
    row({ table: "session", schema: "better_auth", operation: "DELETE", at, before: { userId: "login-old" } }),
  ]);
  assert.deepEqual(sentences(moved), ["Changed the sign-in email of Person E: old@mail.test → new@mail.test"]);
  assert.equal(moved[0].change.kind === "write" && moved[0].change.area, "members");
  const anonymized = read([users("UPDATE", { id: "acct-d", email: "old@mail.test", anonymized_at: null }, { id: "acct-d", email: "anonymized@invalid", anonymized_at: at })]);
  assert.deepEqual(sentences(anonymized), ["Updated the details of Applicant D"], "anonymization is no sign-in email change");
});

test("a status move names the status it set by its stored name, built-in or added, and an unlisted key by the key", () => {
  const move = (before: string | null, after: string, extra: Record<string, unknown> = {}) =>
    row({
      table: "applications",
      operation: "UPDATE",
      before: { user_id: "acct-d", apply_position_id: 30, status: "accepted", status_key: before, nda_arrived_at: null },
      after: { user_id: "acct-d", apply_position_id: 30, status: "accepted", status_key: after, nda_arrived_at: null, ...extra },
    });
  const cases: [LogRow, string][] = [
    // Mark email sent writes only the status reference.
    [move("accepted_email_to_be_sent", "accepted_email_sent"), "Moved Applicant D to Accepted · email sent for Role Z"],
    [move("interview", "second_call"), "Moved Applicant D to Second call for Role Z"],
    [move("second_call", "deleted_since"), "Moved Applicant D to deleted_since for Role Z"],
    // NDA received also records the NDA's day: the status move says the write.
    [move("accepted_email_sent", "nda_received", { nda_arrived_at: "2026-10-25T10:00:00.000Z" }), "Moved Applicant D to NDA received for Role Z"],
  ];
  for (const [stored, sentence] of cases) {
    const [entry] = read([stored]);
    assert.equal(sentenceOf(entry.change), sentence);
    assert.deepEqual(entry.change.kind === "write" && entry.change.area, "applications", sentence);
  }
});

test("rows a save rewrote and rows a delete removed read as one save and one deletion", () => {
  const save = "2026-10-25T08:00:00.000Z";
  const removal = "2026-10-25T08:30:00.000Z";
  const entries = read([
    row({ table: "faq_versions", operation: "DELETE", at: save, before: { version: "draft" }, label: "A question" }),
    row({ table: "faq_versions", operation: "INSERT", at: save, after: { version: "draft" }, label: "A question" }),
    row({ table: "faqs", operation: "DELETE", at: removal, before: { id: 5 } }),
    row({ table: "faq_versions", operation: "DELETE", at: removal, before: { version: "published" }, label: "Old question" }),
  ]);
  assert.deepEqual(sentences(entries), ['Deleted the question "Old question"', 'Saved the draft question "A question"']);
});

test("saving a draft of a published record reads as the draft saved, though the save rewrote both versions", () => {
  const tables: [string, string][] = [
    ["faq_versions", "question"],
    ["outreach_post_versions", "post"],
    ["partner_versions", "partner"],
    ["project_versions", "project"],
    ["team_page_advisor_versions", "advisor"],
  ];
  for (const [table, noun] of tables) {
    const at = "2026-10-25T05:00:00.000Z";
    // What the store writes: every version removed, then the published one and the new draft written again.
    const entries = read([
      row({ table, operation: "DELETE", at, before: { version: "published" }, label: "Live label" }),
      row({ table, operation: "DELETE", at, before: { version: "draft" }, label: "Old draft label" }),
      row({ table, operation: "INSERT", at, after: { version: "published" }, label: "Live label" }),
      row({ table, operation: "INSERT", at, after: { version: "draft" }, label: "New draft label" }),
    ]);
    assert.deepEqual(sentences(entries), [`Saved the draft ${noun} "New draft label"`], table);
  }
  const publish = read([
    row({ table: "faq_versions", operation: "DELETE", before: { version: "published" }, label: "Live label" }),
    row({ table: "faq_versions", operation: "DELETE", before: { version: "draft" }, label: "Draft label" }),
    row({ table: "faq_versions", operation: "INSERT", after: { version: "published" }, label: "Draft label" }),
  ]);
  assert.deepEqual(sentences(publish), ['Published the question "Draft label"']);
});

test("unpublishing a record reads as unpublished, though the store wrote it back as a draft", () => {
  const at = "2026-10-25T05:30:00.000Z";
  // What Unpublish writes: every version removed, and what was live written back as the only draft.
  const entries = read([
    row({ table: "outreach_post_versions", operation: "DELETE", at, before: { version: "published" }, label: "Live post" }),
    row({ table: "outreach_post_versions", operation: "DELETE", at, before: { version: "draft" }, label: "Old draft" }),
    row({ table: "outreach_post_versions", operation: "INSERT", at, after: { version: "draft" }, label: "Live post" }),
  ]);
  assert.deepEqual(sentences(entries), ['Unpublished the post "Live post"']);
  assert.equal(entries[0].change.kind === "write" && entries[0].change.area, "outreach");
  const withoutDraft = read([
    row({ table: "outreach_post_versions", operation: "DELETE", before: { version: "published" }, label: "Live post" }),
    row({ table: "outreach_post_versions", operation: "INSERT", after: { version: "draft" }, label: "Live post" }),
  ]);
  assert.deepEqual(sentences(withoutDraft), ['Unpublished the post "Live post"']);
});

test("two writes by one writer within one millisecond stay two changes", () => {
  const at = "2026-10-25T04:00:00.123Z";
  const entries = read([
    row({ table: "orders", operation: "INSERT", at, stamp: "2026-10-25 04:00:00.123401+00", after: { name: "Bolts" } }),
    row({ table: "orders", operation: "INSERT", at, stamp: "2026-10-25 04:00:00.123402+00", after: { name: "Sheet" } }),
  ]);
  assert.equal(entries.length, 2);
});

test("Give access with several areas names them all; a change made during View as names both people", () => {
  const at = "2026-10-25T07:00:00.000Z";
  const [entry] = read([
    row({ table: "scopes", operation: "INSERT", at, by: "acct-b", acting: "acct-c", after: { member_id: 4, target: "orders" } }),
    row({ table: "scopes", operation: "INSERT", at, by: "acct-b", acting: "acct-c", after: { member_id: 4, target: "members" } }),
  ]);
  assert.equal(sentenceOf(entry.change), "Gave Orders and Members access to Person E");
  assert.deepEqual(entry.who, { kind: "as", id: "acct-b", name: "Person B", actingTitle: "Seat Title", actingId: "acct-c", actingName: "Person C" });
});

test("a Google account linked or removed reads as one sentence in the Account area, under the person, naming its email (issue #906)", () => {
  const google = (operation: string, email: string | null, at: string) =>
    row({ schema: "better_auth", table: "account", operation, recordId: "row-1", by: "acct-d", at, after: { email } });
  const entries = read([
    google("GOOGLE_ACCOUNT_LINK", "second@example.com", "2026-10-25T09:00:00.000Z"),
    google("GOOGLE_ACCOUNT_UNLINK", "second@example.com", "2026-10-25T10:00:00.000Z"),
    google("GOOGLE_ACCOUNT_LINK", null, "2026-10-25T08:00:00.000Z"),
  ]);
  assert.deepEqual(sentences(entries), ["Removed the Google account second@example.com", "Linked the Google account second@example.com", "Linked a Google account"]);
  assert.ok(entries.every((e) => e.change.kind === "write" && e.change.area === "account" && e.who.kind === "self" && e.who.name === "Applicant D"));
});

test("removing the account the login signs in with reads as one change naming the removal and the moved sign-in email, in the Account area (issue #949)", () => {
  const at = "2026-10-25T09:00:00.000Z";
  const google = (operation: string, recordId: string, email: string) => row({ schema: "better_auth", table: "account", operation, recordId, by: "acct-d", at, after: { email } });
  const entries = read([
    google("GOOGLE_ACCOUNT_SIGN_IN_EMAIL", "row-2", "second@example.com"),
    google("GOOGLE_ACCOUNT_UNLINK", "row-1", "first@example.com"),
  ]);
  assert.deepEqual(sentences(entries), ["Removed the Google account first@example.com and changed their sign-in email to second@example.com"]);
  assert.ok(entries.every((e) => e.change.kind === "write" && e.change.area === "account" && e.who.kind === "self"));
});

test("a write stored under no account is left out", () => {
  assert.deepEqual(read([row({ table: "orders", operation: "INSERT", by: null, after: { name: "Sheet" } })]), []);
});

const viewAs = (operation: "VIEW_AS_START" | "VIEW_AS_STOP", session: string, at: string, person = "acct-b") =>
  row({ schema: "better_auth", table: "session", operation, recordId: session, at, by: "acct-c", after: { personId: person, actingAccountId: "acct-c" } });

test("View as starts and stops are rows of their own, under the acting person", () => {
  const entries = read([viewAs("VIEW_AS_START", "s1", "2026-10-25T10:00:00.000Z"), viewAs("VIEW_AS_STOP", "s1", "2026-10-25T10:20:00.000Z")]);
  assert.deepEqual(sentences(entries), ["View as stopped: Person B", "View as started: Person B"]);
  assert.ok(entries.every((e) => e.who.kind === "self" && e.who.name === "Person C"));
});

test("a start with no stop ends by timeout at its session's expiry once that has passed, and is still open before", () => {
  const expired = read([viewAs("VIEW_AS_START", "s2", "2026-10-25T09:00:00.000Z")], new Map([["s2", "2026-10-25T10:00:00.000Z"]]));
  assert.deepEqual(sentences(expired), ["View as ended by timeout: Person B", "View as started: Person B"]);
  assert.equal(expired[0].at, "2026-10-25T10:00:00.000Z");

  const open = read([viewAs("VIEW_AS_START", "s3", "2026-10-25T11:30:00.000Z")], new Map([["s3", "2026-10-25T12:30:00.000Z"]]));
  assert.deepEqual(sentences(open), ["View as started: Person B"]);
});

test("a start whose session row is gone times out one session length after it started", () => {
  const entries = read([viewAs("VIEW_AS_START", "s4", "2026-10-25T08:00:00.000Z")], new Map([["s4", null]]));
  assert.equal(entries[0].change.kind === "view-as" && entries[0].change.event, "timeout");
  assert.equal(entries[0].at, "2026-10-25T09:00:00.000Z");
});

test("each filter narrows the list, and they combine", () => {
  const entries = read([
    row({ table: "orders", operation: "INSERT", at: "2026-10-25T06:00:00.000Z", by: "acct-b", after: { name: "Bolts" } }),
    row({ table: "scopes", operation: "INSERT", at: "2026-10-24T06:00:00.000Z", by: "acct-b", acting: "acct-c", after: { member_id: 4, target: "orders" } }),
    row({ table: "orders", operation: "INSERT", at: "2026-08-01T06:00:00.000Z", by: "acct-a", after: { name: "Sheet" } }),
    viewAs("VIEW_AS_START", "s5", "2026-10-25T11:00:00.000Z"),
    viewAs("VIEW_AS_STOP", "s5", "2026-10-25T11:10:00.000Z"),
  ]);
  const keep = (filters: Partial<typeof OPENING_FILTERS>) => sentences(filterActivity(entries, { ...OPENING_FILTERS, range: null, ...filters }, NOW));
  assert.equal(keep({}).length, 5);
  assert.equal(keep({ range: 30 }).includes('Requested "Sheet"'), false);
  assert.deepEqual(keep({ viewAsOnly: true }), ["View as stopped: Person B", "View as started: Person B", "Gave Orders access to Person E"]);
  assert.deepEqual(keep({ area: "orders" }), ['Requested "Bolts"', 'Requested "Sheet"']);
  assert.deepEqual(keep({ personId: "acct-a" }), ['Requested "Sheet"']);
  // The acting person finds the changes they made while viewing as someone else.
  assert.deepEqual(keep({ personId: "acct-c", area: "access" }), ["Gave Orders access to Person E"]);
  assert.deepEqual(keep({ query: "bolts" }), ['Requested "Bolts"']);
  assert.deepEqual(keep({ query: "seat title access" }), ["Gave Orders access to Person E"]);
  assert.deepEqual(
    activityPeople(entries).map((p) => p.name),
    ["Person A", "Person B", "Person C"],
  );
});

test("the Person filter lists a person who was only viewed as, and keeps the View as rows of their sessions", () => {
  const entries = read(
    [
      row({ table: "orders", operation: "INSERT", at: "2026-10-25T06:00:00.000Z", by: "acct-b", after: { name: "Bolts" } }),
      viewAs("VIEW_AS_START", "s6", "2026-10-25T07:00:00.000Z", "acct-d"),
      viewAs("VIEW_AS_STOP", "s6", "2026-10-25T07:10:00.000Z", "acct-d"),
      viewAs("VIEW_AS_START", "s7", "2026-10-25T08:00:00.000Z", "acct-d"),
    ],
    new Map([["s7", "2026-10-25T09:00:00.000Z"]]),
  );
  assert.ok(activityPeople(entries).some((p) => p.id === "acct-d" && p.name === "Applicant D"));
  assert.deepEqual(sentences(filterActivity(entries, { ...OPENING_FILTERS, range: null, personId: "acct-d" }, NOW)), [
    "View as ended by timeout: Applicant D",
    "View as started: Applicant D",
    "View as stopped: Applicant D",
    "View as started: Applicant D",
  ]);
});

test("the When column counts days on Turin's clock", () => {
  assert.equal(whenLabel("2026-10-25T12:32:00.000Z", NOW), "Today 13:32");
  assert.equal(whenLabel("2026-10-24T20:41:00.000Z", NOW), "Yesterday 22:41");
  assert.equal(whenLabel("2026-10-20T17:40:00.000Z", NOW), "Tue 20 Oct 19:40");
  assert.equal(whenLabel("2025-10-20T17:40:00.000Z", NOW), "Mon 20 Oct 2025 19:40");
});
