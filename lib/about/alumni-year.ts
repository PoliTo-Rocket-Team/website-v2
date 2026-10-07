import {
  departments,
  type AcademicYear,
  type Alum,
  type AlumniPage,
  type DepartmentMember,
  type DepartmentYear,
  type Founder,
  type NonEmpty,
} from "./alumni-types";

// What the Alumni page reads off its record: the years in order, each year's
// groups with their people sorted and tagged, and the header's figures.

/** "2022-23", the year's key in the URL (?year=2022-23). */
export function yearSlug(year: Pick<AcademicYear, "start">): string {
  return `${year.start}-${String((year.start + 1) % 100).padStart(2, "0")}`;
}

/** "2022 – 23", as the year switch prints it. Site copy has no em dashes. */
export function yearLabel(year: Pick<AcademicYear, "start">): string {
  return `${year.start} – ${String((year.start + 1) % 100).padStart(2, "0")}`;
}

/** The years newest first, as the year switch lists them. */
export function yearsNewestFirst(list: NonEmpty<AcademicYear>): NonEmpty<AcademicYear> {
  const [first, ...rest] = [...list].sort((a, b) => b.start - a.start);
  return [first!, ...rest];
}

/** The year a `?year=` value names, or the newest year when it names none. */
export function selectedYear(list: NonEmpty<AcademicYear>, slug: string | undefined): AcademicYear {
  const years = yearsNewestFirst(list);
  return years.find((y) => yearSlug(y) === slug) ?? years[0];
}

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
  /** Department groups fold after 2 rows, the others after 3 (issue #95). */
  firstRows: 2 | 3;
};

/**
 * Whether a role leads (issue #95: Lead, Chief, Coordinator, President,
 * Officer, Head, Manager and the like). A vice-lead does not.
 */
export function leadsByRole(role: string): boolean {
  return /\b(chief|coordinator|president|officer|head|manager|leader)\b|(?<!vice-)\blead\b/i.test(role);
}

function founderTag(founders: readonly Founder[], name: string): Tag | undefined {
  const founder = founders.find((f) => f.name === name);
  if (founder === undefined) return undefined;
  return founder.title === "founder" ? "FOUNDER" : "CO-FOUNDER";
}

/** Leads first, then founders, then everyone else, each in record order (board 28). */
function leadsFirst(people: NonEmpty<Alum>, founders: readonly Founder[]): NonEmpty<Entry> {
  const entries = people.map((p): Entry => {
    const tag = founderTag(founders, p.name);
    return { name: p.name, role: p.role, lead: leadsByRole(p.role), ...(tag && { tag }) };
  });
  const rank = (e: Entry) => (e.lead ? 0 : e.tag !== undefined ? 1 : 2);
  const [first, ...rest] = entries.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map(({ e }) => e);
  return [first!, ...rest];
}

function departmentEntry(m: DepartmentMember, founders: readonly Founder[]): Entry {
  const founder = founderTag(founders, m.name);
  switch (m.rank) {
    case "head":
      return { name: m.name, role: m.role, lead: true, tag: founder ?? "HEAD" };
    case "lead":
      return { name: m.name, role: m.division, lead: true, tag: founder ?? "LEAD" };
    case "member":
      return { name: m.name, role: m.role, lead: false, ...(founder && { tag: founder }) };
  }
}

const rankOrder = { head: 0, lead: 1, member: 2 } as const;

/** Leadership, then each department with people (head, leads, members), then the advisors. */
function departmentGroups(year: DepartmentYear, founders: readonly Founder[]): ShownGroup[] {
  const groups: ShownGroup[] = [{ name: "Leadership", entries: leadsFirst(year.leadership, founders), counted: false, firstRows: 3 }];
  for (const department of departments) {
    const people = year.members
      .filter((m) => m.department === department)
      .map((m, i) => ({ m, i }))
      .sort((a, b) => rankOrder[a.m.rank] - rankOrder[b.m.rank] || a.i - b.i)
      .map(({ m }) => departmentEntry(m, founders));
    const [first, ...rest] = people;
    if (first !== undefined) groups.push({ name: department, entries: [first, ...rest], counted: true, firstRows: 2 });
  }
  const [firstAdvisor, ...advisors] = year.advisors;
  if (firstAdvisor !== undefined) {
    groups.push({ name: "Advisors", entries: leadsFirst([firstAdvisor, ...advisors], founders), counted: false, firstRows: 3 });
  }
  return groups;
}

/** The groups of one academic year, in the order the page draws them. */
export function groupsOf(year: AcademicYear, founders: readonly Founder[]): ShownGroup[] {
  if (year.kind === "departments") return departmentGroups(year, founders);
  return year.groups.map((g) => ({ name: g.name, entries: leadsFirst(g.people, founders), counted: false, firstRows: 3 }));
}

function namesOf(year: AcademicYear): string[] {
  if (year.kind === "groups") return year.groups.flatMap((g) => g.people.map((p) => p.name));
  return [...year.leadership, ...year.members, ...year.advisors].map((p) => p.name);
}

/** The header's figures: people across the real years, academic years, founders and the first year. */
export function headerStats(page: AlumniPage) {
  const years = page.years.list;
  // Placeholder years hold stand-in names, so they add no people.
  const people = new Set(years.filter((y) => y.placeholder !== true).flatMap(namesOf));
  return [
    { value: String(people.size), label: { text: "PEOPLE" } },
    { value: String(years.length), label: { text: "ACADEMIC YEARS", phone: "YEARS" } },
    { value: String(page.founders.people.length), label: { text: "FOUNDERS" } },
    { value: String(Math.min(...years.map((y) => y.start))), label: { text: "FIRST YEAR", phone: "SINCE" } },
  ] as const;
}
