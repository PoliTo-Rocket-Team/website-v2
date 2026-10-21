import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

// Issue #511: every dashboard person picker is the one person field,
// `PersonCombobox`. This renders it in a DOM, as lib/dashboard/drawer-close.test.ts
// does, and drives it the way an editor does: focus, type, arrows, Enter and
// Escape, over a list it filters itself and over results that arrive from a
// server search after the typing.

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
for (const name of Object.getOwnPropertyNames(window)) {
  if (/^[A-Z]/.test(name) && typeof (window as unknown as Record<string, unknown>)[name] === "function") {
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

const TEAM = [
  { id: 1, name: "Ada Lovelace" },
  { id: 2, name: "Grace Hopper" },
  { id: 3, name: "Alan Turing" },
];

type Field = typeof import("@/components/dashboard/person-combobox");
type Drawer = typeof import("@/components/dashboard/drawer");

async function mount(render: (react: typeof import("react"), field: Field, drawer: Drawer) => import("react").ReactElement) {
  const react = await import("react");
  const { createRoot } = await import("react-dom/client");
  const field = await import("@/components/dashboard/person-combobox");
  const drawer = await import("@/components/dashboard/drawer");
  const document = window.document;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const { act } = react;
  await act(() => root.render(render(react, field, drawer)));

  const input = () => document.querySelector<HTMLInputElement>('[role="combobox"]')!;
  const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  return {
    input,
    settle,
    expanded: () => input().getAttribute("aria-expanded") === "true",
    options: () => [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent),
    active: () => document.getElementById(input().getAttribute("aria-activedescendant") ?? "")?.textContent ?? null,
    focus: () => act(() => input().focus()),
    type: (text: string) =>
      act(() => {
        const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
        setValue.call(input(), text);
        input().dispatchEvent(new window.Event("input", { bubbles: true }));
      }),
    press: (key: string) =>
      act(() => {
        input().dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      }),
    click: (text: string) =>
      act(() => {
        const option = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent === text)!;
        option.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      }),
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
      document.body.removeAttribute("style");
    },
  };
}

test("typing narrows the list by name, case-insensitive; the chosen name in the box shows the whole list", async () => {
  const ui = await mount(({ createElement }, { PersonCombobox }) =>
    createElement(PersonCombobox, { people: TEAM, value: 2, onChoose: () => {}, placeholder: "Choose a person" }),
  );
  await ui.focus();
  assert.equal(ui.input().value, "Grace Hopper");
  assert.deepEqual(ui.options(), ["Ada Lovelace", "Grace Hopper", "Alan Turing"]);
  await ui.type("aLaN");
  assert.deepEqual(ui.options(), ["Alan Turing"]);
  await ui.unmount();
});

test("the arrow keys move the active row and Enter chooses it without submitting the form", async () => {
  const chosen: number[] = [];
  let submitted = 0;
  const ui = await mount(({ createElement }, { PersonCombobox }) =>
    createElement(
      "form",
      { onSubmit: (e: Event) => (e.preventDefault(), submitted++) },
      createElement(PersonCombobox, { people: TEAM, value: undefined, onChoose: (id: number) => chosen.push(id), placeholder: "Choose a person" }),
    ),
  );
  await ui.focus();
  assert.equal(ui.active(), "Ada Lovelace");
  await ui.press("ArrowDown");
  await ui.press("ArrowDown");
  await ui.press("ArrowUp");
  assert.equal(ui.active(), "Grace Hopper");
  await ui.press("Enter");
  assert.deepEqual(chosen, [2]);
  assert.equal(submitted, 0);
  assert.equal(ui.expanded(), false);
  await ui.unmount();
});

test("a taken row shows its reason and cannot be chosen, by click or by the arrows", async () => {
  const chosen: number[] = [];
  const people = [TEAM[0], { ...TEAM[1], taken: "Already a lead" }, TEAM[2]];
  const ui = await mount(({ createElement }, { PersonCombobox }) =>
    createElement(PersonCombobox, { people, value: undefined, onChoose: (id: number) => chosen.push(id), placeholder: "Choose a person" }),
  );
  await ui.focus();
  assert.deepEqual(ui.options(), ["Ada Lovelace", "Grace HopperAlready a lead", "Alan Turing"]);
  await ui.click("Grace HopperAlready a lead");
  assert.deepEqual(chosen, []);
  await ui.press("ArrowDown");
  assert.equal(ui.active(), "Alan Turing");
  await ui.press("Enter");
  assert.deepEqual(chosen, [3]);
  await ui.unmount();
});

test("Escape closes the list and leaves the drawer around it open", async () => {
  const ui = await mount(({ createElement, useState }, { PersonCombobox }, { SidePanel }) => {
    function Drawer() {
      const [open, setOpen] = useState(true);
      return createElement(SidePanel, {
        open,
        onOpenChange: setOpen,
        title: "Give access",
        children: createElement(PersonCombobox, { people: TEAM, value: undefined, onChoose: () => {}, placeholder: "Choose a person" }),
      });
    }
    return createElement(Drawer);
  });
  const dialogs = () => window.document.querySelectorAll('[role="dialog"]').length;
  await ui.settle();
  await ui.focus();
  assert.equal(ui.expanded(), true);
  await ui.press("Escape");
  await ui.settle();
  assert.equal(ui.expanded(), false);
  assert.equal(dialogs(), 1);
  // With the list closed, Escape is the drawer's again.
  await ui.press("Escape");
  await ui.settle();
  assert.equal(dialogs(), 0);
  await ui.unmount();
});

test("results that a server search sends after the typing are shown and can be chosen", async () => {
  const chosen: number[] = [];
  const ui = await mount(({ createElement, useEffect, useState }, { PersonCombobox }) => {
    function Searching() {
      const [text, setText] = useState("");
      const [found, setFound] = useState<typeof TEAM>([]);
      useEffect(() => {
        // The answer lands later, as the server's does.
        const timer = setTimeout(() => setFound(text.length < 2 ? [] : TEAM.filter((p) => p.name.startsWith(text))), 20);
        return () => clearTimeout(timer);
      }, [text]);
      return createElement(PersonCombobox, {
        people: found,
        value: null,
        onChoose: (id: number) => chosen.push(id),
        placeholder: "Search the team",
        search: { text, onText: setText },
      });
    }
    return createElement(Searching);
  });
  await ui.focus();
  await ui.type("Al");
  assert.deepEqual(ui.options(), []);
  await ui.settle(40);
  assert.deepEqual(ui.options(), ["Alan Turing"]);
  await ui.press("Enter");
  assert.deepEqual(chosen, [3]);
  await ui.unmount();
});
