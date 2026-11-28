import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeetingMinutesView } from "@/components/dashboard/meeting-minutes";
import { googleLink, minutesPageOf, type MinutesLinks } from "./meeting-minutes";
import { fake, installFakes } from "./access-matrix/hooks";

// The links file imports `server-only`, so it loads once that is stood in for.
// Nothing here opens a database.
let MINUTES_LINKS: MinutesLinks;
before(async () => {
  installFakes({ "server-only": fake("server-only.ts") });
  ({ MINUTES_LINKS } = await import("./meeting-minutes-links"));
});

const HUB = { code: "HUB-1", description: "Requests", url: "https://docs.google.com/spreadsheets/d/x" };
const html = (links: MinutesLinks) => renderToStaticMarkup(createElement(MeetingMinutesView, { page: minutesPageOf(links) }));

test("a link opens only over https on its own Google host; anything else is no link", () => {
  assert.equal(googleLink("https://drive.google.com/open?id=a", "drive"), "https://drive.google.com/open?id=a");
  assert.ok(googleLink("https://drive.google.com/drive/folders/a", "drive"));
  assert.ok(googleLink(HUB.url, "sheets"));
  for (const url of ["https://docs.google.com/document/d/x", "https://docs.google.com/forms/d/x", "https://docs.google.com/", "https://drive.google.com/open?id=a", "http://docs.google.com/spreadsheets/d/x"])
    assert.equal(googleLink(url, "sheets"), null, url);
  for (const url of [
    null,
    "",
    "TODO",
    "javascript:alert(1)",
    "http://drive.google.com/drive/folders/a",
    "https://docs.google.com/drive/folders/a",
    "https://drive.google.com.evil.test/drive/folders/a",
    "https://drive.google.com@evil.test/drive/folders/a",
    "https://user@drive.google.com/drive/folders/a",
    "https://drive.google.com:8443/drive/folders/a",
    "https://drive.google.com./drive/folders/a",
    "https://drive.google.com/",
    "https://drive.google.com/open",
    "https://drive.google.com/uc?export=download&id=a",
    "//drive.google.com/drive/folders/a",
    "data:text/html,x",
  ])
    assert.equal(googleLink(url, "drive"), null, String(url));
});

test("every configured link is one the page opens, and each folder is listed once", () => {
  const page = minutesPageOf(MINUTES_LINKS);
  for (const [i, { code, url }] of MINUTES_LINKS.folders.entries()) assert.equal(page.folders[i].href !== null, url !== null, code);
  assert.equal(page.requestsHub.href !== null, MINUTES_LINKS.requestsHub.url !== null);
  const codes = MINUTES_LINKS.folders.map((f) => f.code);
  assert.equal(new Set(codes).size, codes.length);
  const urls = MINUTES_LINKS.folders.flatMap((f) => (f.url === null ? [] : [f.url]));
  assert.equal(new Set(urls).size, urls.length, "two rows share a folder");
});

test("the folders are the proposal's eight, and only a confirmed name shows beside its code", () => {
  assert.deepEqual(
    MINUTES_LINKS.folders.map(({ code, name }) => [code, name]),
    [
      ["OPS-LGS", "Logistics"],
      ["OPS-SFT", "Safety"],
      ["OPS-MDA", null],
      ["OPS-IT", null],
      ["VES-RCV", null],
      ["CVR-DAM", null],
      ["AMV-SAN", null],
      ["LRE-LSA", "Liquid System Architecture"],
    ],
  );
});

test("each linked row and the hub open a new tab, named for what they open", () => {
  const out = html({ folders: [{ code: "OPS-LGS", name: "Logistics", url: "https://drive.google.com/open?id=a" }], requestsHub: HUB });
  const anchors = out.match(/<a [^>]*>/g) ?? [];
  assert.equal(anchors.length, 2);
  for (const a of anchors) assert.match(a, /target="_blank" rel="noopener noreferrer"/);
  assert.match(out, /aria-label="Open folder: Logistics \(opens in a new tab\)"/);
  assert.match(out, /aria-label="Open Requests Hub \(opens in a new tab\)"/);
  assert.match(out, /OPS-LGS/);
});

test("a division with no link keeps its row, and a hub with none says so; neither renders a link", () => {
  const out = html({ folders: [{ code: "OPS-X", name: null, url: null }], requestsHub: { ...HUB, url: null } });
  assert.doesNotMatch(out, /<a /);
  assert.match(out, /OPS-X/);
  assert.match(out, /No link yet<\/span>/);
  assert.match(out, /No link yet\. The Requests Hub/);
});

test("with no folder at all the page says there are no meeting minutes yet", () => {
  assert.match(html({ folders: [], requestsHub: HUB }), /No meeting minutes yet/);
});

test("the links file is server only, the view is no client component, and the page checks reach before it renders a link", () => {
  const source = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  assert.match(source("lib/dashboard/meeting-minutes-links.ts"), /^import "server-only";/);
  assert.doesNotMatch(source("components/dashboard/meeting-minutes.tsx"), /"use client"|meeting-minutes-links/);
  const page = source("app/dashboard/meeting-minutes/page.tsx");
  const check = page.indexOf('if (!canReach(data.viewer, "meeting-minutes")) notFound();');
  assert.ok(check !== -1 && check < page.indexOf("<MeetingMinutesView"));
});
