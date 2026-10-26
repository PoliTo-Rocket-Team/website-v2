"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Mail } from "lucide-react";
import {
  ACCEPTANCE_EMAILS_ANCHOR,
  ACCEPTANCE_EMAILS_SHOWN,
  copyAllLine,
  distinctEmails,
  placeLine,
  type AcceptanceEmailRow,
} from "@/lib/dashboard/acceptance-emails";
import { dayMonth } from "@/lib/dashboard/application-flow";
import { Avatar } from "./avatar";
import { copyText, IconButton } from "./copy-button";
import { rowActionClass } from "./panel";

// The team leader's box at the top of Applications (board 100, issue #744):
// every application waiting for its acceptance email, team-wide and blind to
// the page's filters, with a copy button per email, "Copy all N emails" and
// an Open button per row that opens the application's panel, where the status
// is set to "Accepted · email sent". The first five rows show; "Show all N"
// shows the rest. Nothing renders when no application waits. The page passes
// no rows to anyone but the team leader (`acceptanceEmailsFor`).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AcceptanceEmailsBox({
  rows,
  sentStatusName,
  onOpen,
}: {
  rows: readonly AcceptanceEmailRow[];
  /** What the status list calls "Accepted · email sent" now, for the instruction line. */
  sentStatusName: string;
  onOpen: (applicationId: number) => void;
}) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  const emails = distinctEmails(rows).length;
  const shown = all ? rows : rows.slice(0, ACCEPTANCE_EMAILS_SHOWN);
  const more = rows.length > ACCEPTANCE_EMAILS_SHOWN;
  return (
    <section
      id={ACCEPTANCE_EMAILS_ANCHOR}
      aria-labelledby={`${ACCEPTANCE_EMAILS_ANCHOR}-title`}
      className="mb-4 scroll-mt-24 overflow-hidden rounded-xl border border-accent/40 bg-accent/[0.04] md:mb-0 md:mt-6"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-hairline px-4 py-3.5 md:flex-nowrap md:px-5 md:py-4">
        <Mail aria-hidden className="h-[18px] w-[18px] shrink-0 self-start text-accent md:mt-0.5" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h2 id={`${ACCEPTANCE_EMAILS_ANCHOR}-title`} className="text-[15px] font-semibold leading-snug">
            Acceptance emails to send · {rows.length}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-text-2">
            Send each the acceptance email with the NDA, then set the status to {sentStatusName}. Only you see this.
          </p>
        </div>
        <button
          type="button"
          onClick={() => copyText(copyAllLine(rows), emails === 1 ? "Email" : "Emails")}
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-prt-text px-4 text-[13px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 max-md:w-full max-md:justify-center ${FOCUS}`}
        >
          <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {emails === 1 ? "Copy 1 email" : `Copy all ${emails} emails`}
        </button>
      </header>
      <ul className="divide-y divide-hairline">
        {shown.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 px-4 py-3 md:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1fr)_auto_auto] md:gap-x-5 md:px-5"
          >
            <Avatar person={row} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium leading-snug">{row.name}</span>
              <span className="block truncate text-[12px] leading-snug text-prt-muted">{placeLine(row)}</span>
            </span>
            <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-1 md:col-start-auto md:row-start-auto">
              <span className="truncate font-mono text-[12px] text-text-2">{row.email}</span>
              <IconButton label={`Copy ${row.name}'s email`} onClick={() => copyText(row.email, "Email")}>
                <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </span>
            <span className="col-start-2 row-start-3 whitespace-nowrap text-[12px] text-prt-muted md:col-start-auto md:row-start-auto">
              {row.acceptedAt && `accepted ${dayMonth(row.acceptedAt)}`}
            </span>
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              aria-label={`Open ${row.name}'s application`}
              className={`${rowActionClass(false)} col-start-3 row-span-3 row-start-1 md:col-start-auto md:row-span-1 md:row-start-auto`}
            >
              Open
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className={`flex w-full items-center gap-1.5 border-t border-hairline px-4 py-3 text-left text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:px-5`}
        >
          {all ? "Show fewer" : `Show all ${rows.length}`}
          {all ? <ChevronUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />}
        </button>
      )}
    </section>
  );
}
