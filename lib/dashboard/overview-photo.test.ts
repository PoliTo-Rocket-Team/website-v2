// The view imports its server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { members } from "@/db/schema";
import { OverviewView } from "@/components/dashboard/overview";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { changeRows } from "./access-matrix/test-database";
import { accountOf, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";

// Issue #599: the circle beside the viewer's name at the top of a team seat's
// Overview shows their stored photo, the one the sidebar shows, and the PRT
// mark when they have none. Their own row in the division roster follows it.
// The page is rendered from what the database path answers, so what is
// checked is the markup the viewer gets.

const PHOTO = "https://store.example/photo/member-a.jpg";

async function signedIn(name: string, picture: string | null): Promise<DashboardData> {
  await seedFixture();
  const { userId, memberId } = accountOf(name);
  if (picture !== null) await changeRows(members, { memberId }, { picture });
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

/** The opening tag of each round avatar carrying these size classes: an `<img>` for a photo, a `<span>` around the mark. */
function avatarsOf(html: string, size: readonly string[]): string[] {
  return [...html.matchAll(/<(?:img|span)\b[^>]*\bclass="([^"]*)"[^>]*>/g)]
    .filter((m) => {
      const classes = m[1].split(/\s+/);
      return classes.includes("rounded-full") && size.every((c) => classes.includes(c));
    })
    .map((m) => m[0]);
}

const HEADER = ["h-14", "w-14"];
const ROSTER = ["h-7", "w-7"];

async function rendered(data: DashboardData): Promise<string> {
  return renderToStaticMarkup(createElement(OverviewView, { overview: await data.overview() }));
}

test("a member with a stored photo sees it in the Overview header, the same photo the sidebar shows", async () => {
  const data = await signedIn("member", PHOTO);
  assert.equal(data.viewer.photoUrl, PHOTO);
  const html = await rendered(data);
  const header = avatarsOf(html, HEADER);
  assert.equal(header.length, 1);
  assert.match(header[0], /^<img\b/);
  assert.ok(header[0].includes(`src="${PHOTO}"`), header[0]);
  assert.ok(
    avatarsOf(html, ROSTER).some((tag) => tag.includes(`src="${PHOTO}"`)),
    "their own row in the division roster shows the photo too",
  );
});

test("a member with no stored photo sees the PRT mark in the Overview header", async () => {
  const data = await signedIn("member", null);
  assert.equal(data.viewer.photoUrl, null);
  const header = avatarsOf(await rendered(data), HEADER);
  assert.equal(header.length, 1);
  assert.match(header[0], /^<span\b/);
});
