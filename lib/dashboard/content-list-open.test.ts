// The FAQ page's server actions load through the access tests' fakes; none is called here.
// The in-memory database loads before the DOM globals below, so it starts as on Node.
import "./access-matrix/install";
import "./access-matrix/test-database";

import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import type { ContentItem } from "@/lib/content/versioned";
import type { FaqVersion } from "@/lib/faq/faq";
import { blankPostFields } from "@/lib/outreach-post-fields";

// Issue #617: a content list opens a row's editor on a click on the row or on
// the Edit chip at its end, and its three-dot menu holds only secondary
// actions. The FAQ list is drawn in a DOM: its row menu shows no Edit, a click
// on the row or the chip opens the edit panel, and a click on the drag grip or
// the menu does not. The Edit post panel's text blocks are no list, so their
// menu still shows Edit.

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
const { window } = dom;
const globals: Record<string, unknown> = {
  window,
  document: window.document,
  navigator: window.navigator,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
};
// The DOM's own classes: an event made from Node's classes cannot be dispatched
// on a jsdom node. Node's own Blob, URL and the like stay, as the fakes load through them.
for (const name of Object.getOwnPropertyNames(window)) {
  const domOnly = !(name in globalThis) || /Event(Target)?$/.test(name);
  if (/^[A-Z]/.test(name) && domOnly && typeof (window as unknown as Record<string, unknown>)[name] === "function") {
    globals[name] = (window as unknown as Record<string, unknown>)[name];
  }
}
class StillObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globals.ResizeObserver = StillObserver;
globals.IntersectionObserver = StillObserver;
for (const [name, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

const QUESTION = "Do I need experience?";
const FAQ: ContentItem<FaqVersion> = {
  id: 1,
  siteOrder: 1,
  version: {
    state: "published",
    published: { question: QUESTION, answer: ["No."], updatedAt: "2026-10-20T10:00:00.000Z" },
    draft: null,
  },
};

async function draw(element: () => Promise<unknown>) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const document = window.document;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render((await element()) as never));
  const settle = async () => {
    for (let i = 0; i < 5; i++) await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  };
  const close = async () => {
    await act(() => root.unmount());
    container.remove();
    document.body.removeAttribute("style");
  };
  const click = async (el: Element) => {
    await act(() => void el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    await settle();
  };
  /** Opens a three-dot menu from the keyboard and reads its items. */
  const menuItems = async (trigger: Element) => {
    await act(() => void trigger.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    await settle();
    return [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent?.trim());
  };
  return { container, click, menuItems, close };
}

async function faqPage() {
  return draw(async () => {
    const { createElement } = await import("react");
    const { FaqView } = await import("@/components/dashboard/faq");
    return createElement(FaqView, { items: [FAQ], now: "2026-10-25T10:00:00.000Z" });
  });
}

const panelOpen = () => window.document.querySelector('[role="dialog"]') !== null;

test("a FAQ row's menu shows no Edit, and keeps Move up, Move down and Remove", async () => {
  const page = await faqPage();
  const items = await page.menuItems(page.container.querySelector(`[aria-label="More for ${QUESTION}"]`)!);
  await page.close();
  assert.deepEqual(items, ["Move up", "Move down", "Remove"]);
});

for (const target of ["row", "Edit chip"] as const) {
  test(`a click on a FAQ ${target} opens the edit panel`, async () => {
    const page = await faqPage();
    const chip = page.container.querySelector(`button[aria-label="Edit ${QUESTION}"]`);
    assert.ok(chip, "the row ends in an Edit button");
    const row = chip.closest("li")!;
    const question = [...row.querySelectorAll("span")].find((el) => el.textContent === QUESTION)!;
    await page.click(target === "row" ? question : chip);
    const opened = panelOpen();
    await page.close();
    assert.equal(opened, true);
  });
}

for (const target of ["drag grip", "menu"] as const) {
  test(`a click on a FAQ row's ${target} opens no panel`, async () => {
    const page = await faqPage();
    const row = page.container.querySelector(`button[aria-label="Edit ${QUESTION}"]`)!.closest("li")!;
    const grip = row.querySelector("span[aria-hidden] svg")?.parentElement;
    const menu = row.querySelector(`[aria-label="More for ${QUESTION}"]`);
    await page.click(target === "drag grip" ? grip! : menu!);
    const opened = panelOpen();
    await page.close();
    assert.equal(opened, false);
  });
}

test("a text block's menu in the Edit post panel still shows Edit", async () => {
  const page = await draw(async () => {
    const { createElement } = await import("react");
    const { OutreachPostPanel } = await import("@/components/dashboard/outreach-post-panel");
    const fields = { ...blankPostFields("2026-10-25"), body: [{ kind: "paragraph" as const, text: "We flew." }] };
    return createElement(OutreachPostPanel, {
      fields,
      onChange: () => {},
      tags: [],
      onAddTag: async () => false,
      errors: {},
      expanded: ["text"],
      onExpandedChange: () => {},
      scrollTo: null,
      onClose: () => {},
    });
  });
  const items = await page.menuItems(window.document.querySelector('[aria-label="More for Paragraph"]')!);
  await page.close();
  assert.deepEqual(items, ["Edit", "Move up", "Move down", "Remove"]);
});
