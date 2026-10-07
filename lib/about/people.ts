import type { Member, Person } from "./types";

/** The first letters of a name's first two words, as boards 26 and 26m draw them: "Maria Angelica Fullone Penna" is "MA". A title such as "Prof." is skipped. */
export function initials(name: string): string {
  const words = name.split(" ").filter((w) => w !== "" && !w.endsWith("."));
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

export function linkedinUrl(handle: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(handle)}`;
}

/** The ways to reach a person, in the order the icons are drawn. */
export function contactsOf(person: Pick<Person, "linkedin" | "email">) {
  return {
    linkedin: person.linkedin === undefined ? undefined : linkedinUrl(person.linkedin),
    email: person.email === undefined ? undefined : `mailto:${person.email}`,
  };
}

/** Lower case with accents removed, so "dundar" finds "Dündar". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Members whose name or role holds every word of the query, in list order. */
export function searchMembers<M extends Member>(members: readonly M[], query: string): readonly M[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return members;
  return members.filter((m) => {
    const text = fold(`${m.name} ${m.role ?? ""}`);
    return words.every((w) => text.includes(w));
  });
}
