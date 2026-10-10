import { parseDetails, type YourDetails } from "@/lib/dashboard/details";
import { isViewerKind, type ViewerKind } from "@/lib/dashboard/viewer";

// What a test developer changed on their own pages (issue #169): applications
// they withdrew, interview times they picked, and the "Your details" they
// saved, which the apply form then starts from. Like ./state.ts and
// ./edits.ts it lives only in a cookie in their own browser, never in a
// database, and is cleared on sign out. lib/dashboard/open.ts and
// lib/apply/open.ts read the cookie; only a dashboard write saves it.

export type OwnChanges = {
  /** Own application ids (./own-applications.ts) withdrawn. */
  readonly withdrawn: readonly number[];
  /** The interview slot picked, by own application id. */
  readonly slots: Readonly<Record<number, number>>;
  /** Saved details, by the viewer they were saved as. */
  readonly details: Readonly<Partial<Record<ViewerKind, YourDetails>>>;
};

export const NO_OWN_CHANGES: OwnChanges = { withdrawn: [], slots: {}, details: {} };

/** Where the dummy pages read and keep these changes. */
export type OwnChangesStore = {
  readonly current: OwnChanges;
  save(next: OwnChanges): Promise<void>;
};

/** No changes, and nowhere to keep any. */
export const NO_OWN_STORE: OwnChangesStore = { current: NO_OWN_CHANGES, save: async () => {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

/** The changes a cookie holds; anything malformed reads as none. */
export function parseOwnChanges(cookie: string | null | undefined): OwnChanges {
  if (!cookie) return NO_OWN_CHANGES;
  let raw: unknown;
  try {
    raw = JSON.parse(cookie);
  } catch {
    return NO_OWN_CHANGES;
  }
  if (!isRecord(raw)) return NO_OWN_CHANGES;
  const withdrawn = Array.isArray(raw.withdrawn) ? raw.withdrawn.filter(isId) : [];
  const slots: Record<number, number> = {};
  if (isRecord(raw.slots)) {
    for (const [key, value] of Object.entries(raw.slots)) {
      const id = Number(key);
      if (isId(id) && isId(value)) slots[id] = value;
    }
  }
  const details: Partial<Record<ViewerKind, YourDetails>> = {};
  if (isRecord(raw.details)) {
    for (const [kind, value] of Object.entries(raw.details)) {
      const parsed = parseDetails(value);
      if (isViewerKind(kind) && parsed.ok) details[kind] = parsed.value;
    }
  }
  return { withdrawn, slots, details };
}

export function serializeOwnChanges(changes: OwnChanges): string {
  return JSON.stringify(changes);
}
