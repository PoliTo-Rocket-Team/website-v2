import { EMAIL_FIELDS } from "./columns";
import type { QuitterRow, Roster } from "./roster";

// Who a Quitters row is across the year sheets (issue #913), by the import's
// match rule (scripts/import/people.ts, issue #677): a row is the person who
// already has one of its emails (any email column, in lower case); failing
// that, the person with its normalized full name (accents, case, punctuation
// and spacing do not count). Year sheets are read newest first and each starts
// a person no earlier row matched. A Quitters row is then matched to them.

/** A person the year sheets give: the years they are on, and every email their rows and Quitters row carry. */
export type SheetPerson = { readonly years: ReadonlySet<number>; readonly emails: ReadonlySet<string> };

/** What a Quitters row is: a person on a year sheet, nobody on one, a second row for one person, or a row that matches two people. */
export type QuitterMatch =
  | { readonly kind: "person"; readonly row: QuitterRow; readonly person: SheetPerson }
  | { readonly kind: "quitter-only"; readonly row: QuitterRow }
  | { readonly kind: "duplicate"; readonly row: QuitterRow }
  | { readonly kind: "ambiguous-match"; readonly row: QuitterRow };

export function normalEmail(text: string): string | null {
  const e = text.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** The email cells of a row that hold an email, in lower case. */
function emailsOf(value: Readonly<Record<string, string>>): string[] {
  return EMAIL_FIELDS.map((f) => normalEmail(value[f] ?? "")).filter((e): e is string => e !== null);
}

/** How the match rule compares names. */
function nameKey(first: string, last: string): string {
  return `${first} ${last}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Person = { years: Set<number>; emails: Set<string>; names: Set<string> };

/** Matches each Quitters row of the roster to the person the year sheets give, in sheet order. */
export function matchQuitters(roster: Roster): QuitterMatch[] {
  const people: Person[] = [];
  const byEmail = new Map<string, Person>();
  const byName = new Map<string, Person[]>();
  const learn = (person: Person, emails: readonly string[], name: string) => {
    for (const e of emails) {
      person.emails.add(e);
      if (!byEmail.has(e)) byEmail.set(e, person);
    }
    if (name !== "" && !person.names.has(name)) {
      person.names.add(name);
      byName.set(name, [...(byName.get(name) ?? []), person]);
    }
  };
  /** The people a row's emails, else its name, find. */
  const found = (emails: readonly string[], name: string): Person[] => {
    const viaEmail = [...new Set(emails.flatMap((e) => byEmail.get(e) ?? []))];
    if (viaEmail.length > 0) return viaEmail;
    return name === "" ? [] : (byName.get(name) ?? []);
  };

  for (const sheet of roster.years) {
    const seen = new Set<Person>();
    for (const row of sheet.rows) {
      const emails = emailsOf(row.value);
      const name = nameKey(row.value.firstName, row.value.lastName);
      const person = found(emails, name)[0];
      if (person !== undefined && seen.has(person)) continue;
      const p = person ?? { years: new Set<number>(), emails: new Set<string>(), names: new Set<string>() };
      if (person === undefined) people.push(p);
      seen.add(p);
      learn(p, emails, name);
      p.years.add(sheet.year);
    }
  }

  const quitting = new Set<Person>();
  return roster.quitters.map((row): QuitterMatch => {
    const emails = emailsOf(row.value);
    const hits = found(emails, nameKey(row.value.firstName, row.value.lastName));
    if (hits.length === 0) return { kind: "quitter-only", row };
    if (hits.length > 1) return { kind: "ambiguous-match", row };
    const person = hits[0];
    if (quitting.has(person)) return { kind: "duplicate", row };
    quitting.add(person);
    return { kind: "person", row, person: { years: person.years, emails: new Set([...person.emails, ...emails]) } };
  });
}
