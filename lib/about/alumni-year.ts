import type { AcademicYear, AlumniPageData, Founder } from "./alumni-types";

// What the Alumni page reads off what it shows: the year switch's slugs and
// labels, the selected year, the founders' intro and the header's figures.

/** "2022-23", the year's key in the URL (?year=2022-23). */
export function yearSlug(year: Pick<AcademicYear, "start">): string {
  return `${year.start}-${String((year.start + 1) % 100).padStart(2, "0")}`;
}

/** "2022 – 23", as the year switch prints it. Site copy has no em dashes. */
export function yearLabel(year: Pick<AcademicYear, "start">): string {
  return `${year.start} – ${String((year.start + 1) % 100).padStart(2, "0")}`;
}

/** The year a `?year=` value names, or the newest year when it names none; null when there are no years. */
export function selectedYear(newestFirst: readonly AcademicYear[], slug: string | undefined): AcademicYear | null {
  return newestFirst.find((y) => yearSlug(y) === slug) ?? newestFirst[0] ?? null;
}

/**
 * Whether a role leads (issue #95: Lead, Chief, Coordinator, President,
 * Officer, Head, Manager and the like). A vice-lead does not.
 */
export function leadsByRole(role: string): boolean {
  return /\b(chief|coordinator|president|officer|head|manager|leader)\b|(?<!vice-)\blead\b/i.test(role);
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;

/** "Fabio Meloni founded the PoliTo Rocket Team with five co-founders.", from the founder marks. */
export function foundersIntro(founders: readonly Founder[]): string {
  const founder = founders.find((f) => f.title === "founder");
  const others = founders.filter((f) => f.title === "co-founder").length;
  const count = COUNT_WORDS[others] ?? String(others);
  const coFounders = `${count} co-founder${others === 1 ? "" : "s"}`;
  if (founder === undefined) return `The PoliTo Rocket Team was founded by ${coFounders}.`;
  return `${founder.name} founded the PoliTo Rocket Team${others === 0 ? "" : ` with ${coFounders}`}.`;
}

/** The header's figures: the people listed, the academic years, the founders and the first year. */
export function headerStats(page: AlumniPageData) {
  const people = new Set(page.years.flatMap((y) => y.groups.flatMap((g) => g.entries.map((e) => e.name))));
  const starts = page.years.map((y) => y.start);
  return [
    { value: String(people.size), label: { text: "PEOPLE" } },
    { value: String(page.years.length), label: { text: "ACADEMIC YEARS", phone: "YEARS" } },
    { value: String(page.founders.length), label: { text: "FOUNDERS" } },
    { value: starts.length === 0 ? "–" : String(Math.min(...starts)), label: { text: "FIRST YEAR", phone: "SINCE" } },
  ] as const;
}
