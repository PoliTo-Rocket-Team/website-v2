import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

// Issue #432: on the Partners page, a drawer opened from a row's menu and
// closed again left `pointer-events: none` on <body>, so the whole page
// stopped taking clicks. This renders the shared row menu and side panel in a
// DOM, the way the Partners page wires them (the panel keyed on what it shows,
// so closing it also remounts it), and checks the page is left as it was.

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
// The DOM's own classes (Event, CustomEvent, HTMLElement, MutationObserver …):
// an event made from Node's classes cannot be dispatched on a jsdom node.
for (const name of Object.getOwnPropertyNames(window)) {
  if (/^[A-Z]/.test(name) && typeof (window as unknown as Record<string, unknown>)[name] === "function") {
    globals[name] = (window as unknown as Record<string, unknown>)[name];
  }
}
// jsdom draws nothing, so nothing ever resizes; the menu's positioning asks for these.
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

type Opener = "row menu Edit" | "New partner";

async function openAndClose(opener: Opener, close: "Close button" | "Escape") {
  const { act, createElement, useState } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { RowMenu } = await import("@/components/dashboard/content-parts");
  const { SidePanel } = await import("@/components/dashboard/drawer");

  type Panel = "closed" | "new" | "edit";
  function Page() {
    const [panel, setPanel] = useState<Panel>("closed");
    return createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: () => setPanel("new") }, "New partner"),
      createElement(RowMenu, { name: "Acme", onEdit: () => setPanel("edit"), onUp: null, onDown: null, onRemove: () => {} }),
      createElement(SidePanel, {
        key: panel,
        open: panel !== "closed",
        onOpenChange: (open: boolean) => {
          if (!open) setPanel("closed");
        },
        title: "Partner",
        children: createElement("p", null, "Fields"),
      }),
    );
  }

  const document = window.document;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const press = (target: Element, key: string) =>
    act(() => {
      target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
  const click = (target: Element) =>
    act(() => {
      target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
  const byText = (selector: string, text: string) => {
    const found = [...document.querySelectorAll(selector)].find((el) => el.textContent?.trim() === text);
    assert.ok(found, `no ${selector} reading "${text}"`);
    return found;
  };

  await act(() => root.render(createElement(Page)));

  if (opener === "row menu Edit") {
    await press(document.querySelector('[aria-label="More for Acme"]')!, "Enter");
    await settle();
    await click(byText('[role="menuitem"]', "Edit"));
  } else {
    await click(byText("button", "New partner"));
  }
  await settle();
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, "the drawer opened");

  if (close === "Close button") await click(dialog.querySelector('[aria-label="Close"]')!);
  else await press(dialog, "Escape");
  await settle();

  const result = {
    bodyPointerEvents: document.body.style.pointerEvents,
    // Anything still on <body> beside the page: an overlay, a portal, a focus guard.
    leftovers: [...document.body.children].filter((el) => el !== container).map((el) => el.outerHTML.slice(0, 80)),
    pageHidden: container.getAttribute("aria-hidden"),
    dialogs: document.querySelectorAll('[role="dialog"]').length,
  };
  await act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  return result;
}

const cases: readonly [Opener, "Close button" | "Escape"][] = [
  ["row menu Edit", "Close button"],
  ["row menu Edit", "Escape"],
  ["New partner", "Close button"],
];

for (const [opener, close] of cases) {
  test(`a drawer opened from ${opener} and closed with ${close} leaves the page clickable`, async () => {
    assert.deepEqual(await openAndClose(opener, close), {
      bodyPointerEvents: "",
      leftovers: [],
      pageHidden: null,
      dialogs: 0,
    });
  });
}
