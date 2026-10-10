import assert from "node:assert/strict";
import { test } from "node:test";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { dummyApplyData, SentApplications } from "./apply";
import { NO_EDITS, type TeamEdits } from "./edits";
import { dummyDashboardData } from "./index";
import {
  NO_OWN_CHANGES,
  ownApplicationsStartOf,
  parseOwnChanges,
  serializeOwnChanges,
  type OwnApplicationsStart,
  type OwnChanges,
} from "./own";
import { DEFAULT_DUMMY_RECRUITMENT, dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// The viewer's own pages on a preview (issue #169): each write goes through
// the dashboard data interface, lands in the test developer's cookies, and
// the next request reads it back from there.

/** One browser: the cookies a write saves are what the next request reads. */
function browser(start: OwnApplicationsStart = "sample") {
  let own: OwnChanges = NO_OWN_CHANGES;
  let edits: TeamEdits = NO_EDITS;
  const open = (kind: ViewerKind) =>
    dummyDashboardData(
      kind,
      { current: dummyRecruitmentOf(undefined), save: async () => {} },
      { current: EMPTY_DUMMY_STATE, save: async () => {} },
      { current: edits, save: async (next) => void (edits = next) },
      // Through the cookie's own text, as the real request does.
      { current: parseOwnChanges(serializeOwnChanges(own)), save: async (next) => void (own = next) },
      start,
    );
  return { open, own: () => own };
}

test("withdrawing an application moves it to Past as Withdrawn, and the person can apply again", async () => {
  const { open, own } = browser();
  const before = (await open("non-member").myApplications())!;
  const target = before.active.find((a) => a.stage.kind === "in-review")!;

  assert.deepEqual(await open("non-member").withdrawApplication(target.id), { ok: true, value: null });

  const after = (await open("non-member").myApplications())!;
  assert.equal(after.active.some((a) => a.id === target.id), false);
  assert.deepEqual(after.past.find((p) => p.id === target.id)?.outcome, { kind: "withdrawn" });

  const apply = dummyApplyData("non-member", null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications(), own());
  const me = (await apply.applicant())!;
  const withdrawnPosition = (await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => apply.position(id)))).find(
    (r) => r?.position.title === target.title,
  )!.position.id;
  assert.equal(await apply.hasApplied(me.id, withdrawnPosition), false);
});

test("a non-member signed in with applications=none has an empty My applications and can apply anywhere (issue #179)", async () => {
  const { open, own } = browser(ownApplicationsStartOf("none"));
  const data = open("non-member");
  const mine = await data.myApplications();
  assert.deepEqual([mine?.active, mine?.past], [[], []]);
  assert.equal(await data.hasOwnApplications(), false);
  assert.equal((await data.myAccount())?.openApplications, 0);

  // Position 1 is the sample set's interview; with none sent, it is open to them.
  const apply = dummyApplyData("non-member", null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications(), own(), "none");
  assert.equal(await apply.hasApplied((await apply.applicant())!.id, 1), false);
  // The sample set still has it.
  const sample = dummyApplyData("non-member", null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications(), own());
  assert.equal(await sample.hasApplied((await sample.applicant())!.id, 1), true);
});

test("a non-member signed in with applications=withdrawn has only withdrawn applications and keeps the Overview (issue #227)", async () => {
  const { open } = browser(ownApplicationsStartOf("withdrawn"));
  const data = open("non-member");
  const mine = (await data.myApplications())!;
  assert.deepEqual(mine.active, []);
  assert.ok(mine.past.length > 0);
  assert.ok(mine.past.every((p) => p.outcome.kind === "withdrawn"));
  // They have applied, so the Overview stays theirs (lib/dashboard/access.ts).
  assert.equal(await data.hasOwnApplications(), true);
  assert.equal((await data.myAccount())?.openApplications, 0);
});

test("an accepted application cannot be withdrawn", async () => {
  const { open, own } = browser();
  const accepted = (await open("non-member").myApplications())!.active.find((a) => a.stage.kind === "accepted")!;
  assert.equal((await open("non-member").withdrawApplication(accepted.id)).ok, false);
  assert.deepEqual(own(), NO_OWN_CHANGES);
});

test("the applicant picks one offered interview time, and it is kept", async () => {
  const { open } = browser();
  const card = (await open("non-member").myApplications())!.active.find((a) => a.stage.kind === "interview")!;
  assert.equal(card.stage.kind, "interview");
  const offered = card.stage.kind === "interview" ? card.stage.interview.slots : [];
  const pick = offered[offered.length - 1];

  assert.equal((await open("non-member").chooseInterviewSlot(card.id, 9999)).ok, false);
  assert.deepEqual(await open("non-member").chooseInterviewSlot(card.id, pick.id), { ok: true, value: pick });

  const again = (await open("non-member").myApplications())!.active.find((a) => a.id === card.id)!;
  assert.deepEqual(again.stage.kind === "interview" && again.stage.interview.chosen, pick);
  assert.equal((await open("non-member").chooseInterviewSlot(card.id, offered[0].id)).ok, false);
});

