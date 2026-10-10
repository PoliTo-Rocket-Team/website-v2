import type { ApplyListing } from "@/lib/apply/positions";
import { unitName, type ActiveApplication, type MyApplications, type PastApplication } from "./my-applications";
import { divisionShortName, type Link } from "./overview";

// The Overview of a non-member who has applied (boards 50e and 50e-m, issue
// #211): who they are, what waits on them, their applications and the open
// positions. Built from what My applications reads (./my-applications.ts)
// and from the listing /apply shows (lib/apply/positions.ts), so neither is
// read a second way. Types and rules only; components/dashboard/overview.tsx
// renders it.

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

export type OpenRole = {
  readonly key: string;
  readonly title: string;
  readonly unit: string;
  readonly href: string;
};

export type OpenPositions = {
  /** "12 roles open across 8 divisions". */
  readonly summary: string;
  /** The first few roles, in /apply's order. */
  readonly roles: readonly OpenRole[];
};

export type ApplicantOverview = {
  readonly shape: "applicant";
  readonly person: { readonly name: string; readonly line: string };
  readonly nextStep: NextStep | null;
  readonly applications: { readonly summary: string; readonly rows: readonly ApplicantRow[] };
  readonly openPositions: OpenPositions;
};

/** How many open roles the Overview lists (board 50e; phones show one less, board 50e-m). */
export const OPEN_ROLES_SHOWN = 4;

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

export function openPositionsOf(listing: ApplyListing): OpenPositions {
  const groups = listing.kind === "none" ? [] : listing.open;
  const roles = groups.flatMap((group) =>
    group.roles.map((role) => ({
      key: role.key,
      title: role.title,
      unit: role.division === "" ? group.department : divisionShortName(role.division),
      href: role.status === "open" ? role.href : "/apply",
    })),
  );
  const divisions = new Set(roles.map((role) => role.unit)).size;
  return {
    summary:
      roles.length === 0
        ? "No roles open right now"
        : `${plural(roles.length, "role", "roles")} open across ${plural(divisions, "division", "divisions")}`,
    roles: roles.slice(0, OPEN_ROLES_SHOWN),
  };
}

export function applicantOverview(name: string, mine: MyApplications, listing: ApplyListing): ApplicantOverview {
  const open = mine.active.map(activeRow);
  const past = mine.past.flatMap((p) => pastRow(p) ?? []);
  return {
    shape: "applicant",
    person: { name, line: `Applicant · ${mine.email}` },
    nextStep: nextStepOf(mine.active),
    applications: { summary: applicationsSummary(open.length, past.length), rows: [...open, ...past] },
    openPositions: openPositionsOf(listing),
  };
}
