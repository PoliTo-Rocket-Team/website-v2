import type { NonEmpty } from "./alumni-types";
import type { ProjectPage } from "@/lib/projects";

// The Mission & Vision page (/about/mission-vision) as data: one record,
// drawn by components/about/mission.tsx. A dashboard will edit it, so every
// field is a plain value a form can fill.

/** A short titled point, as the mission's three columns. */
export type Point = { title: string; body: string };

/** A step on the path; its number comes from its place in the list. */
export type PathStep = { name: string; body: string; href: ProjectPage };

export type MissionPage = {
  description: string;
  header: { eyebrow: string; title: string; intro: string };
  mission: {
    eyebrow: string;
    statement: string;
    points: readonly [Point, Point, Point];
  };
  vision: {
    eyebrow: string;
    title: string;
    paragraphs: NonEmpty<string>;
  };
  path: {
    eyebrow: string;
    title: string;
    steps: readonly [PathStep, PathStep, PathStep];
    /** The link under every step. */
    linkLabel: string;
  };
  beliefs: {
    eyebrow: string;
    lines: NonEmpty<string>;
    credit: string;
  };
};
