import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockChips, CardInPlace, EditableBlock } from "@/components/dashboard/edit-shell";
import type { EditBlocks } from "./edit-shell";

// Issue #498 (Owner decision, 2026-10-21): what is editable shows at all
// times, on Desktop, Phone and touch. Nothing in a block or a card's controls
// may hang on hover or focus to be seen; hover and focus only brighten. The
// shell is rendered as the server sends it, so what is checked is the markup.

type Id = "hero" | "story";
type Section = "top" | "story";
const blocks: EditBlocks<Id, Section> = {
  hero: { name: "Top of the page", section: "top", chip: "Edit top of the page" },
  story: { name: "Name story", section: "story", chip: "Edit name story" },
};

function page(children: ReactNode, marks: { startHere?: Id; selected?: Id } = {}): string {
  return renderToStaticMarkup(createElement(BlockChips<Id, Section>, { blocks, onEdit: () => {}, ...marks, children }));
}

function block(id: Id, marks: { startHere?: Id; selected?: Id } = {}): string {
  return page(createElement(EditableBlock, { id, children: createElement("p", null, "The page's own text") }), marks);
}

/** Every class token in the markup. */
function classes(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
}

/** The block's outline layer: the one hidden layer over the page's text. */
function outlineOf(markup: string): string {
  const found = markup.match(/<div aria-hidden="true" class="([^"]*)"/);
  assert.ok(found, "the block draws an outline");
  return found[1];
}

/** A class that hides a thing until hover or focus, or hides it outright. */
const HIDING = /(^|:)(opacity-0|invisible|hidden)$/;

test("a resting block shows its outline, its name and its Edit chip with nothing hidden until hover", () => {
  const markup = block("story");
  assert.match(markup, /Name story/);
  assert.match(markup, /aria-label="Edit name story: Name story"/);
  assert.deepEqual(classes(markup).filter((c) => HIDING.test(c)), []);
  const hoverOnly = classes(markup).filter((c) => /^group-(hover|focus-within)\/block:/.test(c));
  assert.ok(hoverOnly.length > 0, "hover and focus brighten the outline");
  assert.deepEqual(hoverOnly.filter((c) => !/:border-accent$/.test(c)), [], "hover and focus only brighten the outline's colour");
});

test("the selected block draws a stronger outline than a resting one, and no chips", () => {
  const resting = outlineOf(block("story"));
  const selected = outlineOf(block("story", { selected: "story" }));
  assert.notEqual(selected, resting);
  assert.match(selected, /(^|\s)border-2(\s|$)/);
  assert.match(selected, /(^|\s)bg-accent\/5(\s|$)/);
  assert.match(resting, /(^|\s)border(\s|$)/);
  const markup = block("story", { selected: "story" });
  assert.doesNotMatch(markup, /<button/);
  assert.doesNotMatch(markup, /Name story/);
});

test("the start-here block keeps its Start here chip, shown from the start", () => {
  const markup = block("hero", { startHere: "hero" });
  assert.match(markup, /aria-label="Start here: Top of the page"/);
  assert.deepEqual(classes(markup).filter((c) => HIDING.test(c)), []);
});

test("a dimmed card with its own actions always shows its outline and action chips", () => {
  const action = createElement("button", { type: "button" }, "Pin to top");
  const markup = renderToStaticMarkup(
    createElement(CardInPlace, { edited: false, onEdit: () => {}, actions: action, children: createElement("p", null, "A card") }),
  );
  assert.match(markup, /Pin to top/);
  assert.deepEqual(classes(markup).filter((c) => HIDING.test(c)), []);
  assert.deepEqual(
    classes(markup).filter((c) => /^group-(hover|focus-within)\/card:/.test(c) && !/:border-/.test(c)),
    [],
    "hover and focus only brighten the outline",
  );
});

test("a dimmed card with no actions stays a dimmed card with no controls", () => {
  const markup = renderToStaticMarkup(createElement(CardInPlace, { edited: false, onEdit: () => {}, children: "A card" }));
  assert.match(markup, /class="opacity-40/);
  assert.doesNotMatch(markup, /<button/);
  assert.doesNotMatch(markup, /aria-hidden/);
});
