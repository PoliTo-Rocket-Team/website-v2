import { isApplicationStage, type ApplicationStage } from "@/lib/dashboard/recruitment";

// What a test developer has changed on the dummy team (issue #142):
// positions opened or closed, applications moved to another stage. It lives
// only in a cookie, never in the database, and is cleared on sign out.
// Everything else stays as ./team.ts and ./applications.ts wrote it. The
// recruitment switch is not here: it is #121's, in ./recruitment.ts.

export type DummyState = {
  readonly positionOpen: Readonly<Record<number, boolean>>;
  readonly applicationStage: Readonly<Record<number, ApplicationStage>>;
};

export const EMPTY_DUMMY_STATE: DummyState = { positionOpen: {}, applicationStage: {} };

/** Where the dummy dashboard reads and keeps these changes. */
export type DummyStateStore = {
  readonly current: DummyState;
  save(next: DummyState): Promise<void>;
};

/** Compact on the wire: a cookie holds about 4 KB. */
type Wire = { p?: Record<string, boolean>; a?: Record<string, string> };

function entries<T>(record: unknown, keep: (value: unknown) => value is T): Record<number, T> {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return {};
  const out: Record<number, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const id = Number(key);
    if (Number.isInteger(id) && id > 0 && keep(value)) out[id] = value;
  }
  return out;
}

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

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
  const { p, a } = wire as Wire;
  return {
    positionOpen: entries(p, isBoolean),
    applicationStage: entries(a, isApplicationStage),
  };
}

export function serializeDummyState(state: DummyState): string {
  const wire: Wire = {};
  if (Object.keys(state.positionOpen).length > 0) wire.p = state.positionOpen;
  if (Object.keys(state.applicationStage).length > 0) wire.a = state.applicationStage;
  return JSON.stringify(wire);
}

/**
 * One change on top of the state. A value equal to the one the arrays start
 * from is dropped rather than stored, so the cookie holds only real changes.
 */
export type DummyChange =
  | { readonly kind: "position"; readonly id: number; readonly open: boolean; readonly initial: boolean }
  | { readonly kind: "application"; readonly id: number; readonly stage: ApplicationStage; readonly initial: ApplicationStage };

function without<T>(record: Readonly<Record<number, T>>, id: number): Record<number, T> {
  const { [id]: _dropped, ...rest } = record;
  return rest;
}

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
        applicationStage:
          change.stage === change.initial
            ? without(state.applicationStage, change.id)
            : { ...state.applicationStage, [change.id]: change.stage },
      };
  }
}
