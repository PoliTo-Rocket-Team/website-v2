// Where an application stands, and the moves that change it (Dashboard v2
// boards 58 to 58i, issue #171). This module alone decides which move is
// legal from which stage; the pages, the server actions and both data
// sources (lib/dummy-data/, ./database.ts) ask it and never restate it.
//
// The order is: New, opened into In review, Interview (times offered, then
// one booked by the applicant), Accepted (waiting for the signed NDA), Joined.
// Rejected and Withdrawn end it. Accept only marks the application; only
// Confirm join, once the NDA arrived, makes the person a team member.

/** How long an interview runs, as the lead picks it (board 58c). */
export const INTERVIEW_LENGTHS = [30, 45, 60] as const;
export type InterviewLength = (typeof INTERVIEW_LENGTHS)[number];

export function isInterviewLength(value: unknown): value is InterviewLength {
  return (INTERVIEW_LENGTHS as readonly unknown[]).includes(value);
}

/**
 * One time the lead can meet: its start as an ISO timestamp, and its length
 * in minutes. A new offer takes one of INTERVIEW_LENGTHS (`checkOffer`).
 */
export type InterviewSlot = { readonly start: string; readonly minutes: number };

/** The slot the applicant picked, and when they picked it. */
export type BookedSlot = { readonly slot: InterviewSlot; readonly at: string };

/** At least one slot: an interview with no time to offer is not a state. */
export type OfferedSlots = readonly [InterviewSlot, ...InterviewSlot[]];

export type ApplicationState =
  | { readonly stage: "new" }
  | { readonly stage: "in-review" }
  | { readonly stage: "interview"; readonly offered: OfferedSlots; readonly booked: BookedSlot | null }
  | { readonly stage: "accepted"; readonly acceptedAt: string; readonly ndaArrived: boolean }
  | { readonly stage: "joined"; readonly joinedAt: string }
  | { readonly stage: "rejected" }
  | { readonly stage: "withdrawn" };

export type ApplicationStage = ApplicationState["stage"];

export const APPLICATION_STAGES = [
  "new",
  "in-review",
  "interview",
  "accepted",
  "joined",
  "rejected",
  "withdrawn",
] as const satisfies readonly ApplicationStage[];

export function isApplicationStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && (APPLICATION_STAGES as readonly string[]).includes(value);
}

