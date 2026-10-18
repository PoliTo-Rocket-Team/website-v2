// Every link the landing page draws (issue #359): the navbar, the sections
// and the footer read their targets from here, so one unit test
// (./landing-links.test.ts) walks them all: an internal link must name a page
// the app has, and an external one opens in a new tab. The components under
// components/landing/ write no link target of their own.

/** A page of this site: a path from its root. */
export type SitePath = `/${string}`;
/** A link to another site. */
export type ExternalUrl = `https://${string}` | `http://${string}`;
/** A mail link: not a page, so it opens where it is. */
export type MailLink = `mailto:${string}`;
export type LandingHref = SitePath | ExternalUrl | MailLink;

export type NavPage = { href: SitePath; label: string };
/**
 * A navbar entry with pages under it (About). It has no page of its own: it
 * opens a hover menu from lg and lists its pages in the sidebar.
 */
export type NavSection = { label: string; pages: readonly [NavPage, ...NavPage[]] };
export type NavLink = NavPage | NavSection;

export const TEAM_EMAIL = "info@politorocketteam.it";
export const TEAM_MAIL: MailLink = `mailto:${TEAM_EMAIL}`;

/** The pages the landing page links to by name. */
export const PAGES = {
  home: "/",
  projects: "/projects",
  outreach: "/outreach",
  partners: "/partners",
  apply: "/apply",
  login: "/login",
  dashboard: "/dashboard",
} as const satisfies Record<string, SitePath>;

/** One Outreach post's page; Track record links each card to its post. */
export function outreachPostHref(slug: string): SitePath {
  return `/outreach/${slug}`;
}

const ABOUT_PAGES = [
  { href: "/about/the-team", label: "The Team" },
  { href: "/about/alumni", label: "Alumni" },
  { href: "/about/our-university", label: "Our University" },
  { href: "/about/mission-vision", label: "Mission & Vision" },
] as const satisfies readonly [NavPage, ...NavPage[]];

/** The navbar's links, in the bar's order (board 21; the menu below lg, board 24b). */
export const NAV_LINKS: readonly NavLink[] = [
  { href: PAGES.projects, label: "Projects" },
  { label: "About", pages: ABOUT_PAGES },
  { href: PAGES.outreach, label: "Outreach" },
  { href: PAGES.partners, label: "Partners" },
  { href: PAGES.apply, label: "Apply" },
];

/** Inside the team's four link cards (board 21). */
export const INSIDE_TEAM_LINKS: readonly { title: string; sub: string; href: SitePath }[] = [
  { title: "The Team", sub: "The people flying this year's vehicle", href: ABOUT_PAGES[0].href },
  { title: "Alumni", sub: "Everyone who got us off the ground", href: ABOUT_PAGES[1].href },
  { title: "Our University", sub: "Where we study, build and get funded", href: ABOUT_PAGES[2].href },
  { title: "Mission & Vision", sub: "What we're trying to prove", href: ABOUT_PAGES[3].href },
];

export type FooterColumn = { head: string; links: readonly (readonly [label: string, href: LandingHref])[] };

/** The footer's four link columns (board 21). */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  { head: "ABOUT", links: ABOUT_PAGES.map((p) => [p.label, p.href] as const) },
  {
    head: "PROJECTS",
    links: [
      ["Cavour", "/projects/cavour"],
      ["VES", "/projects/ves"],
      ["Efesto", "/projects/efesto"],
    ],
  },
  {
    head: "GET INVOLVED",
    links: [
      ["Apply", PAGES.apply],
      ["Partners", PAGES.partners],
      ["Outreach", PAGES.outreach],
    ],
  },
  {
    head: "CONTACT",
    links: [
      [TEAM_EMAIL, TEAM_MAIL],
      ["Instagram", "https://www.instagram.com/politorocketteam"],
      ["LinkedIn", "https://www.linkedin.com/company/politorocketteam"],
      ["X / Twitter", "https://x.com/PoliTo_RT"],
    ],
  },
];

/** Every link target the landing page names here, data-driven ones (posts, partner sites) aside. */
export function landingHrefs(): readonly LandingHref[] {
  const nav = NAV_LINKS.flatMap((l) => ("pages" in l ? l.pages.map((p) => p.href) : [l.href]));
  return [
    ...Object.values(PAGES),
    ...nav,
    ...INSIDE_TEAM_LINKS.map((l) => l.href),
    ...FOOTER_COLUMNS.flatMap((c) => c.links.map(([, href]) => href)),
    TEAM_MAIL,
  ];
}

/** A link to another site: an absolute http(s) URL. */
export function isExternal(href: string): href is ExternalUrl {
  return /^https?:\/\//i.test(href);
}

/** How a link to another site opens: in a new tab, with no hold on this one. */
export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** The props that open `href` in a new tab when it leaves the site; none for a page or a mail link. */
export function opensOf(href: string): typeof NEW_TAB | Record<string, never> {
  return isExternal(href) ? NEW_TAB : {};
}
