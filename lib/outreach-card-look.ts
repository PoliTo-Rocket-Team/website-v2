import type { PageTarget } from "./content/edit-shell";
import { cardLookFrom, type CardLook } from "./content/publish-hold";
import { publicVersion } from "./content/versioned";
import { featuredCard } from "./outreach";
import { titleOf, type OutreachDraft, type PostItem } from "./outreach-types";

// What the Outreach post editor's Publish hold checks (board 93e, issue #581;
// the rule is lib/content/publish-hold.ts): a post's card shows on the
// Outreach list and on Home's Track record, so a change to what those cards
// draw, or a post going on the site for the first time, holds Publish until
// the editor has ticked each of those pages. A featured post (issue #496)
// shows in a Featured card on the list and on no home card, so only the list
// is checked, on what the Featured card draws. Featuring or unfeaturing a
// post changes which card it shows in, so it clears the ticks.

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
 * How a post looks on the pages its switch checks, built per card from what
 * that card draws. A regular post is checked on the Outreach list card (the
 * date, title, summary and first photo) and the home Track record cards
 * (the same, plus the tags), so its look is made of those fields. A featured
 * post is checked on the Featured card (the month and place eyebrow, title,
 * summary and first photo), so its look is made of what that card draws.
 * The card kind is part of the look: featuring or unfeaturing a post changes
 * its look, so a tick given on one card never stands for the other.
 */
export function postCardLookOf(post: OutreachDraft, featured: boolean): CardLook {
  const photo = post.photos[0];
  const shownPhoto = photo === undefined ? null : [photo.src, photo.alt];
  const summary = [post.summary.text, post.summary.phone ?? ""];
  if (featured) {
    const card = featuredCard(post);
    return cardLookFrom(["featured", card.eyebrow, card.title, summary, shownPhoto]);
  }
  return cardLookFrom(["regular", titleOf(post), post.date, summary, post.tags, shownPhoto]);
}

/**
 * The look the site shows now, on the card the post shows in (`featured`):
 * the published version's, or none for a post never saved or never published.
 */
export function livePostLookOf(item: PostItem | null, featured: boolean): CardLook | null {
  const live = item === null ? null : publicVersion(item.version);
  return live === null ? null : postCardLookOf(live, featured);
}