export const STAGE_LABELS: Readonly<Record<ApplicationStage, string>> = {
  new: "New",
  "in-review": "In review",
  interview: "Interview",
  accepted: "Accepted",
  joined: "Joined",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

// Moves --------------------------------------------------------------------------

/** What a lead does to an application. */
export type LeadMove =
  /** The lead opened it in the panel. */
  | { readonly kind: "open" }
  /** Move to interview (58c), or Change times on one already there (58d). */
  | { readonly kind: "offer-interview"; readonly slots: readonly InterviewSlot[] }
  | { readonly kind: "accept" }
  /** Reject; on an accepted application this is "Withdraw acceptance". */
  | { readonly kind: "reject" }
  /** The "The signed NDA arrived" tick (58g). */
  | { readonly kind: "set-nda"; readonly arrived: boolean }
  | { readonly kind: "confirm-join" };

/** What the applicant does (their My applications page, issue #169). */
export type ApplicantMove =
  | { readonly kind: "book"; readonly start: string }
  | { readonly kind: "withdraw" };

export type ApplicationMove = LeadMove | ApplicantMove;

/**
 * A legal move's outcome. `joinsTeam` is true for Confirm join alone: it is
 * the one move after which the data source adds the person to the team.
 * `changed` is false when the move leaves the state as it was (opening an
 * application past New, ticking the NDA box to what it already says): a data
 * source then writes nothing, so it never rewrites an interview's times and
 * booking from a stale page.
 */
export type MoveResult =
  | { readonly ok: true; readonly state: ApplicationState; readonly joinsTeam: boolean; readonly changed: boolean }
  | { readonly ok: false; readonly reason: string };

/** The most times one offer may hold. */
export const MAX_OFFERED_SLOTS = 20;

type Next = { readonly ok: true; readonly state: ApplicationState; readonly joinsTeam: boolean } | { readonly ok: false; readonly reason: string };

function moved(state: ApplicationState, joinsTeam = false): Next {
  return { ok: true, state, joinsTeam };
}

function illegal(reason: string): Next {
  return { ok: false, reason };
}

function sameSlot(a: InterviewSlot, b: InterviewSlot): boolean {
  return Date.parse(a.start) === Date.parse(b.start) && a.minutes === b.minutes;
}

/** Whether two states say the same thing: same stage, same times, same booking, same dates. */
export function sameState(a: ApplicationState, b: ApplicationState): boolean {
  switch (a.stage) {
    case "interview": {
      if (b.stage !== "interview") return false;
      if (a.offered.length !== b.offered.length || !a.offered.every((s, i) => sameSlot(s, b.offered[i]))) return false;
      if (a.booked === null || b.booked === null) return a.booked === b.booked;
      return sameSlot(a.booked.slot, b.booked.slot) && Date.parse(a.booked.at) === Date.parse(b.booked.at);
    }
    case "accepted":
      return b.stage === "accepted" && Date.parse(a.acceptedAt) === Date.parse(b.acceptedAt) && a.ndaArrived === b.ndaArrived;
    case "joined":
      return b.stage === "joined" && Date.parse(a.joinedAt) === Date.parse(b.joinedAt);
    default:
      return a.stage === b.stage;
  }
}

/** The offered slots, checked: some, not too many, one length, each in the future, none twice. */
export function checkOffer(slots: readonly InterviewSlot[], now: Date): { ok: true; offered: OfferedSlots } | { ok: false; reason: string } {
  if (slots.length === 0) return { ok: false, reason: "Pick at least one time." };
  if (slots.length > MAX_OFFERED_SLOTS) return { ok: false, reason: `Pick at most ${MAX_OFFERED_SLOTS} times.` };
  const starts = new Set<number>();
  for (const slot of slots) {
    const at = Date.parse(slot.start);
    if (!Number.isFinite(at) || !isInterviewLength(slot.minutes)) return { ok: false, reason: "That time is not valid." };
    if (at <= now.getTime()) return { ok: false, reason: "Pick times that are still to come." };
    if (starts.has(at)) return { ok: false, reason: "A time is picked twice." };
    starts.add(at);
  }
  if (new Set(slots.map((s) => s.minutes)).size !== 1) return { ok: false, reason: "Every time has the same length." };
  const offered = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { ok: true, offered: offered as unknown as OfferedSlots };
}

/** The state after `move`, or why the move is not allowed from here. */
export function applyMove(state: ApplicationState, move: ApplicationMove, now: Date): MoveResult {
  const next = nextState(state, move, now);
  return next.ok ? { ...next, changed: !sameState(state, next.state) } : next;
}

function nextState(state: ApplicationState, move: ApplicationMove, now: Date): Next {
  const at = now.toISOString();
  switch (move.kind) {
    case "open":
      // Opening a New application is the first look; opening any other changes nothing.
      return moved(state.stage === "new" ? { stage: "in-review" } : state);

    case "offer-interview": {
      if (state.stage !== "new" && state.stage !== "in-review" && state.stage !== "interview") {
        return illegal(`An application that is ${STAGE_LABELS[state.stage].toLowerCase()} cannot move to interview.`);
      }
      const offer = checkOffer(move.slots, now);
      if (!offer.ok) return illegal(offer.reason);
      return moved({ stage: "interview", offered: offer.offered, booked: null });
    }

    case "book": {
      if (state.stage !== "interview") return illegal("Only an application at interview takes a booking.");
      const slot = state.offered.find((s) => Date.parse(s.start) === Date.parse(move.start));
      if (!slot) return illegal("That time was not offered.");
      return moved({ ...state, booked: { slot, at } });
    }

    case "accept":
      if (state.stage !== "in-review" && state.stage !== "interview") {
        return illegal(`An application that is ${STAGE_LABELS[state.stage].toLowerCase()} cannot be accepted.`);
      }
      return moved({ stage: "accepted", acceptedAt: at, ndaArrived: false });

    case "reject":
      if (state.stage === "joined" || state.stage === "rejected" || state.stage === "withdrawn") {
        return illegal(`An application that is ${STAGE_LABELS[state.stage].toLowerCase()} cannot be rejected.`);
      }
      return moved({ stage: "rejected" });

    case "set-nda":
      if (state.stage !== "accepted") return illegal("Only an accepted application waits for the NDA.");
      return moved({ ...state, ndaArrived: move.arrived });

    case "confirm-join":
      if (state.stage !== "accepted") return illegal("Only an accepted application can join the team.");
      if (!state.ndaArrived) return illegal("Tick that the signed NDA arrived first.");
      return moved({ stage: "joined", joinedAt: at }, true);

    case "withdraw":
      if (state.stage === "joined" || state.stage === "rejected" || state.stage === "withdrawn") {
        return illegal("This application is already decided.");
      }
      return moved({ stage: "withdrawn" });
  }
}

/** A lead's move as the browser sent it, checked for shape; null when it is not one. */
export function parseLeadMove(value: unknown): LeadMove | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "open":
    case "accept":
    case "reject":
    case "confirm-join":
      return { kind: v.kind };
    case "set-nda":
      return typeof v.arrived === "boolean" ? { kind: "set-nda", arrived: v.arrived } : null;
    case "offer-interview": {
      if (!Array.isArray(v.slots) || v.slots.length > MAX_OFFERED_SLOTS) return null;
      const slots: InterviewSlot[] = [];
      for (const raw of v.slots) {
        if (typeof raw !== "object" || raw === null) return null;
        const { start, minutes } = raw as Record<string, unknown>;
        if (typeof start !== "string" || !Number.isFinite(Date.parse(start)) || !isInterviewLength(minutes)) return null;
        slots.push({ start: new Date(start).toISOString(), minutes });
      }
      return { kind: "offer-interview", slots };
    }
    default:
      return null;
  }
}

