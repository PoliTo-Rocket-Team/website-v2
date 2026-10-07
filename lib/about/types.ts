import type { Copy } from "@/lib/projects";

// The Team page (/about/the-team) as data: one record, drawn by
// components/about/. A dashboard will edit it, so every field is a plain
// value a form can fill. A fact a person does not have is an absent key,
// never an empty string: no photo, no LinkedIn, no email, no role.

/** One to N items of T, in order. Bounds a count the layout is drawn for. */
export type UpTo<T, N extends number, R extends readonly T[] = readonly [T]> =
  | R
  | (R["length"] extends N ? never : UpTo<T, N, readonly [...R, T]>);

/** A photo in public/team/, given as its path from the site root. */
export type Photo = `/team/${string}`;

/** Someone the page shows. Without a photo a large circle shows the PRT mark, a small one the initials. */
export type Person = {
  name: string;
  photo?: Photo;
  /** The LinkedIn profile handle, the part after linkedin.com/in/. */
  linkedin?: string;
  email?: string;
};

/** A leader in the org chart: a person and the role under the name. */
export type Leader = Person & { role: string };

/** The org chart: the university, the team leader under it, then up to eight leaders on the arc. */
export type OrgChart = {
  eyebrow: string;
  title: string;
  university: { name: string; logo: Photo };
  leader: Leader;
  /**
   * In reading order. On desktop the first half sits left of the centre and
   * the rest right of it, each half from the centre outward; on phones they
   * fill a two-column grid in this order.
   */
  leaders: UpTo<Leader, 8>;
};

/** The lead of one division, under the head of its department. */
export type DivisionLead = Person & { division: string };

/** A department head, with the leads of the department's divisions under them. */
export type DepartmentHead = Person & {
  kind: "head";
  role: string;
  leads: readonly DivisionLead[];
};

/** A division drawn at a head's level, as Operations draws its divisions; it has no leads of its own. */
export type DivisionAsHead = Person & { kind: "division"; division: string };

export type GroupMember = DepartmentHead | DivisionAsHead;

/** One slide of the departments carousel. Members fill the grid row by row, in order. */
export type DepartmentGroup = { name: string; members: UpTo<GroupMember, 10> };

export type Departments = {
  eyebrow: string;
  title: string;
  intro: string;
  groups: UpTo<DepartmentGroup, 5>;
};

/** Principal advisors (faculty, the founder) have their role in accent; specialists in grey. */
export type Advisor = Person & { role?: string; standing: "principal" | "specialist" };

/** The Advisors section has a title and no eyebrow (board 26). */
export type Advisors = {
  title: string;
  intro: string;
  /** In order; they fill three columns row by row on desktop. */
  people: readonly [Advisor, ...Advisor[]];
};

/** One slice of a pie, as a share of the whole in percent. */
export type Slice = { label: string; percent: number };

/** A pie chart. Slices are drawn clockwise from the top, largest group first. */
export type Pie = { title: string; slices: UpTo<Slice, 6> };

export type InNumbers = {
  eyebrow: string;
  title: string;
  charts: readonly [Pie, Pie, Pie];
};

/** A core member in the alphabetical list. */
export type Member = { name: string; role?: string; linkedin?: string };

export type CoreMembers = {
  /** The eyebrow before the member count. */
  eyebrow: string;
  title: string;
  groupPhoto: { src: Photo; alt: string };
  members: readonly [Member, ...Member[]];
};

export type HeaderStat = { value: string; label: Copy };

export type TeamPage = {
  description: string;
  header: {
    eyebrow: string;
    title: string;
    intro: string;
    stats: readonly [HeaderStat, HeaderStat, HeaderStat, HeaderStat];
  };
  orgChart: OrgChart;
  departments: Departments;
  advisors: Advisors;
  inNumbers: InNumbers;
  coreMembers: CoreMembers;
};
