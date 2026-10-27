import type { PersonField } from "./columns";
import type { At, Conflict } from "./conflicts";
import type { PersonRow, QuitterRow, Row, Sources } from "./sources";

// Who is who across the sources (issue #677). The match rule: a row is the
// person who already has one of its emails (any email column of any sheet, and
// a CSV's `poli_email`, compared in lower case); failing that, the person with
// its normalized full name (accents, case, punctuation and spacing do not
// count). Year sheets are read newest first, so where sheets disagree on a
// personal field the newest one wins. A year sheet starts a new person, and so
// does a `Quitters` row that matches nobody on any year sheet (a quitter-only
// alumnus, issue #816). `Roles YY-YY` rows and CSV rows attach to a person the
// sheets found, and a CSV value only fills a field the workbook left empty. A
// sheet row with no name never reaches here (./sources.ts leaves it out), so
// it is never matched by its emails.

const EMAIL_FIELDS = ["personalEmail", "studentEmail", "phdEmail", "prtEmail"] as const satisfies readonly PersonField[];

/** The personal fields a person carries onto `users` and `members`. */
export const PERSONAL_FIELDS = [
  "firstName",
  "lastName",
  "studentId",
  "personalEmail",
  "studentEmail",
  "phdEmail",
  "prtEmail",
  "mobile",
  "linkedin",
  "discord",
  "program",
  "origin",
  "country",
  "level",
] as const satisfies readonly PersonField[];

type PersonalField = (typeof PERSONAL_FIELDS)[number];

/** One person: every row that is them, and their fields, the newest sheet's first. */
export type Person = {
  readonly id: number;
  readonly emails: Set<string>;
  readonly names: Set<string>;
  readonly fields: Partial<Record<PersonalField, string>>;
  /** Their row on each year sheet, by academic year; empty for a quitter-only person. */
  readonly years: Map<number, PersonRow>;
  /** Their `Roles YY-YY` row, by academic year. */
  readonly rolesRows: Map<number, Row<"firstName" | "lastName" | "subteam" | "division" | "title">>;
  quitter: QuitterRow | null;
  /** The CSV rows that are them, by file, with the row's id where the file has one. */
  readonly csvIds: Set<string>;
};

/** The email cells of a row that hold an email, in lower case. */
export function emailsOf(value: Partial<Record<string, string>>, fields: readonly string[] = EMAIL_FIELDS): string[] {
  return fields.map((f) => normalEmail(value[f] ?? "")).filter((e): e is string => e !== null);
}

