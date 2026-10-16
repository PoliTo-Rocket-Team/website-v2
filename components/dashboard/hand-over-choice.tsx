"use client";

import { Lock } from "lucide-react";
import type { HandOverOutcome } from "@/lib/dashboard/hand-over";
import type { Permission } from "@/lib/dashboard/team";

// The one-of choice the structure panels ask about the person stepping down
// (issue #253): "What happens to Marco?" on lead replace (board 68b4) and
// Change head (77e), and "What you do next" on the Team Leader box (77i).
// The rule behind each option is `steppingDown` (lib/dashboard/hand-over.ts).

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
 * "Become an advisor" / "Leave the team" for a lead or head who is replaced
 * (boards 68b4 and 77e): an advisor in `unit`, whose access ends, or Alumni.
 * No third option, and neither is picked at first.
 */
export function HandOverChoice({
  name,
  person,
  unit,
  value,
  leave,
  onChange,
}: {
  name: string;
  /** Whose next step it is: "Marco Bianchi". */
  person: string;
  /** Where they stay as an advisor: "Mission Analysis", "Aerodynamics". */
  unit: string;
  value: HandOverOutcome | null;
  /** Whether this editor may move them to Alumni (`mayLeaveTeam`). */
  leave: Permission;
  onChange: (outcome: HandOverOutcome) => void;
}) {
  return (
    <RadioChoice
      name={name}
      legend={`What happens to ${person.split(" ")[0] ?? person}?`}
      value={value}
      onChange={onChange}
      options={[
        { value: "advisor", title: "Become an advisor", detail: `Stays in ${unit} as an advisor; their access ends` },
        { value: "leave", title: "Leave the team", detail: "Moves to Alumni; their access ends", danger: true, permission: leave },
      ]}
    />
  );
}
