import type { Spec } from "@/lib/projects";
import { copyFields, copyOf, type CopyFields } from "./copy-fields";
import type { HomeCard, ProjectRecord } from "./record";

// The Card section of the Edit <project> panel (board 75d, issue #300): the
// project's card as Home draws it, which the page switch shows in place on
// Home and on the Projects list. It edits the card's own copy (its year, its
// status pill, its description and its three specs) and the project's name,
// which the card, the page and the /projects entry all show. The card's
// number is its place in the site order, set by dragging on the Projects
// page, so it is not a field. Its texture tint and its rocket are carried
// over from the version the panel opened on.

export type SpecFields = { readonly label: CopyFields; readonly value: CopyFields };

export type CardFields = {
  /** The project's name, everywhere it shows. */
  readonly name: string;
  readonly year: CopyFields;
  /** The pill's own text. A rocket may count its flights instead, and then the text is kept but not shown. */
  readonly status: string;
  /** A rocket's pill reads "FLOWN ×<n>" off its launch history. An engine has no flights, so its pill is always the text. */
  readonly countsFlights: boolean;
  readonly statusTone: HomeCard["statusTone"];
  readonly desc: CopyFields;
  readonly specs: readonly [SpecFields, SpecFields, SpecFields];
};

/** Whether the pill counts flights: only a rocket's can. */
export const countsFlights = (kind: ProjectRecord["kind"], card: CardFields): boolean => kind === "vehicle" && card.countsFlights;

const specFields = (spec: Spec): SpecFields => ({ label: copyFields(spec.label), value: copyFields(spec.value) });
const specOf = (spec: SpecFields): Spec => ({ label: copyOf(spec.label), value: copyOf(spec.value) });

export function cardFieldsOf(record: ProjectRecord): CardFields {
  const { status } = record.card;
  const [a, b, c] = record.card.specs;
  return {
    name: record.name,
    year: copyFields(record.card.year),
    status: typeof status === "string" ? status : "",
    countsFlights: typeof status !== "string",
    statusTone: record.card.statusTone,
    desc: copyFields(record.card.desc),
    specs: [specFields(a), specFields(b), specFields(c)],
  };
}

/** The record with the Card section laid over it, as Home and the Projects list draw it while the editor types. */
export function withCardFields(record: ProjectRecord, fields: CardFields): ProjectRecord {
  const [a, b, c] = fields.specs;
  const copy = {
    year: copyOf(fields.year),
    statusTone: fields.statusTone,
    desc: copyOf(fields.desc),
    specs: [specOf(a), specOf(b), specOf(c)] as const,
  };
  const name = fields.name.trim();
  const status = fields.status.trim();
  if (record.kind === "engine") return { ...record, name, card: { ...record.card, ...copy, status } };
  return { ...record, name, card: { ...record.card, ...copy, status: countsFlights(record.kind, fields) ? { count: "flights" } : status } };
}

/** The Card section after a save: the stored card's, keeping the pill text a flight count left unstored. */
export function cardFieldsAfterSave(stored: ProjectRecord, sent: CardFields): CardFields {
  const fields = cardFieldsOf(stored);
  return fields.countsFlights ? { ...fields, status: sent.status } : fields;
}

/** One field of the Card section that cannot be saved as it is. */
export type CardProblem = { readonly section: "card"; readonly field: string; readonly error: string };

export function cardProblems(fields: CardFields): CardProblem[] {
  const problems: CardProblem[] = [];
  const need = (field: string, value: string, what: string) => {
    if (value.trim() === "") problems.push({ section: "card", field, error: `Fill in ${what}.` });
  };
  need("card.name", fields.name, "the project's name");
  need("card.year", fields.year.text, "the card's year");
  if (!fields.countsFlights) need("card.status", fields.status, "the card's status");
  need("card.desc", fields.desc.text, "the card's description");
  fields.specs.forEach((spec, i) => {
    need(`card.specs.${i}.label`, spec.label.text, `spec ${i + 1}'s label`);
    need(`card.specs.${i}.value`, spec.value.text, `spec ${i + 1}'s value`);
  });
  return problems;
}

// What the browser sent, read back field by field.

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const readCopy = (v: unknown): CopyFields | null =>
  isObject(v) && typeof v.text === "string" && typeof v.phone === "string" ? { text: v.text, phone: v.phone } : null;
const readSpec = (v: unknown): SpecFields | null => {
  if (!isObject(v)) return null;
  const label = readCopy(v.label);
  const value = readCopy(v.value);
  return label === null || value === null ? null : { label, value };
};

export function readCardFields(v: unknown): CardFields | null {
  if (!isObject(v) || typeof v.name !== "string" || typeof v.status !== "string" || typeof v.countsFlights !== "boolean") return null;
  if (v.statusTone !== "dark" && v.statusTone !== "light") return null;
  const year = readCopy(v.year);
  const desc = readCopy(v.desc);
  if (year === null || desc === null || !Array.isArray(v.specs) || v.specs.length !== 3) return null;
  const [a, b, c] = v.specs.map(readSpec);
  if (a === null || b === null || c === null) return null;
  return { name: v.name, year, status: v.status, countsFlights: v.countsFlights, statusTone: v.statusTone, desc, specs: [a, b, c] };
}