for (const [kind, who] of [["division-lead", "a division lead"], ["operations-lead", "the operations lead"]] as const) {
  test(`${who} who applied sees their own application, picks a time and withdraws it (issue #183)`, async () => {
    const { open } = browser();
    const card = (await open(kind).myApplications())!.active.find((a) => a.stage.kind === "interview")!;
    assert.equal(await open(kind).hasOwnApplications(), true);
    const offered = card.stage.kind === "interview" ? card.stage.interview.slots : [];
    const pick = offered[0];
    assert.deepEqual(await open(kind).chooseInterviewSlot(card.id, pick.id), { ok: true, value: pick });

    assert.deepEqual(await open(kind).withdrawApplication(card.id), { ok: true, value: null });
    const after = (await open(kind).myApplications())!;
    assert.deepEqual(after.past.find((p) => p.id === card.id)?.outcome, { kind: "withdrawn" });
  });

  test(`${who} cannot act on someone else's application`, async () => {
    const { open } = browser();
    const others = (await open("non-member").myApplications())!.active.find((a) => a.stage.kind === "interview")!;
    assert.equal((await open(kind).withdrawApplication(others.id)).ok, false);
    assert.equal((await open(kind).chooseInterviewSlot(others.id, 1)).ok, false);
  });
}

test("saved details prefill the matching fields of the apply form", async () => {
  const { open, own } = browser();
  const saved = await open("non-member").saveDetails({
    firstName: "Chiara",
    lastName: "Lombardi",
    phone: "+39 340 111 2233",
    politoId: "s298765",
    programme: "Mechanical Engineering",
    level: "Year 2 Master's",
    country: "Italy",
    birthDate: "2002-11-05",
    linkedin: "https://www.linkedin.com/in/chiaral/",
  });
  assert.equal(saved.ok, true);

  const apply = dummyApplyData("non-member", null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications(), own());
  const { defaults } = (await apply.applicant())!;
  assert.deepEqual(
    {
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      phone: defaults.phone,
      politoId: defaults.politoId,
      degreeProgramme: defaults.degreeProgramme,
      studyProgramme: defaults.studyProgramme,
      dateOfBirth: defaults.dateOfBirth,
    },
    {
      firstName: "Chiara",
      lastName: "Lombardi",
      phone: "+39 340 111 2233",
      politoId: "298765",
      degreeProgramme: "Mechanical Engineering",
      studyProgramme: "Year 2 Master's",
      dateOfBirth: "2002-11-05",
    },
  );
  assert.equal((await open("non-member").myAccount())!.details.linkedin, "linkedin.com/in/chiaral");

  assert.equal((await open("non-member").saveDetails({ ...(await open("non-member").myAccount())!.details, phone: "333" })).ok, false);
});

test("a member's Your details save keeps the LinkedIn they just changed and the name their lead set", async () => {
  const { open } = browser();
  const before = (await open("member").myProfile())!;
  assert.deepEqual(await open("member").saveLinkedin("linkedin.com/in/elif-new"), { ok: true, value: "linkedin.com/in/elif-new" });

  // The card's copy of the details was loaded before the LinkedIn change; a
  // tampered request also tries to rename the member.
  const saved = await open("member").saveDetails({ ...before.details, firstName: "Someone", lastName: "Else", phone: "+39 340 999 0000" });
  assert.equal(saved.ok, true);

  const after = (await open("member").myProfile())!;
  assert.equal(after.linkedin, "linkedin.com/in/elif-new");
  assert.equal(after.details.linkedin, "linkedin.com/in/elif-new");
  assert.deepEqual([after.details.firstName, after.details.lastName], [before.details.firstName, before.details.lastName]);
  assert.equal(after.details.phone, "+39 340 999 0000");
});

test("a member who leaves shows in Alumni and comes back as an applicant, still signed in (issue #201)", async () => {
  const { open } = browser();
  const me = (await open("member").myProfile())!;
  assert.deepEqual(await open("member").leaveTeam("Graduating this term."), { ok: true, value: null });

  const { rows } = await open("operations-lead").alumni();
  assert.ok(rows.some((r) => r.name === me.name));

  const after = open("member");
  assert.equal(after.viewer.kind, "non-member");
  assert.equal(after.viewer.name, me.name);
  assert.equal(await after.myProfile(), null);
  const account = (await after.myAccount())!;
  assert.deepEqual([account.name, account.signIn.email], [me.name, me.signIn.email]);
  assert.equal(await after.hasOwnApplications(), false);
  assert.equal((await after.leaveTeam("")).ok, false);
});

test("someone the lead moves to alumni also comes back as an applicant", async () => {
  const { open } = browser();
  assert.equal(await open("operations-lead").teamWrites!.moveToAlumni(2, { from: 2023, to: 2026, reason: null }), true);
  assert.equal(open("division-lead").viewer.kind, "non-member");
  assert.equal(await open("division-lead").divisionAccess(), null);
});

test("the division lead sees one member-left notice, and Dismiss takes it off the list (issue #201)", async () => {
  const { open } = browser();
  const noticesOf = async () => {
    const overview = await open("division-lead").overview();
    assert.equal(overview.shape, "division");
    return overview.shape === "division" ? overview.attention.filter((a) => a.kind === "notice") : [];
  };
  const [notice] = await noticesOf();
  assert.equal((await noticesOf()).length, 1);
  assert.equal(notice.title, "Valentina Sala left the team");
  assert.ok("dismissNotice" in notice.action);

  const id = "dismissNotice" in notice.action ? notice.action.dismissNotice : -1;
  assert.equal((await open("member").dismissNotice(id)).ok, false, "not the member's notice");
  assert.deepEqual(await open("division-lead").dismissNotice(id), { ok: true, value: null });
  assert.deepEqual(await noticesOf(), []);
  assert.equal((await open("division-lead").dismissNotice(id)).ok, false, "already dismissed");
});
