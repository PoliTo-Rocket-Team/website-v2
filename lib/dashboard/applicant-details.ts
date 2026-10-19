import { detailText, NO_DETAILS } from "./details";
import { normalizeLinkedin } from "./self";

// What an applicant gave, as the Applications panel shows it (issue #406):
// every field the apply form (lib/apply/application-form.ts) and "Your
// details" (./details.ts) collect, grouped as the panel lists them. A field
// left empty is not shown, and a group with nothing in it is not shown.

/** The applicant's fields as stored on their `users` row; null where they gave nothing. */
export type ApplicantDetails = {
  readonly email: string;
  readonly phone: string | null;
  /** As stored: the digits, or the digits after an "s". */
  readonly politoId: string | null;
  /** The study programme: "Year 1 Master's". */
  readonly year: string | null;
  /** The degree programme: "Aerospace Engineering". */
  readonly degree: string | null;
  /** ISO date, "2003-03-14". */
  readonly birthDate: string | null;
  /** As the application form asked it; it also picks "she", "he" or "they" in the dialogs. */
  readonly gender: string | null;
  readonly country: string | null;
  /** "International" or "Domestic". */
  readonly origin: string | null;
  /** As stored: "https://www.linkedin.com/in/giuliarossi" or the short form. */
  readonly linkedin: string | null;
  /** How they found out about the team: "Instagram". */
  readonly referral: string | null;
};

/** One shown field; `href` when the value is a link that opens in a new tab. */
export type ApplicantField = { readonly label: string; readonly value: string; readonly href?: string };

export type ApplicantSection = { readonly title: string; readonly fields: readonly ApplicantField[] };

/** A stored value with its spaces trimmed; null when nothing is left. */
function filled(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** "s312456", whether the "s" was stored or not. */
function politoIdText(stored: string): string {
  return `s${stored.replace(/^s/i, "")}`;
}

/** "14 Mar 2003" for an ISO date; anything else as stored. */
function birthDateText(stored: string): string {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(stored) ? (detailText({ ...NO_DETAILS, birthDate: stored }, "birthDate") ?? stored) : stored;
}

/** The short LinkedIn form with its link; a stored value that is not a profile link shows as text. */
function linkedinField(stored: string): ApplicantField {
  const short = normalizeLinkedin(stored);
  return short.ok && short.value !== null
    ? { label: "LinkedIn", value: short.value, href: `https://www.${short.value}` }
    : { label: "LinkedIn", value: stored };
}

function field(label: string, stored: string | null, text: (value: string) => string = (value) => value): ApplicantField[] {
  const value = filled(stored);
  return value === null ? [] : [{ label, value: text(value) }];
}

/** The panel's groups in order: Contact, Studies, Personal, Links; empty fields and groups left out. */
export function applicantSections(d: ApplicantDetails): ApplicantSection[] {
  const linkedin = filled(d.linkedin);
  const sections: ApplicantSection[] = [
    {
      title: "Contact",
      fields: [...field("Email", d.email), ...field("Phone", d.phone), ...field("PoliTo ID", d.politoId, politoIdText)],
    },
    { title: "Studies", fields: [...field("Year", d.year), ...field("Degree", d.degree)] },
    {
      title: "Personal",
      fields: [
        ...field("Birth date", d.birthDate, birthDateText),
        ...field("Gender", d.gender),
        ...field("Country", d.country),
        ...field("Origin", d.origin),
        ...field("Found us through", d.referral),
      ],
    },
    { title: "Links", fields: linkedin === null ? [] : [linkedinField(linkedin)] },
  ];
  return sections.filter((s) => s.fields.length > 0);
}
