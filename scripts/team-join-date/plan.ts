import { joinDayOf } from "./dates";
import { EMAIL_FIELDS, type At, type Roster } from "./roster";
import type { Snapshot } from "./snapshot";

// What the backfill will write (issue #948): for each member a roster row
// finds, the day they joined the team. A pure function of the roster and the
// database snapshot, so a dry run and a real run plan the same thing.
//
// - A row's member is found by its emails (lower case): an account's email, or
//   a member's PRT address. No member, or two, skips the row.
// - A member several rows find (someone who left and came back) gets the
//   earliest of their rows' join days: the day they first joined the team.
// - A member whose join day is already stored keeps it: the backfill never
//   overwrites. The same day counts as already stored; a different one is
//   reported, so a second run plans nothing.

export type SkipKind = "date-unreadable" | "dates-out-of-order" | "no-email" | "no-member" | "ambiguous-member" | "stored-differs";

export type Skip = { readonly kind: SkipKind; readonly at: At; readonly field?: "joinedOn" | "leftOn" };

/** One member's join day to store, and the rows that gave it. */
export type JoinDaySet = { readonly memberId: number; readonly day: string; readonly rows: readonly At[] };

export type Plan = {
  readonly sets: readonly JoinDaySet[];
  readonly skipped: readonly Skip[];
  /** Rows with no join date: nothing to read. */
  readonly noJoinDate: number;
  /** Rows whose member already holds that join day. */
  readonly alreadyStored: number;
  /** Members several rows with different join days find: the earliest is kept. */
  readonly severalDays: number;
  /** Join days read with day and month swapped. */
  readonly swapped: readonly At[];
};

function emailsOf(value: Readonly<Record<string, string>>): string[] {
  const emails = EMAIL_FIELDS.map((f) => (value[f] ?? "").trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return [...new Set(emails)];
}

export function planBackfill(roster: Roster, snapshot: Snapshot): Plan {
  const byEmail = new Map<string, Set<number>>();
  for (const { email, memberId } of snapshot.memberEmails) byEmail.set(email, (byEmail.get(email) ?? new Set()).add(memberId));

  const skipped: Skip[] = [];
  const swapped: At[] = [];
  let noJoinDate = 0;
  const found = new Map<number, { day: string; at: At }[]>();
  for (const row of roster.rows) {
    const join = joinDayOf(row);
    if (join.kind === "no-join-date") {
      noJoinDate++;
      continue;
    }
    if (join.kind === "date-unreadable") {
      skipped.push({ kind: join.kind, at: row.at, field: join.field });
      continue;
    }
    if (join.kind === "dates-out-of-order") {
      skipped.push({ kind: join.kind, at: row.at });
      continue;
    }
    const emails = emailsOf(row.value);
    if (emails.length === 0) {
      skipped.push({ kind: "no-email", at: row.at });
      continue;
    }
    const memberIds = new Set(emails.flatMap((e) => [...(byEmail.get(e) ?? [])]));
    if (memberIds.size !== 1) {
      skipped.push({ kind: memberIds.size === 0 ? "no-member" : "ambiguous-member", at: row.at });
      continue;
    }
    if (join.swapped) swapped.push(row.at);
    const [memberId] = memberIds;
    found.set(memberId, [...(found.get(memberId) ?? []), { day: join.day, at: row.at }]);
  }

  const sets: JoinDaySet[] = [];
  let alreadyStored = 0;
  let severalDays = 0;
  for (const [memberId, rows] of found) {
    const day = rows.map((r) => r.day).reduce((a, b) => (b < a ? b : a));
    if (new Set(rows.map((r) => r.day)).size > 1) severalDays++;
    const stored = snapshot.joinedTeamOn.get(memberId) ?? null;
    if (stored === day) {
      alreadyStored += rows.length;
      continue;
    }
    if (stored !== null) {
      for (const r of rows) skipped.push({ kind: "stored-differs", at: r.at });
      continue;
    }
    sets.push({ memberId, day, rows: rows.map((r) => r.at) });
  }
  return { sets, skipped, noJoinDate, alreadyStored, severalDays, swapped };
}