// What the lead can do next --------------------------------------------------------

export type LeadStep = { readonly label: string; readonly move: LeadMove["kind"] };

/**
 * The two buttons at the foot of the detail panel: the outlined one on the
 * left and the main one on the right. `ready` is false while the main one
 * waits on something (Confirm join waits for the NDA tick). A decided
 * application has none.
 */
export function footerSteps(
  state: ApplicationState,
): { readonly secondary: LeadStep; readonly primary: LeadStep & { readonly ready: boolean } } | null {
  switch (state.stage) {
    case "new":
    case "in-review":
      return { secondary: { label: "Reject", move: "reject" }, primary: { label: "Move to interview", move: "offer-interview", ready: true } };
    case "interview":
      return { secondary: { label: "Reject", move: "reject" }, primary: { label: "Accept", move: "accept", ready: true } };
    case "accepted":
      return {
        secondary: { label: "Withdraw acceptance", move: "reject" },
        primary: { label: "Confirm join", move: "confirm-join", ready: state.ndaArrived },
      };
    case "joined":
    case "rejected":
    case "withdrawn":
      return null;
  }
}

/** Every step the stage menu offers from here, in the order the flow runs. */
export function menuSteps(state: ApplicationState): readonly LeadStep[] {
  switch (state.stage) {
    case "new":
    case "in-review":
      return [{ label: "Move to interview", move: "offer-interview" }, { label: "Reject", move: "reject" }];
    case "interview":
      return [
        { label: "Change times", move: "offer-interview" },
        { label: "Accept", move: "accept" },
        { label: "Reject", move: "reject" },
      ];
    case "accepted":
      return [{ label: "Withdraw acceptance", move: "reject" }];
    case "joined":
    case "rejected":
    case "withdrawn":
      return [];
  }
}

// How a stage reads --------------------------------------------------------------

export type PillTone = "neutral" | "info" | "accent" | "success" | "muted";

/** The stage pill in the list and the panel (58b, 58i): its words, its phone words (58m), its colour. */
export function stagePill(state: ApplicationState): { readonly label: string; readonly short: string; readonly tone: PillTone } {
  switch (state.stage) {
    case "new":
      return { label: "New", short: "New", tone: "neutral" };
    case "in-review":
      return { label: "In review", short: "In review", tone: "info" };
    case "interview":
      return state.booked
        ? {
            label: `Interview · ${slotDayTime(state.booked.slot)}`,
            short: `Interview · ${slotDay(state.booked.slot)}`,
            tone: "accent",
          }
        : { label: "Interview · no time yet", short: "Interview · no time", tone: "neutral" };
    case "accepted":
      return state.ndaArrived
        ? { label: "Accepted · NDA arrived", short: "Accepted · NDA in", tone: "success" }
        : { label: "Accepted · waiting for NDA", short: "Accepted · NDA", tone: "success" };
    case "joined":
      return { label: "Joined", short: "Joined", tone: "success" };
    case "rejected":
      return { label: "Rejected", short: "Rejected", tone: "muted" };
    case "withdrawn":
      return { label: "Withdrawn", short: "Withdrawn", tone: "muted" };
  }
}

