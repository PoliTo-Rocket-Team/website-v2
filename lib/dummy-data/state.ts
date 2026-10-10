import {
  isInterviewLength,
  slotAt,
  slotLength,
  type ApplicationState,
  type OfferedSlots,
} from "@/lib/dashboard/application-flow";

// What a test developer has changed on the dummy team (issues #142, #171):
// positions opened or closed, roles they posted, and where they moved each
// application. It lives only in a cookie, never in the database, and is
// cleared on sign out. Everything else stays as ./team.ts and
// ./applications.ts wrote it. The recruitment switch is not here: it is
// #121's, in ./recruitment.ts.

/** A role the test developer posted with New position: what the Positions table shows of it. */
export type DummyNewPosition = {
  readonly id: number;
  readonly title: string;
  readonly divisionId: number;
  readonly open: boolean;
  readonly motivationLetter: boolean;
  readonly createdAt: string;
};

export type DummyState = {
  readonly positionOpen: Readonly<Record<number, boolean>>;
  readonly applications: Readonly<Record<number, ApplicationState>>;
  readonly newPositions: readonly DummyNewPosition[];
};

export const EMPTY_DUMMY_STATE: DummyState = { positionOpen: {}, applications: {}, newPositions: [] };

/** Where the dummy dashboard reads and keeps these changes. */
export type DummyStateStore = {
  readonly current: DummyState;
  save(next: DummyState): Promise<void>;
};

/** A cookie holds about 4 KB: the newest roles kept, and their titles capped. */
export const MAX_NEW_POSITIONS = 6;
const MAX_TITLE = 80;

// The wire form is compact: times are whole minutes since 1970, stages one letter.

type WireState =
  | "n"
  | "r"
  | "x"
  | "w"
  | readonly ["i", number, readonly number[], number | null, number | null]
  | readonly ["a", number, 0 | 1]
  | readonly ["j", number];

type WirePosition = readonly [number, string, number, 0 | 1, 0 | 1, number];

type Wire = { p?: Record<string, boolean>; a?: Record<string, WireState>; n?: WirePosition[] };

const toMinutes = (iso: string) => Math.round(Date.parse(iso) / 60_000);
const fromMinutes = (m: number) => new Date(m * 60_000).toISOString();
const isMinutes = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

function encodeState(state: ApplicationState): WireState {
  switch (state.stage) {
    case "new":
      return "n";
    case "in-review":
      return "r";
    case "rejected":
      return "x";
    case "withdrawn":
      return "w";
    case "interview":
      return [
        "i",
        slotLength(state.offered[0]),
        state.offered.map((s) => toMinutes(s.start)),
        state.booked ? toMinutes(state.booked.slot.start) : null,
        state.booked ? toMinutes(state.booked.at) : null,
      ];
    case "accepted":
      return ["a", toMinutes(state.acceptedAt), state.ndaArrived ? 1 : 0];
    case "joined":
      return ["j", toMinutes(state.joinedAt)];
  }
}

function decodeState(wire: unknown): ApplicationState | null {
  switch (wire) {
    case "n":
      return { stage: "new" };
    case "r":
      return { stage: "in-review" };
    case "x":
      return { stage: "rejected" };
    case "w":
      return { stage: "withdrawn" };
  }
  if (!Array.isArray(wire)) return null;
  if (wire[0] === "i" && wire.length === 5) {
    const [, minutes, starts, booked, at] = wire;
    if (!isInterviewLength(minutes) || !Array.isArray(starts) || starts.length === 0 || !starts.every(isMinutes)) return null;
    const offered = starts.map((m: number) => slotAt(fromMinutes(m), minutes)) as unknown as OfferedSlots;
    if (booked === null) return { stage: "interview", offered, booked: null };
    const slot = offered.find((s) => toMinutes(s.start) === booked);
    if (!slot || !isMinutes(at)) return null;
    return { stage: "interview", offered, booked: { slot, at: fromMinutes(at) } };
  }
  if (wire[0] === "a" && wire.length === 3 && isMinutes(wire[1]) && (wire[2] === 0 || wire[2] === 1)) {
    return { stage: "accepted", acceptedAt: fromMinutes(wire[1]), ndaArrived: wire[2] === 1 };
  }
  if (wire[0] === "j" && wire.length === 2 && isMinutes(wire[1])) return { stage: "joined", joinedAt: fromMinutes(wire[1]) };
  return null;
}

