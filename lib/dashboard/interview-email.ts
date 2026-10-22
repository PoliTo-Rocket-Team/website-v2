import { firstNameOf } from "./application-flow";

// The interview invitation the lead sends from their own mail app (board 58c,
// issue #207). The site sends no email: Move to interview's "Open email"
// opens this as a mailto: link, subject and body filled in, for the lead to
// read and send.

export type InterviewEmail = {
  /** The applicant's address. */
  readonly to: string;
  /** The applicant's full name; the greeting uses the first name. */
  readonly applicant: string;
  /** The position's title. */
  readonly position: string;
  /** The lead's name, who signs it. */
  readonly lead: string;
  /** Where the site runs, such as "https://politorocketteam.it", with no trailing slash. */
  readonly site: string;
};

export function interviewEmailSubject(position: string): string {
  return `PoliTo Rocket Team — interview for ${position}`;
}

export function interviewEmailBody({ applicant, position, lead, site }: InterviewEmail): string {
  return [
    `Hi ${firstNameOf(applicant)},`,
    "",
    `Thank you for applying to the PoliTo Rocket Team. We would like to invite you to an interview for ${position}.`,
    "",
    `Please sign in at ${site.replace(/\/+$/, "")}/dashboard, open My applications and pick one of the times we offered.`,
    "",
    "Best regards,",
    lead,
  ].join("\n");
}

/** The mailto: link, with the subject and body URL-encoded. */
export function interviewEmailHref(email: InterviewEmail): string {
  const subject = encodeURIComponent(interviewEmailSubject(email.position));
  const body = encodeURIComponent(interviewEmailBody(email));
  return `mailto:${email.to}?subject=${subject}&body=${body}`;
}
