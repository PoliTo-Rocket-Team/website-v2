import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNavViewer, type NavViewer } from "./nav-viewer-shape";

const FULL: NavViewer = {
  name: "Giulia Rossi",
  email: "g.rossi@politorocketteam.it",
  photoUrl: "https://store.example/photos/giulia.jpg",
};

test("a full answer gives the whole viewer", () => {
  assert.deepEqual(parseNavViewer({ viewer: FULL }), FULL);
});

test("an answer with no photo gives the viewer with photoUrl null", () => {
  const noPhoto = { ...FULL, photoUrl: null };
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
    { viewer: { ...FULL, name: "  " } },
    { viewer: { ...FULL, email: "" } },
    { viewer: { ...FULL, email: 7 } },
    { viewer: { ...FULL, photoUrl: "" } },
    { viewer: { ...FULL, photoUrl: 3 } },
  ];
  for (const body of malformed) assert.equal(parseNavViewer(body), null, JSON.stringify(body));
});
