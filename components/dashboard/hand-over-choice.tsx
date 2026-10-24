"use client";

import { KeyRound, Lock } from "lucide-react";
import {
  advisorOptionDetail,
  BECOME_AN_ADVISOR,
  fullAccessMovesLine,
  steppingDown,
  type HandOverOutcome,
  type SteppedDownFrom,
} from "@/lib/dashboard/hand-over";
import type { Permission } from "@/lib/dashboard/team";
import type { FullAccessSeat } from "@/lib/dashboard/viewer";

// The one-of choice the structure panels ask about the person stepping down
// (issue #253): "What happens to Marco?" on lead replace (board 68b4) and
// Change head (77e), and "What you do next" on the Team Leader box (77i).
// The rule behind each option is `steppingDown`, and "Become an advisor" reads
// its one wording there too (lib/dashboard/hand-over.ts, issue #441).

const FOCUS_RING = "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";

export type ChoiceOption<T extends string> = {
  readonly value: T;
  readonly title: string;
  readonly detail: string;
  /** Leaving the team reads in red in the list (board 68b4). */
  readonly danger?: boolean;
  /** Open, or locked with the reason the detail line shows instead. */
  readonly permission?: Permission;
};

/**
 * A radio group. "list" is one bordered list with a line between options
 * (boards 68b4, 77e); "cards" is one card per option, the picked one edged in
 * the accent (board 77i). Nothing is picked while `value` is null.
 */
export function RadioChoice<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  layout = "list",
}: {
  name: string;
  legend: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  layout?: "list" | "cards";
}) {
  const cards = layout === "cards";
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] text-prt-text">{legend}</legend>
      <div className={cards ? "flex flex-col gap-2" : "overflow-hidden rounded-xl border border-hairline divide-y divide-hairline"}>
        {options.map((o) => {
          const permission = o.permission ?? { allowed: true };
          const disabled = !permission.allowed;
          const checked = value === o.value;
          const frame = cards ? `rounded-xl border ${checked ? "border-accent bg-accent/[0.05]" : "border-hairline"}` : "";
          return (
            <label
              key={o.value}
              className={`flex items-start gap-3 px-3.5 py-3 transition-colors duration-300 ease-out ${frame} ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-white-5"}`}
            >
              <input type="radio" name={name} value={o.value} checked={checked} disabled={disabled} onChange={() => onChange(o.value)} className="peer sr-only" />
              <span
                aria-hidden
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${FOCUS_RING} ${checked ? "border-accent" : "border-white-10"}`}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0">
                <span className={`flex items-center gap-1.5 text-[14px] ${disabled ? "text-prt-muted" : o.danger && !cards ? "text-danger" : "text-prt-text"}`}>
                  {disabled && <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  {o.title}
                </span>
                <span className="block text-[12px] leading-snug text-prt-muted">{permission.allowed ? o.detail : permission.reason}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * "Pietro Ricci becomes Operations lead and gets full access. You lose full
 * access." (issue #501): the one note every hand-over and replacement screen
 * shows before its confirm when the role handed over carries a full-access
 * seat. Its words are `fullAccessMovesLine`'s; a role with no seat shows
 * nothing.
 */
export function FullAccessMoves({ className = "", ...words }: Parameters<typeof fullAccessMovesLine>[0] & { className?: string }) {
  const line = fullAccessMovesLine(words);
  if (line === null) return null;
  return (
    <p className={`flex gap-3 rounded-xl border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2 ${className}`}>
      <KeyRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      <span>{line}</span>
    </p>
  );
}

/**
 * "Become an advisor" / "Leave the team" for a lead, head or seat holder who
 * is replaced (boards 68b4 and 77e, issue #627): an advisor in `unit`, whose
 * access ends, or Alumni.
 * No third option, and neither is picked at first. When the role carries a
 * full-access seat, the note under it says the seat moves (`FullAccessMoves`).
 */
export function HandOverChoice({
  name,
  person,
  handed,
  unit,
  value,
  leave,
  seat,
  successor,
  onChange,
}: {
  name: string;
  /** Whose next step it is: "Marco Bianchi". */
  person: string;
  /** The role they hand over, or the team-level seat they step down from: an advisor stays in its unit (`advising`). */
  handed: SteppedDownFrom;
  /** That unit's name: "Mission Analysis", "Aerodynamics". */
  unit: string;
  value: HandOverOutcome | null;
  /** Whether this editor may move them to Alumni (`mayLeaveTeam`). */
  leave: Permission;
  /** The full-access seat the role carries (`seatOfHandedRole`), or null. */
  seat: FullAccessSeat | null;
  /** Who takes the role over: "Pietro Ricci". */
  successor: string;
  onChange: (outcome: HandOverOutcome) => void;
}) {
  return (
    <>
      <RadioChoice
        name={name}
        legend={`What happens to ${person.split(" ")[0] ?? person}?`}
        value={value}
        onChange={onChange}
        options={[
          { value: "advisor", title: BECOME_AN_ADVISOR, detail: advisorOptionDetail(handed, unit, "they") },
          { value: "leave", title: "Leave the team", detail: "Moves to Alumni; their access ends", danger: true, permission: leave },
        ]}
      />
      <FullAccessMoves className="mt-3" seat={seat} successor={successor} from={person} step={value === null ? null : steppingDown(handed, value)} />
    </>
  );
}
