import type { Copy } from "@/lib/projects";

// The Team page (/about/the-team) as data: one record, drawn by
// components/about/. Its people are built from the team's roles
// (./team-roles.ts); the rest is the hand-typed ./team.ts. Every field is a
// plain value a form can fill. A fact a person does not have is an absent key,
// never an empty string: no photo, no LinkedIn, no email, no role.

/** One to N items of T, in order. Bounds a count the layout is drawn for. */
export type UpTo<T, N extends number, R extends readonly T[] = readonly [T]> =
  | R
  | (R["length"] extends N ? never : UpTo<T, N, readonly [...R, T]>);

/** A photo in public/team/, given as its path from the site root. */
export type Photo = `/team/${string}`;

/** A person's photo: one in public/team/, or the public store URL a member uploaded (`members.picture`). */
export type PersonPhoto = Photo | `https://${string}`;

/** Someone the page shows. Without a photo its circle shows the PRT mark. */
export type Person = {
  name: string;
  photo?: PersonPhoto;
  /** The LinkedIn profile handle, the part after linkedin.com/in/. */
  linkedin?: string;
  email?: string;
};

/**
 * Someone who holds a seat beside the person its place shows first (issue
 * #880): drawn next to them, with their own photo, name and contacts, and
 * the place's role under the name.
 */
export type CoHolder = Person & { role: string };

/** A place's further holders, in order: one or more, never an empty list. */
export type CoHolders = readonly [CoHolder, ...CoHolder[]];

/**
 * A leader in the org chart: a person and the role under the name. A seat
 * with several holders draws the others beside them (`coHolders`); a seat
 * with one has none.
 */
export type Leader = Person & { role: string; coHolders?: CoHolders };

/**
 * The org chart: the university, the team leader under it, then up to eight
 * leaders on the arc. A stored layout whose team leader seat has no holder
 * draws no team leader, and one whose arc seats have none draws no arc (ADR
 * 0019 Decision 9); the hand-typed ./team.ts fills both.
 */
export type OrgChart = {
  eyebrow: string;
  title: string;
  university: { name: string; logo: Photo };
  leader: Leader | null;
  /**
   * In reading order. On desktop the first half sits left of the centre and
   * the rest right of it, each half from the centre outward; on phones they
   * fill a two-column grid in this order.
   */
  leaders: readonly [] | UpTo<Leader, 8>;
};

/** The lead of one division, under the head of its department. */
export type DivisionLead = Person & { division: string };

/**
 * A department head, with the leads of the department's divisions under them.
 * A department with several heads draws the others beside them
 * (`coHolders`), over the one set of leads.
 */
export type DepartmentHead = Person & {
  kind: "head";
  role: string;
  coHolders?: CoHolders;
  leads: readonly DivisionLead[];
};

/** A division drawn at a head's level, as Operations draws its divisions; it has no leads of its own. */
export type DivisionAsHead = Person & { kind: "division"; division: string };

export type GroupMember = DepartmentHead | DivisionAsHead;

/** One slide of the departments carousel. Members fill the grid row by row, in order. */
export type DepartmentGroup = { name: string; members: UpTo<GroupMember, 10> };

/**
 * The Departments section: its title and intro, then the carousel. Like
 * Advisors it has no eyebrow, since its title is already the section's label
 * (board 26's eyebrow repeated it, #645).
 */
export type Departments = {
  title: string;
  intro: string;
  /** None while no department head on the stored layout has a holder (ADR 0019 Decision 9): the page then leaves the section out. */
  groups: readonly [] | UpTo<DepartmentGroup, 5>;
};

/** Principal advisors (faculty, the founder) have their role in accent; specialists in grey. */
export type Advisor = Person & { role: string; standing: "principal" | "specialist" };

/** The Advisors section has a title and no eyebrow (board 26). */
export type Advisors = {
  title: string;
  intro: string;
  /**
   * In order; they fill three columns row by row on desktop. Hand-added in
   * the dashboard (lib/about/advisors.ts): with none, the page leaves the
   * section out.
   */
  people: readonly Advisor[];
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

/** A core member in the alphabetical list: a small round photo (or the PRT mark), the name, the role and LinkedIn (issue #366). */
export type Member = Pick<Person, "name" | "photo" | "linkedin"> & { role?: string };

export type CoreMembers = {
  /** The eyebrow before the member count. */
  eyebrow: string;
  title: string;
  /** A photo in public/team/, or one uploaded in the Team page editor (issue #510). */
  groupPhoto: { src: PersonPhoto; alt: string };
  /** None while the stored layout shows everyone with an active role (ADR 0019 Decision 9): the section then draws its heading and group photo alone. */
  members: readonly Member[];
};

export type HeaderStat = { value: string; label: Copy };

/** An About page header's figures: always four. */
export type HeaderStats = readonly [HeaderStat, HeaderStat, HeaderStat, HeaderStat];

/**
 * What a page header can show: four figures, or two where the page has only
 * two to count (the Outreach page, issue #496). Two sit in the first two of
 * the same four columns, so each figure keeps the width it has on every page.
 */
export type HeaderFigures = HeaderStats | readonly [HeaderStat, HeaderStat];

export type TeamPage = {
  description: string;
  header: {
    eyebrow: string;
    title: string;
    intro: string;
    stats: HeaderStats;
  };
  orgChart: OrgChart;
  departments: Departments;
  advisors: Advisors;
  inNumbers: InNumbers;
  coreMembers: CoreMembers;
};

/**
 * A Team page that fills every section the page always draws: a team leader,
 * one leader on the arc, one department group and one core member at least.
 * The hand-typed ./team.ts is one, and so is every page the editor's working
 * layer may draw (`teamPageOf`, ./team-roles.ts).
 */
export type FilledTeamPage = Omit<TeamPage, "orgChart" | "departments" | "coreMembers"> & {
  orgChart: Omit<OrgChart, "leader" | "leaders"> & { leader: Leader; leaders: UpTo<Leader, 8> };
  departments: Omit<Departments, "groups"> & { groups: UpTo<DepartmentGroup, 5> };
  coreMembers: Omit<CoreMembers, "members"> & { members: readonly [Member, ...Member[]] };
};
