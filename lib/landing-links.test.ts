import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";
import { publicItems } from "@/lib/content/versioned";
import { importedPartners } from "@/lib/partners-import";
import { importedProjects } from "@/lib/project-content/import";
import { NEW_TAB, footerColumns, isExternal, landingHrefs, opensOf, outreachPostHref } from "./landing-links";

// Issue #359: every landing link (navbar, hero, sections, footer) is checked.
// A link to a page must name a page the app has (app/**/page.tsx); a link to
// another site opens in a new tab with no hold on the site.

const root = join(__dirname, "..");

function files(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path, keep);
    return keep(e.name) ? [path] : [];
  });
}

/** Each page's route as path segments: route groups dropped, a [param] segment matching any one segment. */
const routes = files(join(root, "app"), (name) => name === "page.tsx").map((page) =>
  relative(join(root, "app"), page)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment)),
);

function isPage(path: string): boolean {
  const segments = path.split(/[?#]/)[0].split("/").filter(Boolean);
  return routes.some(
    (route) => route.length === segments.length && route.every((r, i) => /^\[[^.\]]+\]$/.test(r) || r === segments[i]),
  );
}

test("every page the landing page links to exists", () => {
  const internal = landingHrefs().filter((href) => href.startsWith("/"));
  assert.ok(internal.length > 0);
  for (const href of internal) assert.ok(isPage(href), `${href} names no page under app/`);
  assert.ok(isPage(outreachPostHref("a-post")), "a Track record card's post page");
});

// Issue #378: the PROJECTS column is the published projects, each by name
// linking to its page, in the order it is handed (the /projects order).
test("the footer's PROJECTS column lists the published projects, in order, each linking to its page", () => {
  const published = publicItems(importedProjects());
  assert.ok(published.length > 0);
  const columns = footerColumns(published);
  assert.deepEqual(
    columns.map((c) => c.head),
    ["ABOUT", "PROJECTS", "GET INVOLVED", "CONTACT"],
  );
  const projects = columns[1];
  assert.deepEqual(
    projects.links,
    published.map((p) => [p.name, `/projects/${p.slug}`]),
  );
  for (const [, href] of projects.links) assert.ok(isPage(href), `${href} names no page under app/`);
  // The other columns do not depend on the projects.
  assert.deepEqual(
    columns.filter((c) => c.head !== "PROJECTS"),
    footerColumns([]).filter((c) => c.head !== "PROJECTS"),
  );
  assert.deepEqual(footerColumns([]).find((c) => c.head === "PROJECTS")?.links, []);
});

test("every link to another site opens in a new tab with noopener noreferrer", () => {
  const external = landingHrefs().filter((href) => isExternal(href));
  assert.deepEqual(external.length, 3, "the footer's Instagram, LinkedIn and X");
  for (const href of external) {
    assert.match(href, /^https:\/\//, `${href} is not https`);
    assert.deepEqual(opensOf(href), { target: "_blank", rel: "noopener noreferrer" });
  }
  // The logo strip links each partner to its website.
  for (const partner of publicItems(importedPartners())) {
    if (partner.website === undefined) continue;
    assert.ok(isExternal(partner.website), `${partner.name}: ${partner.website} is not an absolute URL`);
    assert.deepEqual(opensOf(partner.website), NEW_TAB);
  }
});

test("a page or mail link opens where it is", () => {
  for (const href of landingHrefs().filter((h) => !isExternal(h))) assert.deepEqual(opensOf(href), {});
});

// The test above walks lib/landing-links.ts, so it covers the page only while
// no landing component writes a link target or a new-tab rule of its own.
test("no landing component writes its own link target or new-tab rule", () => {
  for (const file of files(join(root, "components", "landing"), (name) => name.endsWith(".tsx"))) {
    const source = readFileSync(file, "utf8");
    const name = relative(root, file);
    assert.doesNotMatch(source, /\bhref=["'`]/, `${name}: a literal href; name it in lib/landing-links.ts`);
    assert.doesNotMatch(source, /\bhref=\{`/, `${name}: a built href; name it in lib/landing-links.ts`);
    assert.doesNotMatch(source, /\btarget=["']_blank/, `${name}: a new tab of its own; spread NEW_TAB or opensOf`);
    assert.doesNotMatch(source, /\brel=["']/, `${name}: a rel of its own; spread NEW_TAB or opensOf`);
  }
});
