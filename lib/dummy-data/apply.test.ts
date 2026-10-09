import assert from "node:assert/strict";
import { test } from "node:test";
import { applyListing, isPublic } from "@/lib/apply/positions";
import { dummyApplyData, SentApplications } from "./apply";
import { DEFAULT_DUMMY_RECRUITMENT } from "./recruitment";

const fresh = () => new SentApplications();

test("/apply lists five or more open positions by default, and 0 or 1 to 4 by its open selector", async () => {
  const kinds = async (selector: string | null) =>
    applyListing(await dummyApplyData(null, selector, DEFAULT_DUMMY_RECRUITMENT, fresh()).publicPositions()).kind;
  const all = await dummyApplyData(null, null, DEFAULT_DUMMY_RECRUITMENT, fresh()).publicPositions();
  assert.ok(all.length >= 5);
  assert.equal(await kinds(null), "many");
  assert.equal(await kinds("0"), "none");
  for (const n of ["1", "2", "3", "4"]) assert.equal(await kinds(n), "few", n);
  assert.equal(await kinds("nope"), "many");
});

test("each position-page state has a position: closed, signed out, form and sent", async () => {
  const signedOut = dummyApplyData(null, null, DEFAULT_DUMMY_RECRUITMENT, fresh());
  const applicant = dummyApplyData("non-member", null, DEFAULT_DUMMY_RECRUITMENT, fresh());
  const all = await Promise.all([1, 2, 3, 4, 5, 6, 7].map(async (id) => (await signedOut.position(id))!));

  const closed = all.filter((r) => !isPublic(r.position, r.recruitment));
  assert.ok(closed.length >= 1);
  assert.equal(await signedOut.applicant(), null);

  const me = (await applicant.applicant())!;
  const open = all.filter((r) => isPublic(r.position, r.recruitment)).map((r) => r.position.id);
  const sent = await Promise.all(open.map((id) => applicant.hasApplied(me.id, id)));
  assert.ok(sent.includes(true), "already applied to an open position");
  assert.ok(sent.includes(false), "an open position left to apply to");
});