function decodePosition(wire: unknown): DummyNewPosition | null {
  if (!Array.isArray(wire) || wire.length !== 6) return null;
  const [id, title, divisionId, open, letter, created] = wire;
  if (!Number.isSafeInteger(id) || id <= 0 || typeof title !== "string" || title.trim() === "") return null;
  if (!Number.isSafeInteger(divisionId) || divisionId <= 0 || (open !== 0 && open !== 1) || (letter !== 0 && letter !== 1)) return null;
  if (!isMinutes(created)) return null;
  return { id, title: title.slice(0, MAX_TITLE), divisionId, open: open === 1, motivationLetter: letter === 1, createdAt: fromMinutes(created) };
}

function entries<T>(record: unknown, read: (value: unknown) => T | null): Record<number, T> {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return {};
  const out: Record<number, T> = {};
  for (const [key, raw] of Object.entries(record)) {
    const id = Number(key);
    const value = read(raw);
    if (Number.isInteger(id) && id > 0 && value !== null) out[id] = value;
  }
  return out;
}

/** The state a cookie holds; anything unreadable reads as no changes. */
export function parseDummyState(cookieValue: string | null | undefined): DummyState {
  if (!cookieValue) return EMPTY_DUMMY_STATE;
  let wire: unknown;
  try {
    wire = JSON.parse(cookieValue);
  } catch {
    return EMPTY_DUMMY_STATE;
  }
  if (typeof wire !== "object" || wire === null) return EMPTY_DUMMY_STATE;
  const { p, a, n } = wire as Wire;
  return {
    positionOpen: entries(p, (v) => (typeof v === "boolean" ? v : null)),
    applications: entries(a, decodeState),
    newPositions: (Array.isArray(n) ? n : []).flatMap((w) => decodePosition(w) ?? []).slice(-MAX_NEW_POSITIONS),
  };
}

export function serializeDummyState(state: DummyState): string {
  const wire: Wire = {};
  if (Object.keys(state.positionOpen).length > 0) wire.p = state.positionOpen;
  const applications = Object.entries(state.applications);
  if (applications.length > 0) wire.a = Object.fromEntries(applications.map(([id, s]) => [id, encodeState(s)]));
  if (state.newPositions.length > 0) {
    wire.n = state.newPositions.map((p) => [p.id, p.title.slice(0, MAX_TITLE), p.divisionId, p.open ? 1 : 0, p.motivationLetter ? 1 : 0, toMinutes(p.createdAt)]);
  }
  return JSON.stringify(wire);
}

/**
 * One change on top of the state. A value equal to the one the arrays start
 * from is dropped rather than stored, so the cookie holds only real changes.
 */
export type DummyChange =
  | { readonly kind: "position"; readonly id: number; readonly open: boolean; readonly initial: boolean }
  | { readonly kind: "application"; readonly id: number; readonly state: ApplicationState; readonly initial: ApplicationState }
  | { readonly kind: "new-position"; readonly position: DummyNewPosition };

function without<T>(record: Readonly<Record<number, T>>, id: number): Record<number, T> {
  const { [id]: _dropped, ...rest } = record;
  return rest;
}

const sameState = (x: ApplicationState, y: ApplicationState) => JSON.stringify(encodeState(x)) === JSON.stringify(encodeState(y));

export function applyDummyChange(state: DummyState, change: DummyChange): DummyState {
  switch (change.kind) {
    case "position":
      return {
        ...state,
        positionOpen:
          change.open === change.initial
            ? without(state.positionOpen, change.id)
            : { ...state.positionOpen, [change.id]: change.open },
      };
    case "application":
      return {
        ...state,
        applications: sameState(change.state, change.initial)
          ? without(state.applications, change.id)
          : { ...state.applications, [change.id]: change.state },
      };
    case "new-position":
      return { ...state, newPositions: [...state.newPositions, change.position].slice(-MAX_NEW_POSITIONS) };
  }
}
