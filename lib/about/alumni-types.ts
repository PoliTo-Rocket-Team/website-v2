// The Alumni page (/about/alumni): its copy, and the shapes
// components/about/alumni/ draws. What the page lists is built from the team
// record (./alumni-record.ts), never typed here (issue #257).

/** One or more items of T, in order. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** The founder mark on an alumni entry: the Team has one founder; the others are co-founders. */
export type FounderMark = "founder" | "co-founder";

/** A founder as "The founders" draws them. */
export type Founder = {
  name: string;
  title: FounderMark;
  /** What they did, under the name: their role in their first year on the page. */
  role: string;
  /** A photo in public/team/, or a public store URL. */
  photo?: string;
};

/** The small tag beside a name: a founder's, or a department head's or division lead's. */
export type Tag = "FOUNDER" | "CO-FOUNDER" | "HEAD" | "LEAD";

/** One row of a group's list. A lead's role is printed in accent. */
export type Entry = { name: string; role: string; lead: boolean; tag?: Tag };

/** A group as the page draws it: a heading, its rows, and how many rows show before "Show all". */
export type ShownGroup = {
  name: string;
  entries: NonEmpty<Entry>;
  /** Department groups print their head count beside the heading. */
  counted: boolean;
  /** Department groups and Advisors fold after 2 rows, the others after 3 (issue #95, board 28b). */
  firstRows: 2 | 3;
};

/** One academic year on the page: `start` is the calendar year it starts in (2022 is 2022–23). */
export type AcademicYear = { start: number; groups: NonEmpty<ShownGroup> };

/** The page's own words: everything on it that is not the team's people. */
export type AlumniCopy = {
  description: string;
  header: { eyebrow: string; title: string; intro: string };
  founders: { eyebrow: string; title: string };
  years: { eyebrow: string; title: string };
};

/** What the page shows, built from the record by `alumniPageData` (./alumni-data.ts). */
export type AlumniPageData = {
  founders: readonly Founder[];
  /** Newest first. */
  years: readonly AcademicYear[];
};
