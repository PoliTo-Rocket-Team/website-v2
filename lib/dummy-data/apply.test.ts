import assert from "node:assert/strict";
import { test } from "node:test";
import { placeholderRoles } from "@/lib/apply/placeholder-roles";
import { applyListing, isPublic, positionCode } from "@/lib/apply/positions";
import { dummyApplyData, SentApplications } from "./apply";
import { DEFAULT_DUMMY_RECRUITMENT } from "./recruitment";
import { positions } from "./team";

const fresh = () => new SentApplications();

test("/apply lists open positions by default and by its open selector, and the closed roles at open=0", async () => {
  const kinds = async (selector: string | null) =>
    applyListing(await dummyApplyData(null, selector, DEFAULT_DUMMY_RECRUITMENT, fresh()).publicPositions()).kind;
  const all = await dummyApplyData(null, null, DEFAULT_DUMMY_RECRUITMENT, fresh()).publicPositions();
  assert.ok(all.length >= 5);
  assert.equal(await kinds(null), "open");
  assert.equal(await kinds("0"), "closed");
  for (const n of ["1", "2", "3", "4"]) assert.equal(await kinds(n), "open", n);
  assert.equal(await kinds("nope"), "open");
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

test("every closed dummy position named like a placeholder role shows one code on /apply?open=0 and on its own page", async () => {
  const data = dummyApplyData(null, "0", DEFAULT_DUMMY_RECRUITMENT, fresh());
  const listing = applyListing(await data.publicPositions());
  assert.equal(listing.kind, "closed");
  const listed = listing.kind === "closed" ?listing.placeholders.flatMap((g) => g.roles) : [];
  const placeholderTitles = new Set<string>(placeholderRoles.map((r) => r.title));
  const shared = positions.filter((p) => !p.open && placeholderTitles.has(p.title));
  assert.ok(shared.some((p) => p.title === "Flight Simulator Developer"), "the closed Flight Simulator Developer (#157)");
  for (const dummy of shared) {
    const page = await data.position(dummy.id);
    assert.ok(page && !isPublic(page.position, page.recruitment), dummy.title);
    const row = listed.find((r) => r.title === dummy.title);
    assert.ok(row, `${dummy.title} listed on /apply?open=0`);
    assert.equal(row.code, positionCode(page.position), dummy.title);
  }
});
