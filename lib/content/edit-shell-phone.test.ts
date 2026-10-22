import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditShell, type PageSwitch } from "@/components/dashboard/edit-shell";
import type { EditBlocks } from "./edit-shell";

// Issue #530 (Owner decision, 2026-10-22): a held Publish can be cleared at
// phone width, so the page switch, with its cross and tick marks, has to
// show below md. The shell is rendered as the server sends it and read as a
// document: a control shows below md when nothing from it up to the root
// hides it there.

type Page = "project" | "home" | "list";
const blocks: EditBlocks<"hero", "top"> = { hero: { name: "Top of the page", section: "top", chip: "Edit top of the page" } };

function shell(pages?: PageSwitch<Page>): Document {
  const markup = renderToStaticMarkup(
    createElement(EditShell<"hero", "top", Page>, {
      section: { label: "Projects", href: "/dashboard/projects" },
      heading: "Editing VES",
      status: "draft-changes",
      onSaveDraft: () => {},
      onPublish: null,
      pages,
      blocks,
      onEdit: () => {},
      children: "The page",
    }),
  );
  return new JSDOM(`<!doctype html><body>${markup}</body>`).window.document;
}

/** A class that hides its element below md. `md:hidden` hides only from md, so it is not one. */
const HIDDEN_BELOW_MD = /^(hidden|max-md:hidden|max-sm:hidden|sr-only)$/;

function showsBelowMd(element: Element): boolean {
  for (let at: Element | null = element; at !== null; at = at.parentElement) {
    if ([...at.classList].some((c) => HIDDEN_BELOW_MD.test(c))) return false;
  }
  return true;
}

const held: PageSwitch<Page> = {
  targets: [
    { id: "project", label: "Project page" },
    { id: "home", label: "Home", check: "unchecked" },
    { id: "list", label: "Projects list", check: "checked" },
  ],
  current: "project",
  onSelect: () => {},
};

test("below md the page switch shows, with each page's cross or tick", () => {
  const doc = shell(held);
  const switches = [...doc.querySelectorAll('[role="group"][aria-label="Page"]')].filter(showsBelowMd);
  assert.equal(switches.length, 1, "exactly one page switch shows below md");
  const labels = [...switches[0].querySelectorAll("button")].map((b) => b.textContent);
  assert.deepEqual(labels, ["Project page", "Home, not checked yet", "Projects list, checked"]);
});

test("below md Desktop | Phone stays hidden, as the window is a phone already", () => {
  const doc = shell(held);
  const toggles = [...doc.querySelectorAll('[role="group"][aria-label="Preview size"]')];
  assert.ok(toggles.length > 0, "the shell draws Desktop | Phone");
  assert.deepEqual(toggles.filter(showsBelowMd), []);
});

test("a shell with one page or none adds no switch row below md", () => {
  const single: PageSwitch<Page> = { targets: [{ id: "project", label: "Project page" }], current: "project", onSelect: () => {} };
  for (const doc of [shell(), shell(single)]) {
    assert.equal(doc.querySelectorAll('[role="group"][aria-label="Page"]').length, 0);
  }
});
