import type { PageTarget } from "./content/edit-shell";
import { cardLookFrom, type CardLook } from "./content/publish-hold";
import { publicVersion } from "./content/versioned";
import { titleOf, type OutreachDraft, type PostItem } from "./outreach-types";

// What the Outreach post editor's Publish hold checks (board 93e, issue #581;
// the rule is lib/content/publish-hold.ts): a post's card shows on the
// Outreach list and on Home's Track record, so a change to what those cards
// draw, or a post going on the site for the first time, holds Publish until
// the editor has ticked each of those pages. A featured post (issue #496)
// shows in a Featured card on the list and on no home card, so only the list
// is checked.

/** The page switch's pages (issue #294): the post's own page, then the two pages its card shows on. */
export type PostPageId = "post" | "list" | "home";

/** The pages of the switch that show the post's card, checked before Publish. */
export type PostCheckedPage = Exclude<PostPageId, "post">;

const PAGE_TARGETS: readonly PageTarget<PostPageId>[] = [
  { id: "post", label: "Post page" },
  { id: "list", label: "Outreach list" },
  { id: "home", label: "Home" },
];

/**
 * The page switch a post shows, saved or new (Owner decision on #581): the
 * post page, the Outreach list and Home; a featured post drops Home.
 */
export function postPageTargets(featured: boolean): readonly PageTarget<PostPageId>[] {
  return featured ? PAGE_TARGETS.filter((t) => t.id !== "home") : PAGE_TARGETS;
}

/** The pages to tick before Publish: every page of the switch but the post's own. */
export function postPagesToCheck(featured: boolean): readonly PostCheckedPage[] {
  return featured ? ["list"] : ["list", "home"];
}

/**
 * How a post looks on the Outreach list and Home: what the list card, the
 * Featured card and the home cards draw. The title, date, summary and first
 * photo are on every one; the place is on the Featured card's eyebrow, and
 * the tags on the home cards.
 */
export function postCardLookOf(post: OutreachDraft): CardLook {
  const photo = post.photos[0];
  const drawn = [titleOf(post), post.date, post.place ?? "", post.summary.text, post.summary.phone ?? "", post.tags];
  return cardLookFrom([...drawn, photo === undefined ? null : [photo.src, photo.alt]]);
}

/** The look the site shows now: the published version's, or none for a post never saved or never published. */
export function livePostLookOf(item: PostItem | null): CardLook | null {
  const live = item === null ? null : publicVersion(item.version);
  return live === null ? null : postCardLookOf(live);
}
