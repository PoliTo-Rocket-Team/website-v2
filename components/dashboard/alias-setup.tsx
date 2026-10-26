"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { AtSign, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { confirmAliasSetUp, confirmTeamAddressSetUp } from "@/app/dashboard/actions";
import type { OwnAlias } from "@/lib/dashboard/alias-setup";
import type { OwnTeamAddress } from "@/lib/dashboard/team-address";
import type { WriteResult } from "@/lib/dashboard/write";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PAPER_PILL = `inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-prt-text px-3.5 text-[13px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 ${FOCUS}`;

/**
 * An address whose holder sets it up once in Gmail (boards 94f and 94g): the
 * member's own email alias (issue #542), or a team address they hold (owner
 * finding on PR #794). Both read the same card and steps; only the words and
 * where I've set it up is stored differ.
 */
export type ReadyAddress = { readonly kind: "alias"; readonly own: OwnAlias } | { readonly kind: "team-address"; readonly own: OwnTeamAddress };

/** What the card and the steps call each kind. Only the alias has a way back to the steps, on My profile. */
const KINDS = {
  alias: { noun: "email alias", short: "alias", name: "Email alias", reopen: "You can open these steps again any time from My profile → Setup steps." },
  "team-address": { noun: "team address", short: "team address", name: "Team address", reopen: null },
} as const satisfies Record<ReadyAddress["kind"], { noun: string; short: string; name: string; reopen: string | null }>;

/** "I've set it up": on the member's own record for the alias, on the address itself for a team address. */
function confirmSetUp(ready: ReadyAddress): Promise<WriteResult<null>> {
  return ready.kind === "alias" ? confirmAliasSetUp() : confirmTeamAddressSetUp(ready.own.id);
}

/**
 * Board 94f (issue #542): "Your email alias is ready" on the member's own
 * Overview, with Open setup steps, until they press "I've set it up" in the
 * steps; for a team address the holder was given, "Your team address is
 * ready" the same way. Close only closes them, so the card is still here
 * after a reload.
 */
export function AddressReadyCard({ ready }: { ready: ReadyAddress }) {
  const [open, setOpen] = useState(false);
  const words = KINDS[ready.kind];
  return (
    <section
      aria-label={ready.kind === "alias" ? words.name : `${words.name} ${ready.own.address}`}
      className="flex flex-col gap-3.5 rounded-xl border border-success/25 bg-success/[0.05] p-4 sm:flex-row sm:items-start md:px-5 md:py-[18px]"
    >
      <span className="hidden h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-success-soft text-success sm:flex">
        <AtSign aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-[15px] font-semibold leading-snug">
          Your {words.noun} is ready: {ready.own.address}
        </h2>
        <p className="mt-2 text-[13px] text-prt-muted">
          It already receives mail. To send from it too, set it up once in Gmail. It works for email only, not for sharing files. This card goes
          away once you press I&apos;ve set it up in the steps.
        </p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className={`${PAPER_PILL} self-start sm:self-center`}>
        Open setup steps
      </button>
      <SetupSteps ready={ready} open={open} onOpenChange={setOpen} />
    </section>
  );
}

