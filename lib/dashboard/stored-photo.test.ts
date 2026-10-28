import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar } from "@/components/dashboard/avatar";
import type { Pictured } from "./stored-photo";

// Issue #656: the shared avatar reads a known person's stored photo off the
// person. A photo draws it; no stored picture, or an empty one, draws the PRT
// mark and no photo <img>. A circle that shows nobody draws the mark too.

const PHOTO = "https://store.example/photo/ada.jpg";

/** What the circle draws: the photo it shows, or the mark. */
function drawn(person: Pictured | null): string {
  const html = renderToStaticMarkup(createElement(Avatar, { person }));
  const photo = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]).find((src) => !src.includes("prt-mark-white"));
  if (photo !== undefined) return `photo ${photo}`;
  assert.match(html, /prt-mark-white/, "the circle draws the PRT mark");
  return "mark";
}

test("a person with a stored photo is drawn with it", () => {
  assert.equal(drawn({ photoUrl: PHOTO }), `photo ${PHOTO}`);
});

test("a person with no stored picture is drawn as the PRT mark", () => {
  assert.equal(drawn({ photoUrl: null }), "mark");
  // A value read from outside the types, with the picture missing altogether.
  assert.equal(drawn({} as Pictured), "mark");
});

test("an empty stored picture is no photo: the PRT mark, and no <img src=\"\">", () => {
  assert.equal(drawn({ photoUrl: "" }), "mark");
  assert.equal(drawn({ photoUrl: "  " }), "mark");
  assert.doesNotMatch(renderToStaticMarkup(createElement(Avatar, { person: { photoUrl: "" } })), /src=""/);
});

test("a circle that shows nobody draws the PRT mark", () => {
  assert.equal(drawn(null), "mark");
});
