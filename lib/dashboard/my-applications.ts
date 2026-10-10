// My applications (boards 50, 50b, 50c, 50d and 53; 50m to 50d-m on phones,
// issue #169): the viewer's own applications, each followed from sent to
// decision, and the ones that are over. Types and rules only; the dummy side
// (lib/dummy-data/my-applications.ts) and the database side
// (./database-self.ts) build the same shapes.

/** One interview time a division lead offers (the lead's side is issue #171). ISO timestamps. */
export type InterviewSlot = {
  readonly id: number;
  readonly start: string;
  readonly end: string;
};

export type Interview = {
  /** The lead who offered the times: "Marco Bianchi". */
  readonly lead: string;
  readonly slots: readonly InterviewSlot[];
  /** The time the applicant confirmed; one of `slots`. */
  readonly chosen: InterviewSlot | null;
};

/** Where an application still in progress stands. */
export type ActiveStage =
  | { readonly kind: "received" }
  | { readonly kind: "in-review" }
  | { readonly kind: "interview"; readonly interview: Interview }
  | { readonly kind: "accepted" };

/** How an application that is over ended. */
export type PastOutcome =
  | { readonly kind: "not-selected" }
  | { readonly kind: "withdrawn" }
  /** Accepted, and the person is on the team since `since` (ISO date). */
  | { readonly kind: "joined"; readonly since: string };

export type ApplicationFile = {
  readonly name: string;
  /** "312 KB"; null when the size was not stored. */
  readonly size: string | null;
};

export type ApplicationAnswer = { readonly question: string; readonly answer: string };

export type ActiveApplication = {
  readonly id: number;
  /** The position code: "AER-MSA-015". */
  readonly code: string;
  readonly title: string;
  readonly department: string;
  /** "Mission Analysis Division"; null for a role with no division. */
  readonly division: string | null;
  /** ISO timestamp. */
  readonly sent: string;
  readonly stage: ActiveStage;
  readonly files: readonly ApplicationFile[];
  readonly answers: readonly ApplicationAnswer[];
};

export type PastApplication = {
  readonly id: number;
  readonly title: string;
  readonly department: string;
  readonly division: string | null;
  readonly sent: string;
  readonly outcome: PastOutcome;
};

export type MyApplications = {
  /** The first name the accepted note greets. */
  readonly firstName: string;
  /** The sign-in address a lead writes to. */
  readonly email: string;
  /** Newest first. */
  readonly active: readonly ActiveApplication[];
  readonly past: readonly PastApplication[];
};

/** Nothing sent yet: no application in progress and none over (issue #179). */
export function hasNotApplied(mine: MyApplications): boolean {
  return mine.active.length === 0 && mine.past.length === 0;
}

/** The text of the "Next steps" box on an accepted application (board 50d, Huey's latest ruling). */
export const NEXT_STEPS_TEXT = "The team will contact you about joining. Watch your inbox.";

/** One application as stored: its status, and the times that end it. ISO timestamps. */
export type StoredApplication = {
  readonly status: "received" | "pending" | "interview" | "accepted" | "rejected" | "accepted_by_another_team" | "joined";
  readonly appliedAt: string;
  readonly withdrawnAt: string | null;
  readonly joinedAt: string | null;
};

/** Where one application lists on My applications: still in progress, or over. */
export type ApplicationPlace =
  | { readonly kind: "active"; readonly stage: ActiveStage }
  | { readonly kind: "past"; readonly outcome: PastOutcome };

/**
 * Where a stored application lists. Accept is not join (docs/dashboard-rules.md):
 * an accepted application stays active at `accepted` whether or not the viewer
 * is already a member, and only a confirmed join (status `joined`) is over as
 * `joined`. `interview` is the times its lead offered, or null when none are;
 * `roleSince` is when the viewer's current role started, the date a join stored
 * without `joinedAt` falls back to.
 */