/** The tone of a stage on its own, as the Other applications rows show it (board 58). */
export function stageTone(stage: ApplicationStage): PillTone {
  switch (stage) {
    case "new":
      return "neutral";
    case "in-review":
      return "info";
    case "interview":
      return "accent";
    case "accepted":
    case "joined":
      return "success";
    case "rejected":
    case "withdrawn":
      return "muted";
  }
}

/** The four steps the progress bar under an Other application counts: applied, review, interview, accepted. */
export const PROGRESS_STEPS = 4;

/** How many of the four steps an application has reached; null once it ended without a place. */
export function progressOf(stage: ApplicationStage): number | null {
  switch (stage) {
    case "new":
      return 1;
    case "in-review":
      return 2;
    case "interview":
      return 3;
    case "accepted":
    case "joined":
      return 4;
    case "rejected":
    case "withdrawn":
      return null;
  }
}

// Tabs -----------------------------------------------------------------------------

export type ApplicationTab = "all" | "new" | "in-review" | "interview" | "accepted" | "rejected";

export const APPLICATION_TABS: readonly { readonly tab: ApplicationTab; readonly label: string }[] = [
  { tab: "all", label: "All" },
  { tab: "new", label: "New" },
  { tab: "in-review", label: "In review" },
  { tab: "interview", label: "Interview" },
  { tab: "accepted", label: "Accepted" },
  { tab: "rejected", label: "Rejected" },
];

/** The tab a stage sits under: joined people stay under Accepted, withdrawn ones under Rejected. */
export function tabOf(stage: ApplicationStage): Exclude<ApplicationTab, "all"> {
  switch (stage) {
    case "joined":
      return "accepted";
    case "withdrawn":
      return "rejected";
    default:
      return stage;
  }
}

export function inTab(stage: ApplicationStage, tab: ApplicationTab): boolean {
  return tab === "all" || tabOf(stage) === tab;
}

export function tabCounts(stages: readonly ApplicationStage[]): Record<ApplicationTab, number> {
  const counts: Record<ApplicationTab, number> = { all: stages.length, new: 0, "in-review": 0, interview: 0, accepted: 0, rejected: 0 };
  for (const stage of stages) counts[tabOf(stage)] += 1;
  return counts;
}

// Times, in Turin ----------------------------------------------------------------

const TIME_ZONE = "Europe/Rome";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

type RomeParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: string };