/** My profile's way back to the steps (issue #542): the same panel as the Overview card's, at any time. */
export function AliasSetupLink({ alias }: { alias: OwnAlias }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[13px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`}
      >
        Setup steps
      </button>
      <SetupSteps ready={{ kind: "alias", own: alias }} open={open} onOpenChange={setOpen} />
    </>
  );
}

const SECTION_LABEL = "font-mono text-[10px] uppercase tracking-[0.14em] text-dim";
const STEP = "text-[13px] leading-[1.45] text-prt-text";

/**
 * Board 94g: "Set up your email alias", the team's activation procedure
 * (epic #538), and the same steps for a team address. Close only closes it;
 * "I've set it up" stores that (on the member's own record for the alias, on
 * the address for a team address), and is offered only while it is not
 * stored yet.
 */
function SetupSteps({ ready, open, onOpenChange }: { ready: ReadyAddress; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition();
  const words = KINDS[ready.kind];
  const { address, setUp } = ready.own;
  const confirm = () =>
    startTransition(async () => {
      const result = await confirmSetUp(ready);
      if (!result.ok) {
        toast.error("Could not save that", { description: result.error });
        return;
      }
      toast.success(`${words.name} set up`);
      onOpenChange(false);
    });
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={`Set up your ${words.noun}`}
      detail={address}
      wide
      footerLayout={setUp ? "row" : "pair"}
      footer={
        <>
          <DialogClose className={`${PANEL_GHOST_BUTTON} ${setUp ? "flex-1" : ""}`}>Close</DialogClose>
          {!setUp && (
            <button type="button" disabled={pending} onClick={confirm} className={PANEL_PRIMARY_BUTTON}>
              I&apos;ve set it up
            </button>
          )}
        </>
      }
    >
      <PanelBody className="flex flex-col gap-5 md:py-5">
        <div className="flex items-start gap-2 rounded-[10px] bg-white-5 px-3 py-2.5 text-[12px] leading-snug text-prt-muted">
          <Info aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <div className="flex flex-col gap-1.5">
            <p>The {words.short} only receives and sends mail: sharing files with it does not work.</p>
            <p>
              Don&apos;t test it by mailing yourself between the {words.short} and your own address: they are the same inbox, so the mail is
              dropped.
            </p>
          </div>
        </div>
        <section className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL}>First, an app password</h3>
          <ol className="flex flex-col gap-2">
            <Step n={1}>Turn on two-step verification for your Google account.</Step>
            <Step n={2}>Search for “App passwords”, create one with a name you will recognise, and copy the 16-character password.</Step>
          </ol>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL}>Then, in Gmail on a computer</h3>
          <ol className="flex flex-col gap-2">
            <Step n={3}>Settings → See all settings → Accounts and Import → Send mail as → Add another email address.</Step>
            <Step n={4}>
              Name: how you sign. Email: <span className="break-all">{address}</span>. Keep “Treat as an alias” ticked.
            </Step>
            <Step n={5}>SMTP server smtp.gmail.com, port 587, TLS. Username: your Gmail name without @gmail.com.</Step>
            <Step n={6}>Password: the app password (no spaces). Authenticate, then follow the verification email.</Step>
          </ol>
        </section>
        <OptionalSteps address={address} />
        {words.reopen && <p className="text-[12px] leading-snug text-prt-muted">{words.reopen}</p>}
      </PanelBody>
    </SidePanel>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className={STEP}>
      <span className="tabular-nums">{n}.</span>
      {"  "}
      {children}
    </li>
  );
}

/** Board 94g's closed "Optional" row; open, the PRT label, the filter and the signature (epic #538). */
function OptionalSteps({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rounded-[10px] border border-hairline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-[10px] px-3.5 py-3 text-left text-[13px] text-prt-text transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS} focus-visible:-outline-offset-2`}
      >
        <ChevronRight aria-hidden className={`h-3.5 w-3.5 shrink-0 text-prt-muted transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`} strokeWidth={1.75} />
        Optional: a PRT label, a filter and a signature
      </button>
      {open && (
        <ol id={id} className="flex flex-col gap-2 border-t border-hairline px-3.5 py-3">
          <Step n={1}>In Gmail, create a label named PRT.</Step>
          <Step n={2}>
            Add a filter on mail sent to <span className="break-all">{address}</span> that applies the PRT label.
          </Step>
          <Step n={3}>
            Make a PRT signature: your name, your role, PoliTo Rocket Team, Dept. of Mechanical &amp; Aerospace Eng., Politecnico di Torino. Set
            it as the default for <span className="break-all">{address}</span> on new mail and on replies.
          </Step>
        </ol>
      )}
    </div>
  );
}