export function normalEmail(text: string): string | null {
  const e = text.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** How the match rule compares names. */
export function nameKey(first: string, last: string): string {
  return `${first} ${last}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The address a person signs in with: their personal (Google) mail, else the first other email the workbook gives. */
export function signInEmail(person: Person): string | null {
  for (const f of EMAIL_FIELDS) {
    const e = normalEmail(person.fields[f] ?? "");
    if (e !== null) return e;
  }
  return [...person.emails][0] ?? null;
}

export type People = {
  readonly people: readonly Person[];
  /** The person each `people_rows.csv` id is, where the row matched one: a photo file's id reaches its person through this. */
  readonly byPeopleId: ReadonlyMap<string, Person>;
  readonly conflicts: readonly Conflict[];
};

class Matcher {
  readonly people: Person[] = [];
  readonly conflicts: Conflict[] = [];
  private readonly byEmail = new Map<string, Person>();
  private readonly byName = new Map<string, Person[]>();

  /** The person a row is, or null; notes a row that matches two different people. */
  match(emails: readonly string[], name: string, at: At): Person | null {
    const byEmail = [...new Set(emails.flatMap((e) => this.byEmail.get(e) ?? []))];
    const byName = name === "" ? [] : (this.byName.get(name) ?? []);
    const ambiguous =
      byEmail.length > 1 || (byEmail.length === 1 && byName.length > 0 && !byName.includes(byEmail[0])) || (byEmail.length === 0 && byName.length > 1);
    if (ambiguous) this.conflicts.push({ kind: "ambiguous-match", at });
    return byEmail[0] ?? byName[0] ?? null;
  }

  start(): Person {
    const person: Person = { id: this.people.length + 1, emails: new Set(), names: new Set(), fields: {}, years: new Map(), rolesRows: new Map(), quitter: null, csvIds: new Set() };
    this.people.push(person);
    return person;
  }

  learn(person: Person, emails: readonly string[], name: string): void {
    for (const e of emails) {
      person.emails.add(e);
      if (!this.byEmail.has(e)) this.byEmail.set(e, person);
    }
    if (name !== "" && !person.names.has(name)) {
      person.names.add(name);
      this.byName.set(name, [...(this.byName.get(name) ?? []), person]);
    }
  }
}

/** Fills the fields the person does not have yet from a row: the first source to give a field keeps it. */
function fill(person: Person, value: Partial<Record<string, string>>): void {
  for (const f of PERSONAL_FIELDS) {
    const v = value[f]?.trim() ?? "";
    if (v !== "" && person.fields[f] === undefined) person.fields[f] = v;
  }
}

/** How a CSV value is compared with the workbook's: case and spacing do not count, nor a LinkedIn link's prefix. */
function comparable(field: string, text: string): string {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  return field === "linkedin" ? t.replace(/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\//, "").replace(/\/$/, "") : t;
}

/** Matches every row of the sources to the people they are. */
export function matchPeople(sources: Sources): People {
  const m = new Matcher();

  for (const sheet of sources.years) {
    const seen = new Set<Person>();
    for (const row of sheet.rows) {
      const emails = emailsOf(row.value);
      const name = nameKey(row.value.firstName, row.value.lastName);
      const found = m.match(emails, name, row.at);
      if (found !== null && seen.has(found)) {
        m.conflicts.push({ kind: "duplicate", at: row.at });
        continue;
      }
      const person = found ?? m.start();
      seen.add(person);
      m.learn(person, emails, name);
      person.years.set(sheet.year, row);
      fill(person, row.value);
    }
  }

  for (const sheet of sources.rolesSheets) {
    const seen = new Set<Person>();
    for (const row of sheet.rows) {
      const person = m.match([], nameKey(row.value.firstName, row.value.lastName), row.at);
      if (person === null || !person.years.has(sheet.year)) {
        m.conflicts.push({ kind: "roles-sheet-unmatched", at: row.at });
        continue;
      }
      if (seen.has(person)) {
        m.conflicts.push({ kind: "duplicate", at: row.at });
        continue;
      }
      seen.add(person);
      person.rolesRows.set(sheet.year, row);
    }
  }

  // A Quitters row on no year sheet starts a person of its own, after every year
  // sheet row has been matched: a quitter-only alumnus (issue #816).
  const quitters = new Set<Person>();
  const lonely: QuitterRow[] = [];
  const attach = (person: Person, row: QuitterRow, emails: readonly string[], name: string) => {
    quitters.add(person);
    person.quitter = row;
    m.learn(person, emails, name);
    fill(person, row.value);
  };
  for (const row of sources.quitters) {
    const emails = emailsOf(row.value);
    const person = m.match(emails, nameKey(row.value.firstName, row.value.lastName), row.at);
    if (person === null) lonely.push(row);
    else if (quitters.has(person)) m.conflicts.push({ kind: "duplicate", at: row.at });
    else attach(person, row, emails, "");
  }
  for (const row of lonely) {
    const emails = emailsOf(row.value);
    const name = nameKey(row.value.firstName, row.value.lastName);
    const found = m.match(emails, name, row.at);
    if (found !== null) m.conflicts.push({ kind: "duplicate", at: row.at });
    else attach(m.start(), row, emails, name);
  }

  const fromCsv = (rows: readonly Row<string>[], fields: readonly PersonalField[], emailFields: readonly string[], byId?: Map<string, Person>) => {
    const seen = new Set<Person>();
    for (const row of rows) {
      const emails = emailsOf(row.value, emailFields);
      const person = m.match(emails, nameKey(row.value.firstName ?? "", row.value.lastName ?? ""), row.at);
      if (person === null) continue;
      if (seen.has(person)) {
        m.conflicts.push({ kind: "duplicate", at: row.at });
        continue;
      }
      seen.add(person);
      const own = row.value.id?.trim() ?? "";
      if (byId !== undefined && own !== "") byId.set(own, person);
      for (const id of [row.value.id, row.value.user]) if (id !== undefined && id.trim() !== "") person.csvIds.add(id.trim());
      for (const f of fields) {
        const v = row.value[f]?.trim() ?? "";
        if (v === "") continue;
        const kept = person.fields[f];
        if (kept === undefined) person.fields[f] = v;
        else if (comparable(f, kept) !== comparable(f, v)) m.conflicts.push({ kind: "csv-disagrees", at: row.at, field: f });
      }
      m.learn(person, emails, "");
    }
  };
  fromCsv(sources.csv.teamMembers, ["studentEmail", "linkedin", "program", "level", "origin"], ["studentEmail"]);
  const byPeopleId = new Map<string, Person>();
  fromCsv(sources.csv.people, ["linkedin"], [], byPeopleId);

  return { people: m.people, byPeopleId, conflicts: m.conflicts };
}