export function placeOf(application: StoredApplication, interview: Interview | null, roleSince: string | null): ApplicationPlace {
  if (application.withdrawnAt !== null) return { kind: "past", outcome: { kind: "withdrawn" } };
  switch (application.status) {
    case "rejected":
    case "accepted_by_another_team":
      return { kind: "past", outcome: { kind: "not-selected" } };
    case "joined":
      return {
        kind: "past",
        outcome: { kind: "joined", since: (application.joinedAt ?? roleSince ?? application.appliedAt).slice(0, 10) },
      };
    case "accepted":
      return { kind: "active", stage: { kind: "accepted" } };
    case "received":
      return { kind: "active", stage: { kind: "received" } };
    case "pending":
    case "interview":
      return { kind: "active", stage: interview === null ? { kind: "in-review" } : { kind: "interview", interview } };
  }
}

/** An application can be withdrawn until it is accepted (board 50d hides Withdraw). */
export function canWithdraw(stage: ActiveStage): boolean {
  return stage.kind !== "accepted";
}

/**
 * The stored statuses of an application the person can still withdraw:
 * received, in review, or at interview (the lead's "Move to interview",
 * issue #171, marks `interview`).
 */
export const OPEN_STATUSES = ["received", "pending", "interview"] as const;

/** One of the person's own applications, as Delete account reads it. */
export type OwnApplication = {
  readonly id: number;
  readonly status: string;
  readonly withdrawnAt: string | null;
  readonly cvFileId: number | null;
  readonly coverLetterFileId: number | null;
};

/**
 * What "Also withdraw my open applications" on Delete account withdraws: the
 * open applications, and the files only they use. The files of the person's
 * other applications stay with those applications, kept like the rest of the
 * data until the account is anonymized (issue #191).
 */
export function withdrawnOnDelete(applications: readonly OwnApplication[]): {
  readonly applicationIds: readonly number[];
  readonly fileIds: readonly number[];
} {
  const open = (a: OwnApplication) => a.withdrawnAt === null && (OPEN_STATUSES as readonly string[]).includes(a.status);
  const filesOf = (a: OwnApplication) => [a.cvFileId, a.coverLetterFileId].filter((id): id is number => id !== null);
  const withdrawn = applications.filter(open);
  const kept = new Set(applications.filter((a) => !open(a)).flatMap(filesOf));
  return {
    applicationIds: withdrawn.map((a) => a.id),
    fileIds: [...new Set(withdrawn.flatMap(filesOf))].filter((id) => !kept.has(id)),
  };
}

/** "Mission Analysis Division" reads "Mission Analysis"; with no division, the department. */
export function unitName(application: Pick<ActiveApplication, "division" | "department">): string {
  return application.division === null ? application.department : application.division.replace(/ Division$/, "");
}

export type StepState = "done" | "current" | "todo";
export type Step = { readonly label: string; readonly state: StepState };

const BEFORE_DECISION = ["Received", "In review", "Interview", "Decision"] as const;
const AFTER_ACCEPT = ["Received", "In review", "Interview", "Sign NDA", "Joined"] as const;

function stepsAt(labels: readonly string[], current: number): Step[] {
  return labels.map((label, i) => ({ label, state: i < current ? "done" : i === current ? "current" : "todo" }));
}

/** The stepper (boards 50, 50c, 50d): four steps to a decision, then Sign NDA and Joined once accepted. */
export function stepsOf(stage: ActiveStage): Step[] {
  switch (stage.kind) {
    case "received":
      return stepsAt(BEFORE_DECISION, 0);
    case "in-review":
      return stepsAt(BEFORE_DECISION, 1);
    case "interview":
      return stepsAt(BEFORE_DECISION, 2);
    case "accepted":
      return stepsAt(AFTER_ACCEPT, 3);
  }
}

/** The phone's progress bar (boards 50m, 50c-m, 50d-m): filled segments of four, and the line under it. */
export function progressOf(stage: ActiveStage): { readonly filled: number; readonly of: number; readonly label: string } {
  switch (stage.kind) {
    case "received":
      return { filled: 1, of: 4, label: "Step 1 of 4 · Received" };
    case "in-review":
      return { filled: 2, of: 4, label: "Step 2 of 4 · In review" };
    case "interview":
      return { filled: 3, of: 4, label: "Step 3 of 4 · Interview" };
    case "accepted":
      return { filled: 4, of: 4, label: "Accepted · you will be contacted" };
  }
}

export type PillTone = "neutral" | "accent" | "success" | "muted";
/** A status pill; `check` draws the tick of "Accepted · joined" (board 53). */
export type Pill = { readonly label: string; readonly tone: PillTone; readonly check?: boolean };

