import type { FooterProject } from "@/lib/landing-links";

// What a public page draws around its own content (issue #495). A public
// route passes `footerProjects`, and the page draws the site's navbar above
// it and the footer, listing those projects, below it, as it always has. The
// dashboard editors pass `chrome="none"` instead and draw the content alone:
// the navbar and footer are not theirs to edit. A page never takes both, and
// the bare form takes no footer list, since it draws no footer.

export type PageChrome =
  | {
      readonly chrome?: undefined;
      /** The published projects the footer lists (issue #378). */
      readonly footerProjects: readonly FooterProject[];
    }
  | { readonly chrome: "none"; readonly footerProjects?: undefined };

/** The projects the site footer lists, or null when the page draws no navbar and no footer. */
export function siteFooterOf(page: PageChrome): readonly FooterProject[] | null {
  return page.chrome === "none" ? null : page.footerProjects;
}
