// What a dashboard write answers (issues #145, #146). Every write goes through
// the dashboard data interface (./data.ts): a test developer's write changes
// nothing on the server and answers what the page shows next, which the page
// keeps in its own state; a real account's write lands in the database.

export type WriteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export function written<T>(value: T): WriteResult<T> {
  return { ok: true, value };
}

export function refused<T = never>(error: string): WriteResult<T> {
  return { ok: false, error };
}

/** A file a person sent with a write, already read into memory. */
export type Upload = {
  readonly name: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * "2 Oct" from an ISO date or timestamp, in UTC; the year shows only when it
 * is not `thisYear`. The month names are fixed here: ICU spells September
 * "Sept" in en-GB, the boards spell it "Sep".
 */
export function shortDate(iso: string, thisYear?: number): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return thisYear === undefined || thisYear === year ? `${day} ${month}` : `${day} ${month} ${year}`;
}
