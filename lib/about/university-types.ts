import type { NonEmpty } from "./alumni-types";
import type { HeaderStats, Photo } from "./types";

// The Our University page (/about/our-university) as data: one record, drawn
// by components/about/university.tsx. A dashboard will edit it, so every field
// is a plain value a form can fill.

/** A whole percent, 0 to 100. */
export type Percent = number;

export type UniversityPage = {
  description: string;
  header: {
    eyebrow: string;
    title: string;
    intro: string;
    stats: HeaderStats;
  };
  /** A photo in public/about/, cropped from the bottom so the entrance stays in view. */
  photo: { src: `/about/${string}`; alt: string };
  politecnico: {
    logo: Photo;
    name: string;
    title: string;
    paragraphs: NonEmpty<string>;
  };
  support: {
    eyebrow: string;
    title: string;
    note: string;
    /** Politecnico's share of the budget; external sponsors cover the rest. */
    share: Percent;
    universityLabel: string;
    sponsorsLabel: string;
    /** The pill to /partners. */
    partnersLink: string;
  };
};