function romeParts(at: Date): RomeParts {
  const parts = Object.fromEntries(partsFormat.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

/** The instant a Turin wall-clock time names. */
export function romeTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall;
  // Two rounds settle the offset, across a clock change too.
  for (let i = 0; i < 2; i++) {
    const p = romeParts(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - shown;
  }
  return new Date(guess);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

function hhmm(p: { hour: number; minute: number }): string {
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function slotEnd(slot: InterviewSlot): Date {
  return new Date(Date.parse(slot.start) + slot.minutes * MINUTE);
}

/** "Thu 15" */
export function slotDay(slot: InterviewSlot): string {
  const p = romeParts(new Date(slot.start));
  return `${p.weekday} ${p.day}`;
}

/** "Thu 15, 17:30", as the stage pill reads. */
export function slotDayTime(slot: InterviewSlot): string {
  const p = romeParts(new Date(slot.start));
  return `${p.weekday} ${p.day}, ${hhmm(p)}`;
}

/** "Thu 15 Oct, 17:30 – 18:00", as the panel's interview card reads (58d). */
export function slotRange(slot: InterviewSlot): string {
  const p = romeParts(new Date(slot.start));
  return `${p.weekday} ${p.day} ${MONTHS[p.month - 1]}, ${hhmm(p)} – ${hhmm(romeParts(slotEnd(slot)))}`;
}

/** The date badge on the interview card: "15" over "OCT". */
export function slotBadge(slot: InterviewSlot): { readonly day: string; readonly month: string } {
  const p = romeParts(new Date(slot.start));
  return { day: String(p.day), month: MONTHS[p.month - 1].toUpperCase() };
}

/** "11 Oct" */
export function dayMonth(iso: string): string {
  const p = romeParts(new Date(iso));
  return `${p.day} ${MONTHS[p.month - 1]}`;
}

// The slot picker (58c) ------------------------------------------------------------

/** The times a weekday offers in the picker: 17:00 to 19:00, every half hour. */
export const PICKER_TIMES = [
  [17, 0],
  [17, 30],
  [18, 0],
  [18, 30],
  [19, 0],
] as const;

/** How many weeks ahead the picker reaches. */
export const PICKER_WEEKS = 4;

export type PickerDay = { readonly label: string; readonly starts: readonly { readonly start: string; readonly past: boolean }[] };
export type PickerWeek = { readonly title: string; readonly days: readonly PickerDay[] };

/** The Monday, in Turin, of the first week the picker shows: the week of tomorrow, or the next one from a Saturday. */
function firstMonday(now: Date): { year: number; month: number; day: number } {
  const tomorrow = romeParts(new Date(now.getTime() + DAY));
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(tomorrow.weekday);
  const shift = weekday >= 5 ? 7 - weekday : -weekday;
  const monday = new Date(Date.UTC(tomorrow.year, tomorrow.month - 1, tomorrow.day + shift));
  return { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() };
}

/** Week `index` (0 is the first) of the picker: "12 – 16 October" and Monday to Friday's times. */
export function pickerWeek(now: Date, index: number): PickerWeek {
  const monday = firstMonday(now);
  const days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(Date.UTC(monday.year, monday.month - 1, monday.day + index * 7 + i));
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
    const starts = PICKER_TIMES.map(([h, min]) => {
      const at = romeTime(y, m, d, h, min);
      return { start: at.toISOString(), past: at.getTime() <= now.getTime() };
    });
    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"][i];
    return { label: `${weekday} ${d}`, starts, month: m, d };
  });
  const first = days[0];
  const last = days[days.length - 1];
  const title =
    first.month === last.month
      ? `${first.d} – ${last.d} ${MONTHS_LONG[last.month - 1]}`
      : `${first.d} ${MONTHS[first.month - 1]} – ${last.d} ${MONTHS[last.month - 1]}`;
  return { title, days: days.map(({ label, starts }) => ({ label, starts })) };
}

/** "17:30" for a picker start. */
export function clockOf(iso: string): string {
  return hhmm(romeParts(new Date(iso)));
}

/** "4 times picked" */
export function pickedCount(n: number): string {
  return `${n} ${n === 1 ? "time" : "times"} picked`;
}

// Add to calendar (58d) ----------------------------------------------------------

function icsStamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/**
 * The booked interview as an iCalendar file, for the lead's own calendar.
 * The site sends no invite: the file is a download, nothing more.
 */
export function interviewIcs(
  { applicationId, applicant, position, slot }: { applicationId: number; applicant: string; position: string; slot: InterviewSlot },
  now: Date,
): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PoliTo Rocket Team//Dashboard//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:interview-${applicationId}-${icsStamp(new Date(slot.start))}@politorocketteam.it`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(new Date(slot.start))}`,
    `DTEND:${icsStamp(slotEnd(slot))}`,
    `SUMMARY:${icsText(`Interview: ${applicant}, ${position}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** "interview-giulia-rossi.ics" */
export function icsFileName(applicant: string): string {
  const slug = applicant
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `interview-${slug || "applicant"}.ics`;
}

// Words about the applicant ------------------------------------------------------

export type Pronouns = { readonly subject: string; readonly object: string; readonly possessive: string };

/** From the application form's gender: she, he, or they when it says neither. */
export function pronounsOf(gender: string | null): Pronouns {
  if (gender === "Female") return { subject: "she", object: "her", possessive: "her" };
  if (gender === "Male") return { subject: "he", object: "him", possessive: "his" };
  return { subject: "they", object: "them", possessive: "their" };
}

/** "Giulia" from "Giulia Rossi". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Aerospace Eng. · MSc 1" from "Aerospace Engineering" and "Year 1 Master's" (board 58b). */
export function studiesLine(degree: string | null, year: string | null): string | null {
  const course = degree?.replace(/\bEngineering\b/, "Eng.") ?? null;
  const match = year ? /^Year (\d+) (Master's|Bachelor's)$/.exec(year) : null;
  const level = match ? `${match[2] === "Master's" ? "MSc" : "BSc"} ${match[1]}` : year;
  return [course, level].filter(Boolean).join(" · ") || null;
}
