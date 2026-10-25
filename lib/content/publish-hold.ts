import type { PageCheck, PageTarget } from "./edit-shell";

// The Publish hold (board 93e, issues #530 and #581): one rule for every
// editor with a page switch. An item's card shows on other pages of the site
// (a project on Home and the Projects list, an Outreach post on the Outreach
// list and Home). When the card's look in the editor differs from the one the
// site shows, or the item has no live version at all (never saved or never
// published), each page that shows the card carries a cross until the editor
// opens it and confirms "Looks right", then a tick, and Publish stays off
// until every page is ticked. A further change to the look clears the ticks.
// Edits that leave the look as the site shows it publish freely.
//
// Nothing here knows a content type: each editor names its own pages to check
// and builds its card look from what those cards draw.

/**
 * How an item's card looks on the pages it shows on: what those cards draw,
 * folded into one value. Two versions that look the same there have the same
 * look, whatever else differs.
 */
export type CardLook = string & { readonly __brand: "CardLook" };

/** The look made of what a card draws, in a fixed order. */
export function cardLookFrom(drawn: readonly unknown[]): CardLook {
  return JSON.stringify(drawn) as CardLook;
}

/**
 * Which pages the editor confirmed "Looks right" on, for the look in the
 * editor when they did. A change to that look clears them all.
 */
export type PageChecks<Page extends string> = { readonly look: CardLook; readonly ticked: readonly Page[] };

/** Nothing checked yet, for the look the editor opens on. */
export function uncheckedFor<Page extends string>(look: CardLook): PageChecks<Page> {
  return { look, ticked: [] };
}

/** The checks after an edit: kept, the same value, while the look stays the same; cleared when it changes. */
export function checksAfterEdit<Page extends string>(checks: PageChecks<Page>, look: CardLook): PageChecks<Page> {
  return checks.look === look ? checks : uncheckedFor(look);
}

/** The editor confirmed "Looks right" on one page. */
export function confirmPage<Page extends string>(checks: PageChecks<Page>, page: Page): PageChecks<Page> {
  return checks.ticked.includes(page) ? checks : { ...checks, ticked: [...checks.ticked, page] };
}

/**
 * Whether the card has to be checked before Publish: `free` when the look in
 * the editor is the one the site shows, else `checking` with each page's mark.
 */
export type PublishHold<Page extends string> =
  | { readonly kind: "free" }
  | { readonly kind: "checking"; readonly pages: readonly { readonly page: Page; readonly check: PageCheck }[] };

/**
 * The hold over `pages`, the pages that show the card. `live` is the look the
 * site shows, or null for an item with no live version, which is always held.
 */
export function publishHoldOf<Page extends string>(checks: PageChecks<Page>, live: CardLook | null, pages: readonly Page[]): PublishHold<Page> {
  if (live === checks.look) return { kind: "free" };
  return { kind: "checking", pages: pages.map((page) => ({ page, check: checks.ticked.includes(page) ? "checked" : "unchecked" })) };
}

/** Publish is off while a page still has its cross. */
export function holdsPublish(hold: PublishHold<string>): boolean {
  return hold.kind === "checking" && hold.pages.some((p) => p.check === "unchecked");
}

/** The page switch's pages, each page the hold names carrying its cross or tick. */
export function markedTargets<Page extends string>(targets: readonly PageTarget<Page>[], hold: PublishHold<Page>): readonly PageTarget<Page>[] {
  if (hold.kind === "free") return targets;
  return targets.map((target) => {
    const mark = hold.pages.find((p) => p.page === target.id);
    return mark === undefined ? target : { ...target, check: mark.check };
  });
}

/** The page in view when it is one still to check, else null: the page the "Looks right" bar asks about. */
export function pageToCheck<Page extends string>(hold: PublishHold<Page>, current: string): Page | null {
  if (hold.kind === "free") return null;
  return hold.pages.find((p) => p.page === current && p.check === "unchecked")?.page ?? null;
}
