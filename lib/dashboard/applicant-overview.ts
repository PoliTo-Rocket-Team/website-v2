import { hasNoneShown, unitName, type ActiveApplication, type MyApplications, type PastApplication } from "./my-applications";
import type { Link } from "./overview";
import type { Pictured } from "./stored-photo";

// The Overview of a non-member (boards 50e and 50f, issues #211 and #317):
// who they are, what waits on them, and their applications, or, with none
// shown, the panel that says so. Built from what My applications reads
// (./my-applications.ts), so an application the one-month rule hides there
// is hidden here too. It lists no open positions (Owner decision, issue
// #317). Types and rules only; components/dashboard/overview.tsx renders it.

/** The five pills an applicant's own row shows (board 50e). */
export type ApplicantPill = "received" | "in-review" | "interview" | "accepted" | "not-selected";

export const APPLICANT_PILL_LABELS: Readonly<Record<ApplicantPill, string>> = {
  received: "Received",
  "in-review": "In review",
  interview: "Interview",
  accepted: "Accepted",
  "not-selected": "Not selected",
};

export type ApplicantRow = {
  readonly id: number;
  readonly title: string;
  /** "Mission Analysis"; the department for a role with no division. */
  readonly unit: string;
  /** ISO timestamp. */
  readonly sent: string;
  readonly pill: ApplicantPill;
  readonly href: string;
};

/** The one thing that waits on the applicant: today, picking an interview time. */
export type NextStep = {
  readonly title: string;
  readonly detail: string;
  readonly action: Link;
};

/**
 * The applications panel: the rows with "3 open · 1 past", or, when no row
 * is left to list, board 50f's "No applications right now". Withdrawn
 * applications are never rows here; they stay under Past on My applications
 * (issue #227).
 */
export type ApplicantApplications =
  | { readonly kind: "rows"; readonly summary: string; readonly rows: readonly [ApplicantRow, ...ApplicantRow[]] }
  | { readonly kind: "none" };

/** Board 50f's panel; the one-month rule goes under it (`SHOWN_FOR_A_MONTH`, ./my-applications.ts). */
export const NO_APPLICATIONS = {
  title: "No applications right now",
  detail: "Apply for an open position and follow it here.",
} as const;

/** Who an Overview off the team is for, as `DashboardViewer` reads them: their name and their stored photo. */
export type OverviewViewer = Pictured & { readonly name: string };

/** The person at the top of an Overview off the team (boards 50e, 56): the viewer, with the line under their name. */
export type OverviewPerson = OverviewViewer & { readonly line: string };

export type ApplicantOverview = {
  readonly shape: "applicant";
  readonly person: OverviewPerson;
  readonly nextStep: NextStep | null;
  readonly applications: ApplicantApplications;
};

/** One application opened on My applications: its card carries this anchor. */
export function myApplicationHref(applicationId: number): string {
  return `/dashboard/my-applications#${myApplicationAnchor(applicationId)}`;
}

export function myApplicationAnchor(applicationId: number): string {
  return `application-${applicationId}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** An interview whose lead offered times the applicant has not picked from yet. */
function waitsOnApplicant(application: ActiveApplication): boolean {
  const stage = application.stage;
  return stage.kind === "interview" && stage.interview.chosen === null && stage.interview.slots.length > 0;
}

export function nextStepOf(active: readonly ActiveApplication[]): NextStep | null {
  const waiting = active.find(waitsOnApplicant);
  if (waiting === undefined || waiting.stage.kind !== "interview") return null;
  const offered = waiting.stage.interview.slots.length;
  return {
    title: `Pick an interview time for ${waiting.title}`,
    detail: `The ${unitName(waiting)} lead offered ${plural(offered, "time", "times")}. Pick the one that suits you.`,
    action: { label: "Pick a time", href: myApplicationHref(waiting.id) },
  };
}

function activeRow(a: ActiveApplication): ApplicantRow {
  const kind = a.stage.kind;
  return { id: a.id, title: a.title, unit: unitName(a), sent: a.sent, pill: kind, href: myApplicationHref(a.id) };
}

/** A past application as a row; a withdrawn one is not listed. */
function pastRow(p: PastApplication): ApplicantRow | null {
  const base = { id: p.id, title: p.title, unit: unitName(p), sent: p.sent, href: myApplicationHref(p.id) };
  switch (p.outcome.kind) {
    case "withdrawn":
      return null;
    case "not-selected":
      return { ...base, pill: "not-selected" };
    case "joined":
      return { ...base, pill: "accepted" };
  }
}

/** "3 open · 1 past"; a side with none is left out. */
function applicationsSummary(open: number, past: number): string {
  return [open > 0 ? `${open} open` : null, past > 0 ? `${past} past` : null].filter(Boolean).join(" · ");
}

/** The panel's rows from the shown applications, open first; none when nothing is left to list. */
export function applicantApplicationsOf(mine: MyApplications): ApplicantApplications {
  const open = mine.active.map(activeRow);
  const past = mine.past.flatMap((p) => pastRow(p) ?? []);
  const [first, ...rest] = [...open, ...past];
  return first === undefined
    ? { kind: "none" }
    : { kind: "rows", summary: applicationsSummary(open.length, past.length), rows: [first, ...rest] };
}

/**
 * A non-member's Overview. While one of their applications is shown they
 * read as an applicant (board 50e); with none shown, by their sign-in
 * address alone (board 50f). Their circle shows their stored photo (issue
 * #656), which only someone with a member record has.
 */
export function applicantOverview(viewer: OverviewViewer, mine: MyApplications): ApplicantOverview {
  return {
    shape: "applicant",
    person: { name: viewer.name, photoUrl: viewer.photoUrl, line: hasNoneShown(mine) ? mine.email : `Applicant · ${mine.email}` },
    nextStep: nextStepOf(mine.active),
    applications: applicantApplicationsOf(mine),
  };
}
