import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeProjectCard } from "@/components/landing/project-card";
import { ProjectsSection } from "@/components/landing/projects-section";
import { publicItems } from "@/lib/content/versioned";
import { importedProjects } from "./import";
import { homeCardOf, landingCardOf, pageOf } from "./record";

// The home project cards link to their project pages (issue #372); the same
// card drawn anywhere else stays plain.

const published = () => publicItems(importedProjects());

/** Each link in the markup that carries its own name: its name and target. */
function namedLinks(markup: string): { name: string; href: string }[] {
  return [...markup.matchAll(/<a\s[^>]*>/g)].flatMap(([tag]) => {
    const name = /aria-label="([^"]*)"/.exec(tag)?.[1];
    const href = /href="([^"]*)"/.exec(tag)?.[1];
    return name === undefined || href === undefined ? [] : [{ name, href }];
  });
}

test("each home project card is one link to its project's page, named by the project's name", () => {
  const records = published();
  const markup = renderToStaticMarkup(createElement(ProjectsSection, { cards: records.map(landingCardOf) }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  assert.deepEqual(
    namedLinks(markup).sort(byName),
    records.map((r) => ({ name: r.name, href: pageOf(r.slug) })).sort(byName),
  );
  assert.deepEqual(
    records.map((r) => pageOf(r.slug)),
    ["/projects/cavour", "/projects/ves", "/projects/efesto"],
  );
});

test("the edit shell's page switch and a card handed no page draw no card link", () => {
  const cards = published().map(homeCardOf);
  const framed = renderToStaticMarkup(createElement(ProjectsSection, { cards, frame: (_card, node) => node }));
  assert.deepEqual(namedLinks(framed), []);
  assert.doesNotMatch(framed, /href="\/projects\//, "only the All projects link, to /projects itself");
  assert.doesNotMatch(renderToStaticMarkup(createElement(HomeProjectCard, { project: cards[0] })), /<a\s/);
});
