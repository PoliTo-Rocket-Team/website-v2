import type { Photo } from "./types";

// The Alumni page (/about/alumni) as data: one record, drawn by
// components/about/alumni/. A dashboard will edit it, so every field is a
// plain value a form can fill. A fact a person does not have is an absent
// key, never an empty string.

/** One or more items of T, in order. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** Someone in an academic year's list, with the role they held that year. */
export type Alum = { name: string; role: string };

/** A group of one academic year as the team's old site lists it: a heading and its people. */
export type RoleGroup = { name: string; people: NonEmpty<Alum> };

/** The departments, in the order the page draws them (issue #95). */
export const departments = [
  "Propulsion",
  "Structures",
  "Aerodynamics",
  "Recovery",
  "Controls and Systems",
  "Electronics",
  "Operations",
] as const;

export type Department = (typeof departments)[number];

/**
 * Someone in a department in an academic year grouped by department. A head
 * leads the department; a lead leads one of its divisions, which is what the
 * page prints as their role; a member has their own role.
 */
export type DepartmentMember =
  | { rank: "head"; name: string; role: string; department: Department }
  | { rank: "lead"; name: string; division: string; department: Department }
  | { rank: "member"; name: string; role: string; department: Department };

type YearBase = {
  /** The calendar year the academic year starts in: 2022 is 2022–23. */
  start: number;
  /** Stand-in data, to be replaced by the real list. The page never says so. */
  placeholder?: true;
};

/** An academic year listed by the old site's own groups (2021–22 to 2023–24). */
export type GroupedYear = YearBase & { kind: "groups"; groups: NonEmpty<RoleGroup> };

/** An academic year grouped by department (from 2024–25): leadership, the departments, then the advisors. */
export type DepartmentYear = YearBase & {
  kind: "departments";
  leadership: NonEmpty<Alum>;
  members: NonEmpty<DepartmentMember>;
  advisors: readonly Alum[];
};

export type AcademicYear = GroupedYear | DepartmentYear;

/** A founder of the Team. The Team has one founder; the others are co-founders. */
export type Founder = {
  name: string;
  title: "founder" | "co-founder";
  /** What they did, under the name: "Avionics". */
  role: string;
  photo?: Photo;
};

export type AlumniPage = {
  description: string;
  header: { eyebrow: string; title: string; intro: string };
  founders: { eyebrow: string; title: string; intro: string; people: NonEmpty<Founder> };
  years: {
    eyebrow: string;
    title: string;
    /** In any order: the page sorts them newest first. */
    list: NonEmpty<AcademicYear>;
  };
};
