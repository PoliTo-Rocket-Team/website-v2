import assert from "node:assert/strict";
import { test } from "node:test";
import { VIEWER_KINDS } from "@/lib/dashboard/viewer";
import { dummyNavViewer } from "@/lib/dummy-data";
import { parseNavViewer, type NavViewer } from "./nav-viewer-shape";

const FULL: NavViewer = {
  name: "Giulia Rossi",
  email: "g.rossi@politorocketteam.it",
  photoUrl: "https://store.example/photos/giulia.jpg",
  session: "account",
};

test("a full answer gives the whole viewer", () => {
  assert.deepEqual(parseNavViewer({ viewer: FULL }), FULL);
});

test("an answer with no photo gives the viewer with photoUrl null", () => {
  const noPhoto = { ...FULL, photoUrl: null, session: "test-developer" };
  assert.deepEqual(parseNavViewer({ viewer: noPhoto }), noPhoto);
});

function without(key: keyof NavViewer): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...FULL };
  delete copy[key];
  return copy;
}

test("nobody signed in, or an answer that is not a whole viewer, gives null", () => {
  const malformed: unknown[] = [
    null,
    "viewer",
    {},
    { viewer: null },
    { viewer: { name: "Giulia Rossi" } },
    { viewer: without("name") },
    { viewer: without("email") },
    { viewer: without("photoUrl") },
    { viewer: without("session") },
    { viewer: { ...FULL, name: "  " } },
    { viewer: { ...FULL, email: "" } },
    { viewer: { ...FULL, email: 7 } },
    { viewer: { ...FULL, photoUrl: "" } },
    { viewer: { ...FULL, photoUrl: 3 } },
    { viewer: { ...FULL, session: "admin" } },
  ];
  for (const body of malformed) assert.equal(parseNavViewer(body), null, JSON.stringify(body));
});

test("every test developer's answer survives the trip through /api/viewer", () => {
  for (const kind of VIEWER_KINDS) {
    const viewer = dummyNavViewer(kind);
    assert.deepEqual(parseNavViewer(JSON.parse(JSON.stringify({ viewer }))), viewer, kind);
    assert.equal(viewer.session, "test-developer", kind);
  }
});

test("a team member test developer shows their team address; the applicant, their sign-in address", () => {
  assert.equal(dummyNavViewer("member").email.endsWith("@politorocketteam.it"), true);
  assert.equal(dummyNavViewer("non-member").email, "chiara.lombardi@gmail.com");
});
