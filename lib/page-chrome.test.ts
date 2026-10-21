import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamPageView } from "@/components/about/team-page";
import { EditedPostPage, PostCardPage } from "@/components/dashboard/outreach-post-pages";
import { EditedProjectPage, ProjectCardPage } from "@/components/dashboard/project-edit-pages";
import { EditedTeamPage } from "@/components/dashboard/team-page-edit-view";
import { OutreachListPage } from "@/components/outreach/list-page";
import { postCardOf } from "@/components/outreach/post-card";
import { PostPage } from "@/components/outreach/post-page";
import { ProjectPageView } from "@/components/project-page/view";
import { ProjectsListPage } from "@/components/projects/list-page";
import { team } from "@/lib/about/team";
import { publicItems } from "@/lib/content/versioned";
import { featuredCard, iressStory, newestFirst, outreachRecord } from "@/lib/outreach";
import { mapUpToTwo, type OutreachContent } from "@/lib/outreach-types";
import { firstImport, importedProjects } from "@/lib/project-content/import";
import { listingOf, listingsNewestFirst, pageRecordOf } from "@/lib/project-content/record";
import { siteFooterOf } from "./page-chrome";

// The public pages draw the site's navbar and footer; the dashboard editors
// draw the same pages without them (issue #495).

const projects = publicItems(importedProjects(firstImport));
const footerProjects = projects.map(({ name, slug }) => ({ name, slug }));
const outreach: OutreachContent = { ...outreachRecord, featured: [iressStory] };
const [post] = outreachRecord.posts;
const ACADEMIC_YEAR = 2026;
const asIs = <Part>(_: Part, node: unknown) => node as ReactElement;

/** Whether the markup carries the site navbar (navbar.tsx's fixed glass bar) and the site footer. */
function chromeOf(page: ReactElement): { navbar: boolean; footer: boolean } {
  const markup = renderToStaticMarkup(page);
  return { navbar: markup.includes('class="glass-bar fixed'), footer: markup.includes("<footer") };
}

const SITE = { navbar: true, footer: true };
const NONE = { navbar: false, footer: false };

test("a page handed the footer's projects draws the site chrome; chrome none draws neither and lists none", () => {
  assert.equal(siteFooterOf({ footerProjects }), footerProjects);
  assert.equal(siteFooterOf({ chrome: "none" }), null);
});

test("the Outreach post page draws the navbar and footer publicly, and neither as the editor draws it", () => {
  assert.deepEqual(chromeOf(createElement(PostPage, { post, neighbours: {}, footerProjects })), SITE);
  assert.deepEqual(chromeOf(createElement(PostPage, { post, neighbours: {}, chrome: "none" })), NONE);
  assert.deepEqual(chromeOf(createElement(EditedPostPage, { post, neighbours: {}, frame: asIs })), NONE);
});

test("the Outreach list draws the navbar and footer publicly, and neither as the editor draws it", () => {
  const page = {
    features: mapUpToTwo(outreach.featured, featuredCard),
    cards: newestFirst(outreach.posts).map(postCardOf),
  };
  assert.deepEqual(chromeOf(createElement(OutreachListPage, { ...page, footerProjects })), SITE);
  assert.deepEqual(chromeOf(createElement(OutreachListPage, { ...page, chrome: "none" })), NONE);
});

test("the Outreach editor's list and home pages, a featured post's list included, draw no navbar and no footer", () => {
  const card = { view: post, edited: { id: 1, live: true }, shown: outreach, ids: {}, publishedSlug: null };
  const on = { onEditCard: () => {}, onOpenFeatured: () => {}, onMove: () => {} };
  for (const page of ["list", "home"] as const) {
    for (const featuredHere of [false, true]) {
      const featured = featuredHere ? ([1] as const) : ([] as const);
      assert.deepEqual(chromeOf(createElement(PostCardPage, { ...card, ...on, page, featuredHere, featured })), NONE, `${page}, featured ${featuredHere}`);
    }
  }
});

test("a project page draws the navbar and footer publicly, and neither as the editor draws it", () => {
  const [record] = projects;
  const page = { project: listingOf(record, 0), record: pageRecordOf(record) };
  assert.deepEqual(chromeOf(createElement(ProjectPageView, { ...page, footerProjects })), SITE);
  assert.deepEqual(chromeOf(createElement(ProjectPageView, { ...page, chrome: "none" })), NONE);
  assert.deepEqual(chromeOf(createElement(EditedProjectPage, { view: record, position: 0, frame: asIs })), NONE);
});

test("the Projects list draws the navbar and footer publicly, and neither as the editor draws it", () => {
  const listed = listingsNewestFirst(projects);
  assert.deepEqual(chromeOf(createElement(ProjectsListPage, { projects: listed, footerProjects })), SITE);
  assert.deepEqual(chromeOf(createElement(ProjectsListPage, { projects: listed, chrome: "none" })), NONE);
});

test("the project editor's list and home pages draw no navbar and no footer", () => {
  for (const page of ["list", "home"] as const) {
    assert.deepEqual(chromeOf(createElement(ProjectCardPage, { page, lineup: projects, position: 0, onEditCard: () => {} })), NONE, page);
  }
});

test("the Team page draws the navbar and footer publicly, and neither as the editor draws it, keeping the apply band", () => {
  assert.deepEqual(chromeOf(createElement(TeamPageView, { page: team, academicYear: ACADEMIC_YEAR, footerProjects })), SITE);
  assert.deepEqual(chromeOf(createElement(TeamPageView, { page: team, academicYear: ACADEMIC_YEAR, chrome: "none" })), NONE);
  const edited = createElement(EditedTeamPage, { page: team, academicYear: ACADEMIC_YEAR, frames: {} });
  assert.deepEqual(chromeOf(edited), NONE);
  assert.match(renderToStaticMarkup(edited), /Apply/);
});