export function stagePill(stage: ActiveStage): Pill {
  switch (stage.kind) {
    case "received":
      return { label: "Received", tone: "neutral" };
    case "in-review":
      return { label: "In review", tone: "accent" };
    case "interview":
      return { label: "Interview", tone: "accent" };
    case "accepted":
      return { label: "Accepted", tone: "success" };
  }
}

export function outcomePill(outcome: PastOutcome): Pill {
  switch (outcome.kind) {
    case "not-selected":
      return { label: "Not selected", tone: "muted" };
    case "withdrawn":
      return { label: "Withdrawn", tone: "muted" };
    case "joined":
      return { label: `Accepted · joined ${monthYear(outcome.since)}`, tone: "success", check: true };
  }
}

/** The line under the stepper: what happens next, from the application's own facts. */
export function nextStepNote(application: ActiveApplication, me: Pick<MyApplications, "firstName" | "email">): string {
  const unit = unitName(application);
  const stage = application.stage;
  switch (stage.kind) {
    case "received":
      return `Your application is in. The ${unit} lead will start reading it soon.`;
    case "in-review":
      return `The ${unit} lead is reading applications this week. If they want to meet you, they'll email ${me.email} to set up an interview.`;
    case "interview": {
      const { lead, chosen, slots } = stage.interview;
      if (chosen !== null) return `You meet ${lead}, the ${unit} lead, on ${slotLabel(chosen)}.`;
      const minutes = slots.length > 0 ? slotMinutes(slots[0]) : null;
      return `${lead}, the ${unit} lead, wants to meet you. Pick the time that suits you${minutes === null ? "." : `; you'll meet for ${minutes} minutes.`}`;
    }
    case "accepted":
      return `Congratulations, ${me.firstName}. ${unit} has accepted your application.`;
  }
}

/** The slot a pick names, when the application is at its interview and offers it; else why not. */
export function pickableSlot(application: ActiveApplication | undefined, slotId: number): { ok: true; slot: InterviewSlot } | { ok: false; error: string } {
  if (application === undefined) return { ok: false, error: "That application is not yours." };
  if (application.stage.kind !== "interview") return { ok: false, error: "This application has no interview to pick a time for." };
  if (application.stage.interview.chosen !== null) return { ok: false, error: "You already picked a time." };
  const slot = application.stage.interview.slots.find((s) => s.id === slotId);
  return slot === undefined ? { ok: false, error: "That time is no longer offered." } : { ok: true, slot };
}

// Dates and times, in Turin's time zone. Names are fixed here: ICU spells
// September "Sept" in en-GB, the boards spell it "Sep".

const ZONE = "Europe/Rome";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** en-US short weekdays are "Tue", "Thu", as the boards write them. */
const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(iso: string) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: MONTHS[Number(parts.month) - 1],
    day: Number(parts.day),
    weekday: parts.weekday,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** "9 Oct 2026" */
export function sentLabel(iso: string): string {
  const { day, month, year } = partsOf(iso);
  return `${day} ${month} ${year}`;
}

/** "Oct 2025", from an ISO date. */
export function monthYear(isoDate: string): string {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00Z` : isoDate);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Tue 14 Oct" */
export function slotDay(slot: InterviewSlot): string {
  const { weekday, day, month } = partsOf(slot.start);
  return `${weekday} ${day} ${month}`;
}

/** "18:00" */
export function slotTime(slot: InterviewSlot): string {
  return partsOf(slot.start).time;
}

/** "Thu 16 Oct, 17:30 – 18:00" */
export function slotLabel(slot: InterviewSlot): string {
  return `${slotDay(slot)}, ${slotTime(slot)} – ${partsOf(slot.end).time}`;
}

export function slotMinutes(slot: InterviewSlot): number {
  return Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000);
}

/** The offered times by day, in time order, as the picker lays them out (board 50c). */
export function slotsByDay(slots: readonly InterviewSlot[]): { readonly day: string; readonly slots: readonly InterviewSlot[] }[] {
  const sorted = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const days: { day: string; slots: InterviewSlot[] }[] = [];
  for (const slot of sorted) {
    const day = slotDay(slot);
    const last = days[days.length - 1];
    if (last?.day === day) last.slots.push(slot);
    else days.push({ day, slots: [slot] });
  }
  return days;
}
