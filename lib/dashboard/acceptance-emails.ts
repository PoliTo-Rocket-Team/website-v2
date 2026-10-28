import { builtInOf, type ApplicationStatus } from "./application-status";
import type { AttentionItem } from "./overview";
import { divisionLabel } from "./team";
import { isTeamLeader, type ViewerStanding } from "./viewer";

// The acceptance emails the team leader still has to send (board 100, issue
// #744). The team leader alone sends the acceptance email with the NDA and
// marks it sent (`setterOf`, ./application-status.ts), so only the team
// leader gets the list: a box at the top of their Applications page, team-wide
// and blind to the page's filters, and one row with its count on their
// Overview. Both ask `acceptanceEmailsToSend`; neither restates the rule. The
// site sends no email (ADR 0008): the box only helps copy the addresses.

/** The box's anchor on the Applications page, which the Overview row links to. */
export const ACCEPTANCE_EMAILS_ANCHOR = "acceptance-emails";

export const ACCEPTANCE_EMAILS_HREF = `/dashboard/applications#${ACCEPTANCE_EMAILS_ANCHOR}`;

/** How many rows the box shows before "Show all N" (board 100). */
export const ACCEPTANCE_EMAILS_SHOWN = 5;

/** An application as the list reads it: its status, and when it was accepted (ISO), null where no day is stored. */
export type AcceptanceCandidate = { readonly status: ApplicationStatus; readonly acceptedAt: string | null };

/** Whether an application in `status` waits for its acceptance email: "Accepted · email to be sent", or a status added under it. */
export function waitsForAcceptanceEmail(status: ApplicationStatus): boolean {
  return builtInOf(status) === "accepted_email_to_be_sent";
}

/**
 * The applications waiting for their acceptance email, oldest acceptance
 * first; one with no stored acceptance day goes last. An added status counts
 * as its built-in parent, so a renamed or added status is never missed.
 */
export function acceptanceEmailsToSend<T extends AcceptanceCandidate>(applications: readonly T[]): T[] {
  const at = (a: T) => (a.acceptedAt === null ? Number.POSITIVE_INFINITY : Date.parse(a.acceptedAt));
  return applications.filter((a) => waitsForAcceptanceEmail(a.status)).sort((a, b) => at(a) - at(b));
}

/**
 * The list for one viewer: the team leader's, and null for anyone else, so
 * no other viewer's page is sent a row of it.
 */
export function acceptanceEmailsFor<T extends AcceptanceCandidate>(viewer: ViewerStanding, applications: readonly T[]): T[] | null {
  return isTeamLeader(viewer) ? acceptanceEmailsToSend(applications) : null;
}

/** One row of the box (board 100): the applicant, the role they were accepted for, and the application the Open button opens. */
export type AcceptanceEmailRow = {
  /** The application's id: Open opens its drawer. */
  readonly id: number;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly email: string;
  readonly role: string;
  readonly department: string;
  readonly division: string;
  readonly acceptedAt: string | null;
};

/** "Mission Analyst · Operations · Mission Analysis", under the name (board 100). */
export function placeLine(row: Pick<AcceptanceEmailRow, "role" | "department" | "division">): string {
  return [row.role, row.department, divisionLabel(row.division)].join(" · ");
}

/** Every listed email once, in the list's order: one applicant accepted for two roles gets one email. */
export function distinctEmails(rows: readonly Pick<AcceptanceEmailRow, "email">[]): string[] {
  return [...new Set(rows.map((r) => r.email))];
}

/** What "Copy all N emails" copies: every listed email, the rows "Show all" hides included, as one comma-separated list. */
export function copyAllLine(rows: readonly Pick<AcceptanceEmailRow, "email">[]): string {
  return distinctEmails(rows).join(", ");
}

/**
 * The team leader's Overview row for the box, with the same count, linking
 * to it; none when nothing waits.
 */
export function acceptanceEmailsAttention(count: number): AttentionItem | null {
  if (count === 0) return null;
  return {
    kind: "acceptance-emails",
    title: count === 1 ? "1 acceptance email to send" : `${count} acceptance emails to send`,
    detail: "These applicants were accepted but don't know yet. Send each one the email with the NDA, then mark it sent. They can then return the signed NDA.",
    action: { label: "Open", href: ACCEPTANCE_EMAILS_HREF },
  };
}
