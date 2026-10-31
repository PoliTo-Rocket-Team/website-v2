import assert from "node:assert/strict";
import { test } from "node:test";
import { editsPrtEmail, ownPrtEmailOf, planOwnPrtEmailEdit } from "./own-prt-email";

// The member's own PRT email on My profile (issue #921): the edit's rules, when
// the warning shows, and what the field reads while it is empty. The writes
// on the database are ./own-prt-email-server.test.ts's.

const edit = (typed: string, stored: string | null = null, taken: string[] = []) => planOwnPrtEmailEdit({ stored, typed, taken });

test("a team-domain address, firstname.lastname or one word, saves in lower case", () => {
  assert.deepEqual(edit(" Davide.Russo@PoliToRocketTeam.it "), { ok: true, value: { kind: "set", address: "davide.russo@politorocketteam.it" } });
  assert.deepEqual(edit("sponsoring@politorocketteam.it", "davide.russo@politorocketteam.it"), {
    ok: true,
    value: { kind: "set", address: "sponsoring@politorocketteam.it" },
  });
});

test("an address off the team domain, or in another form, is refused", () => {
  assert.deepEqual(edit("davide.russo@gmail.com"), { ok: false, error: "The PRT email must end with @politorocketteam.it." });
  assert.equal(edit("davide.r.russo@politorocketteam.it").ok, false, "three parts");
  assert.deepEqual(edit("", "davide.russo@politorocketteam.it"), { ok: false, error: "Type your PRT email." }, "clearing it");
});

test("an address another member or a team address holds is refused, in any letter case", () => {
  const taken = ["Marco.Bianchi@politorocketteam.it", "recruitment@politorocketteam.it"];
  assert.deepEqual(edit("marco.bianchi@politorocketteam.it", null, taken), { ok: false, error: "marco.bianchi@politorocketteam.it is already a PRT email." });
  assert.deepEqual(edit("RECRUITMENT@politorocketteam.it", null, taken), { ok: false, error: "recruitment@politorocketteam.it is already a PRT email." });
});

test("an unchanged PRT email saves whatever its form, so an old one never blocks the save (issue #887)", () => {
  const unchanged = { ok: true, value: { kind: "unchanged" } };
  assert.deepEqual(edit("Davide_Russo@politorocketteam.it ", "davide_russo@politorocketteam.it", ["davide_russo@politorocketteam.it"]), unchanged);
  assert.deepEqual(edit("", null), unchanged, "empty, and left empty");
  assert.deepEqual(edit("  ", "  "), unchanged, "a blank one is none");
});

test("the warning shows while the typed PRT email differs from the saved one, and only then", () => {
  assert.equal(editsPrtEmail("davide.russo@politorocketteam.it", "davide.russo@politorocketteam.it"), false);
  assert.equal(editsPrtEmail("davide.russo@politorocketteam.it", " Davide.Russo@politorocketteam.it"), false, "the same address in other case");
  assert.equal(editsPrtEmail("davide.russo@politorocketteam.it", "davide.rossi@politorocketteam.it"), true);
  assert.equal(editsPrtEmail("", "d"), true, "typing into an empty one");
  assert.equal(editsPrtEmail("", ""), false);
});

test("My profile reads the address set, else the open request, else the request my PRT email starts from", () => {
  assert.deepEqual(ownPrtEmailOf({ name: "Anna De Luca", prtEmail: "anna.deluca@politorocketteam.it", requested: false }), {
    kind: "set",
    address: "anna.deluca@politorocketteam.it",
  });
  assert.deepEqual(ownPrtEmailOf({ name: "Anna De Luca", prtEmail: " ", requested: true }), { kind: "requested" });
  assert.deepEqual(ownPrtEmailOf({ name: "Anna De Luca", prtEmail: null, requested: false }), { kind: "none", prefill: "anna.deluca@politorocketteam.it" });
});
