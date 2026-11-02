"use client";

import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { AtSign, Building2, Check, ChevronDown, Eye, EyeOff, FileCheck2, Lock, Mail, MailX, Upload, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePhoneGrouping } from "@/components/use-phone-grouping";
import { PHONE_PLACEHOLDER } from "@/lib/phone";
import { addMember, findForAdd, moveMember, saveMember, saveMemberDetails, setMemberPhoto } from "@/app/dashboard/team-actions";
import { cancelAliasRequest, removeTeamAddress, requestAlias, requestTeamAddress } from "@/app/dashboard/actions";
import { ALIAS_FORM_HINT, aliasPrefill, checkAliasAddress, personalRequestChoice, TEAM_DOMAIN, type MemberAlias } from "@/lib/dashboard/alias-request";
import type { Permission } from "@/lib/dashboard/team";
import { checkPurpose, checkTeamAddress, PURPOSE_MAX, type MovesWithOption, type TeamAddressLine, type TeamAddressRow } from "@/lib/dashboard/team-address";
import { DEGREE_PROGRAMMES, GENDERS, STUDY_PROGRAMMES } from "@/lib/apply/application-form";
import {
  levelLabel,
  memberDetailText,
  NO_MEMBER_DETAILS,
  type MemberDetailErrors,
  type MemberDetailKey,
  type MemberDetails,
} from "@/lib/dashboard/details";
import {
  checkAddMember,
  checkMemberEdit,
  checkMemberPhoto,
  GOOGLE_EMAIL_NOTE,
  roleTitleError,
  type AddLookup,
  type AddMemberErrors,
  type DivisionHeader,
  type DivisionPerson,
  type LandedSent,
  type MemberPosition,
  type TeamMatch,
  type WaitingPerson,
} from "@/lib/dashboard/division-members";
import type { EditPerson, MemberActions } from "@/lib/dashboard/members-view";
import { PLACE_TAG_LABELS, placeHeaderLine, type PersonPlace, type PlaceTag } from "@/lib/dashboard/member-places";
import { MAX_NAME, type PersonName } from "@/lib/dashboard/person-name";
import { divisionLabel } from "@/lib/dashboard/team";
import { shortDate } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CopyButton, IconButton } from "./copy-button";
import { RadioChoice } from "./hand-over-choice";
import { Chips } from "./division-chips";
import { MemberDialogs, type Asking } from "./division-members";
import {
  choiceOf,
  HeadMoveConfirm,
  MoveFields,
  MoveHint,
  moveToOf,
  NoHeadNote,
  placeKey,
  unitShort,
  useMoveTargets,
  type HeadMoveAnswer,
  type MoveChoice,
} from "./member-move";
import { headsAfterMove, titleOnMove, type MovablePlace } from "@/lib/dashboard/member-move";
import { ConfirmDialog, SHEET_BUTTONS, SHEET_CANCEL, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber, sheetConfirm } from "./confirm-dialog";
import { Drawer, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { fieldSummaryOf, type FormSummary, type SummaryField } from "@/lib/dashboard/error-summary";
import { focusField } from "./error-summary";
import { Field, GroupLabel, inputClass, LOCKED_INPUT } from "./field";
import { PersonCombobox } from "./person-combobox";
import { Toggle } from "./controls";
import { EYEBROW, GHOST_PILL } from "./page-header";
import { PHOTO_ACCEPT, PhotoCropDialog } from "./photo-crop-dialog";

// The member panels of every Members page (issues #231, #584 and #647): the
// member panel with their placement and private data (boards 61f, 98), Edit
// details (61g, with the move of boards 98a to 98c and board 46b's Leaving
// the team), the one member editor for every viewer who may edit someone, and
// Add member (61h, 61h2).
// Private data is blurred until hover; there is no access section, since
// access lives only on the Access page.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className={`${EYEBROW} mb-3`}>
        {title}
        {hint && <span className="ml-2 normal-case tracking-normal text-dim">· {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

/**
 * A fact row: the 132px label column, then the value (board 94e). A stacked
 * row puts its label above the value on a phone, where the panel is the whole
 * screen, so a long address gets the row's width (issue #546).
 */
function factRow(stack: boolean): string {
  return `flex min-h-7 items-center gap-x-3 ${stack ? "flex-wrap md:flex-nowrap" : ""}`;
}

function factLabel(stack: boolean): string {
  return `${stack ? "w-full md:w-[132px]" : "w-[132px]"} shrink-0 text-[14px] text-prt-muted`;
}

/** One fact on the member panel: label, value, and a copy or show button. Empty reads as a dim dash. */
function Fact({
  label,
  value,
  copy,
  hidden,
  wrap,
  stack = false,
}: {
  label: string;
  value: string | null;
  /** Copies the value, with this name in the toast. */
  copy?: string;
  /** Blurred until hover, with an eye that shows it for good. */
  hidden?: boolean;
  /** Wraps a long value onto a second line instead of cutting it. */
  wrap?: boolean;
  /** The label sits above the value on a phone. */
  stack?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const blur = hidden && !shown && value !== null;
  return (
    <div className={factRow(stack)}>
      <dt className={factLabel(stack)}>{label}</dt>
      <dd className={`min-w-0 flex-1 text-[14px] text-prt-text ${wrap ? "break-words" : "truncate"}`}>
        {value === null ? (
          <span className="text-dim">–</span>
        ) : (
          <span className={`transition-[filter] duration-300 ease-out ${blur ? "blur-[5px] hover:blur-none" : ""}`}>{value}</span>
        )}
      </dd>
      {value !== null && copy && <CopyButton value={value} what={copy} />}
      {value !== null && hidden && (
        <IconButton label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setShown((s) => !s)}>
          {shown ? <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
        </IconButton>
      )}
    </div>
  );
}

/** What the member panel shows of someone: a division page's person, or one on the team leader's whole-team page (issue #252). */
export type PanelPerson = Pick<DivisionPerson, "id" | "name" | "signInEmail" | "photoUrl" | "since" | "divisions" | "places" | "details" | "nda" | "self">;

/** A Placement row's tag (board 98): Lead and Head in the accent, the rest on the white tint. */
const PLACE_TAG_TONE: Readonly<Record<PlaceTag, string>> = {
  lead: "bg-accent-soft text-accent",
  head: "bg-accent-soft text-accent",
  member: "bg-white-10 text-prt-text",
  seat: "bg-white-10 text-prt-text",
  advisor: "bg-white-10 text-prt-muted",
};

/** One row of the Placement section (board 98): the code chip, the stored title over its unit, and the tag. */
function PlaceRow({ place }: { place: PersonPlace }) {
  return (
    <li className="flex items-center gap-3 rounded-[10px] border border-hairline bg-white-5 px-3.5 py-2.5">
      {place.code !== null ? (
        <Chips chips={[{ divisionId: 0, label: place.code, code: true }]} />
      ) : (
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hairline">
          <Building2 className="h-3.5 w-3.5 text-prt-muted" strokeWidth={1.75} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-prt-text">{place.title}</span>
        {place.unit !== null && <span className="block truncate text-[13px] text-prt-muted">{place.unit}</span>}
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${PLACE_TAG_TONE[place.tag]}`}>{PLACE_TAG_LABELS[place.tag]}</span>
    </li>
  );
}

/**
 * The member panel (boards 61f and 98): placement, contact, studies, personal
 * and the NDA. Close, and Edit details. It is the wide panel, as boards 94 to
 * 94e draw it, so the PRT emails row keeps its whole addresses and request line.
 */
export function PersonDrawer<P extends PanelPerson>({
  person,
  alias,
  teamAddresses,
  googleEmails,
  movesWith,
  editable,
  onClose,
  onEdit,
}: {
  person: P | null;
  /** The other Google accounts they sign in with, as the page read them for this viewer (issue #908); empty for none. */
  googleEmails: readonly string[];
  /** Their email alias, their PRT email, as the viewer sees it (epic #538, issue #563); null when it was not read. */
  alias: MemberAlias | null;
  /**
   * The special PRT emails they hold (epic #578, boards 102 and 102b) and
   * whether the viewer may request a PRT email for them (issue #798); null
   * when they hold none and the viewer may not ask.
   */
  teamAddresses: TeamAddressRow | null;
  /** The roles the request dialog's Moves with offers. */
  movesWith: readonly MovesWithOption[];
  editable: boolean;
  onClose: () => void;
  onEdit: (person: P) => void;
}) {
  // The panel keeps showing the last person while it closes.
  const [shown, setShown] = useState(person);
  if (person !== null && person !== shown) setShown(person);
  const p = person ?? shown;
  if (p === null) return null;
  const d = p.details;
  return (
    <SidePanel
      open={person !== null}
      onOpenChange={(next) => !next && onClose()}
      title={p.name}
      detail={placeHeaderLine(p.places, p.since)}
      leading={<Avatar size="panel" person={p} />}
      wide
      footer={
        editable && !p.self ? (
          <>
            <DialogClose className={PANEL_GHOST_BUTTON}>Close</DialogClose>
            <button type="button" onClick={() => onEdit(p)} className={PANEL_PRIMARY_BUTTON}>
              Edit details
            </button>
          </>
        ) : (
          <DialogClose className={`${PANEL_GHOST_BUTTON} col-span-2`}>Close</DialogClose>
        )
      }
    >
      <PanelBody>
        <Section title="Placement">
          <ul className="flex flex-col gap-2">
            {p.places.map((place, i) => (
              <PlaceRow key={i} place={place} />
            ))}
          </ul>
        </Section>

        <Section title="Contact">
          <dl className="flex flex-col gap-1.5">
            <PrtEmailsFact
              memberId={p.id}
              name={p.name}
              address={memberDetailText(d, "prtEmail")}
              alias={alias}
              special={teamAddresses}
              movesWith={movesWith}
            />
            <Fact label="Personal email" value={p.signInEmail} copy="Email" wrap stack />
            <GoogleEmailsFact emails={googleEmails} />
            <Fact label="Phone" value={memberDetailText(d, "phone")} hidden />
            <Fact label="Discord" value={memberDetailText(d, "discord")} copy="Discord" />
            <Fact label="LinkedIn" value={memberDetailText(d, "linkedin")} />
          </dl>
        </Section>

        <Section title="Studies">
          <dl className="flex flex-col gap-1.5">
            <Fact label="PoliTo ID" value={memberDetailText(d, "politoId")} />
            <Fact label="Program" value={memberDetailText(d, "programme")} />
            <Fact label="Level" value={memberDetailText(d, "level")} />
            <Fact label="From" value={memberDetailText(d, "country")} />
          </dl>
        </Section>

        <Section title="Personal" hint="hover to show">
          <dl className="flex flex-col gap-1.5">
            <Fact label="Date of birth" value={memberDetailText(d, "birthDate")} hidden />
            <Fact label="Gender" value={memberDetailText(d, "gender")} hidden />
          </dl>
        </Section>

        {p.nda && (
          <Section title="NDA">
            <p className="flex items-center gap-2.5 rounded-[10px] border border-success/40 bg-success/[0.06] px-3.5 py-2.5 text-[13px] text-prt-text">
              <FileCheck2 aria-hidden className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
              Signed {shortDate(p.nda.signedOn, 0)}
              {p.nda.confirmedBy && ` · confirmed by ${p.nda.confirmedBy}`}
            </p>
          </Section>
        )}
      </PanelBody>
    </SidePanel>
  );
}

/**
 * An address on a PRT emails line, as it wraps: the part before the "@" may
 * break where the line is short, and the "@" with the team domain stays
 * whole after it, so a narrow line never cuts the domain in two (owner
 * finding on PR #803).
 */
function AddressText({ address }: { address: string }) {
  const at = address.lastIndexOf("@");
  if (at === -1) return <span className="block break-words text-[14px] text-prt-text">{address}</span>;
  return (
    <span className="block break-words text-[14px] text-prt-text">
      {address.slice(0, at)}
      <wbr />
      <span className="whitespace-nowrap">{address.slice(at)}</span>
    </span>
  );
}

/**
 * The other Google accounts a member signs in with (issue #908), under the
 * personal email, which stays the one sign-in address: one per line with its
 * copy button, as the PRT emails row lists its addresses. Left out when they
 * have none.
 */
function GoogleEmailsFact({ emails }: { emails: readonly string[] }) {
  if (emails.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-x-3 md:flex-nowrap">
      <dt className={`${factLabel(true)} md:py-1`}>Also signs in with</dt>
      <dd className="min-w-0 flex-1">
        <ul className="flex w-full flex-col gap-1">
          {emails.map((email) => (
            <li key={email} className="flex items-start gap-x-3">
              <span className="min-w-0 flex-1 py-1">
                <AddressText address={email} />
              </span>
              <CopyButton value={email} what="Email" />
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

/** A line's kind under its address (issue #798): "personal", or "special" with what it is for and the role it moves with. */
function LineNote({ children }: { children: ReactNode }) {
  return <span className="block break-words text-[12px] text-prt-muted">{children}</span>;
}

/**
 * The member's PRT emails (issue #798, in place of the PRT email row of
 * boards 94 to 94e and the Team addresses row of boards 102 and 102b): their
 * personal address, or the open personal request, then each special address
 * they hold, one per line with a copy button. Request PRT email ends the row
 * for a viewer who may ask (`mayAskFor`), whatever the member holds. The
 * server decides all of it; the row is left out when the member holds
 * nothing, has no open request and the viewer may not ask.
 */
function PrtEmailsFact({
  memberId,
  name,
  address,
  alias,
  special,
  movesWith,
}: {
  memberId: number;
  name: string;
  /** The PRT email as the member's details store it. */
  address: string | null;
  alias: MemberAlias | null;
  special: TeamAddressRow | null;
  movesWith: readonly MovesWithOption[];
}) {
  const [asking, setAsking] = useState(false);
  const personal = address ?? (alias?.kind === "set" ? alias.address : null);
  const requested = alias?.kind === "requested" ? alias : null;
  const lines = special?.lines ?? [];
  const requestable = special?.requestable === true || (alias?.kind === "none" && alias.requestable);
  if (personal === null && requested === null && lines.length === 0 && !requestable) return null;
  const empty = personal === null && requested === null && lines.length === 0;
  return (
    <div className="flex flex-wrap items-start gap-x-3 md:flex-nowrap">
      <dt className={`${factLabel(true)} md:py-1`}>PRT emails</dt>
      <dd className="flex min-w-0 flex-1 flex-col items-start gap-2">
        {empty ? (
          <span className="py-1 text-[14px] text-prt-muted">None</span>
        ) : (
          <ul className="flex w-full flex-col gap-1">
            {personal !== null && <PersonalLine address={personal} />}
            {personal === null && requested !== null && <RequestedLine request={requested} />}
            {lines.map((line) => (
              <SpecialLine key={line.id} line={line} holder={name} />
            ))}
          </ul>
        )}
        {requestable && (
          <>
            <button type="button" onClick={() => setAsking(true)} className={GHOST_PILL}>
              <AtSign aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Request PRT email
            </button>
            <RequestPrtEmailDialog
              open={asking}
              onOpenChange={setAsking}
              memberId={memberId}
              name={name}
              personal={personalRequestChoice(personal === null ? alias : null, name)}
              movesWith={movesWith}
            />
          </>
        )}
      </dd>
    </div>
  );
}

/** The personal PRT email (board 94e): the address over "personal", and its copy button. It has no Remove. */
function PersonalLine({ address }: { address: string }) {
  return (
    <li className="flex items-start gap-x-3">
      <span className="min-w-0 flex-1 py-1">
        <AddressText address={address} />
        <LineNote>personal</LineNote>
      </span>
      <CopyButton value={address} what="PRT email" />
    </li>
  );
}

/**
 * The open personal request (board 94b): Requested, who sent it and when,
 * over "personal", and Cancel request where the sender or a lead or head may
 * cancel it. The server decides which.
 */
function RequestedLine({ request }: { request: Extract<MemberAlias, { kind: "requested" }> }) {
  const [pending, startTransition] = useTransition();
  const cancel = () =>
    startTransition(async () => {
      const result = await cancelAliasRequest(request.requestId);
      if (!result.ok) {
        toast.error("Could not cancel the PRT email request", { description: result.error });
        return;
      }
      toast.success("PRT email request cancelled");
    });
  return (
    <li className="flex items-start gap-x-3" aria-busy={pending}>
      <span className="min-w-0 flex-1 py-1">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-[13px] font-medium text-warning">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
            Requested
          </span>
          {/* Wraps under the pill where the row is short, never cut (issue #546). */}
          <span className="min-w-0 break-words text-[13px] text-prt-muted">{request.line}</span>
        </span>
        <LineNote>personal</LineNote>
      </span>
      {request.cancellable && (
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className={`flex h-7 shrink-0 items-center rounded-md text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text disabled:opacity-60 ${FOCUS}`}
        >
          Cancel request
        </button>
      )}
    </li>
  );
}

/**
 * One special PRT email: the address over "special", what it is for and the
 * role it moves with, if any. Remove sits before the copy button for a
 * viewer who may request one for the holder (issue #797), so the copy button
 * keeps the same place on every line; it asks first, as every removal does.
 * Once a removal waits, the line shows the warning pill "Removal waiting"
 * under the address, for every viewer, and no Remove. The server decides
 * which.
 */
function SpecialLine({ line, holder }: { line: TeamAddressLine; holder: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const first = holder.split(" ")[0] || holder;
  const remove = () =>
    startTransition(async () => {
      const result = await removeTeamAddress(line.id);
      if (!result.ok) {
        toast.error(`Could not remove ${line.address}`, { description: result.error });
        return;
      }
      toast.success(`Removal of ${line.address} sent to the approvers`);
      setConfirming(false);
    });
  return (
    <li className="flex items-start gap-x-3" aria-busy={pending}>
      <span className="min-w-0 flex-1 py-1">
        <AddressText address={line.address} />
        <LineNote>{["special", line.purpose, line.movesWith === null ? null : `moves with ${line.movesWith}`].filter(Boolean).join(" · ")}</LineNote>
        {line.removal === "waiting" && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-[13px] font-medium text-warning">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
            Removal waiting
          </span>
        )}
      </span>
      {line.removal === "removable" && (
        <>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`flex h-7 shrink-0 items-center rounded-md text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
          >
            Remove
          </button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            icon={<MailX className="h-5 w-5" strokeWidth={1.75} />}
            title={`Remove ${line.address} from ${holder}?`}
            description={`The approvers turn off its routing in Google Workspace and mark it done. Then it leaves ${first}'s PRT emails and can be requested for someone else.`}
            cancelLabel="Keep address"
            confirmLabel="Remove"
            danger
            pending={pending}
            onConfirm={remove}
          />
        </>
      )}
      <CopyButton value={line.address} what="PRT email" />
    </li>
  );
}

/** The address box's fixed ending (board 102b): the team domain, which the person never types. */
const DOMAIN_SUFFIX = `@${TEAM_DOMAIN}`;

/**
 * What the Address box sends: the part typed with the team domain after it.
 * A part typed with another domain is kept whole, so the address check
 * refuses it with the off-domain message.
 */
function addressOf(local: string): string {
  const typed = local.trim();
  return typed.includes("@") ? typed : `${typed}${DOMAIN_SUFFIX}`;
}

/** A pasted whole address loses its domain, which the box shows already. */
function localOf(typed: string): string {
  return typed.toLowerCase().endsWith(DOMAIN_SUFFIX) ? typed.slice(0, -DOMAIN_SUFFIX.length) : typed;
}

/** Request PRT email's two choices (issue #798). */
type PrtEmailKind = "personal" | "special";

/**
 * Request PRT email (issue #798): one dialog for both kinds. The requester
 * picks Personal, offered only while the member has no personal PRT email
 * and no open personal request (`personalRequestChoice`), or Special, the
 * Request team address form of board 102b as it was. 480px wide with a 24px
 * pad and 40px fields and buttons, as board 102b draws it. Closing it drops
 * what was typed.
 */
function RequestPrtEmailDialog({
  open,
  onOpenChange,
  memberId,
  name,
  personal,
  movesWith,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: number;
  name: string;
  personal: Permission;
  movesWith: readonly MovesWithOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={cn(SHEET_CONTENT, "sm:w-[480px] sm:p-6")}>
          <SheetGrabber />
          <RequestPrtEmailBody memberId={memberId} name={name} personal={personal} movesWith={movesWith} onDone={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function RequestPrtEmailBody({
  memberId,
  name,
  personal,
  movesWith,
  onDone,
}: {
  memberId: number;
  name: string;
  personal: Permission;
  movesWith: readonly MovesWithOption[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<PrtEmailKind>(personal.allowed ? "personal" : "special");
  return (
    <>
      <DialogTitle className="text-[17px] font-bold leading-snug">Request PRT email</DialogTitle>
      <p className="mt-1.5 text-[14px] leading-relaxed text-prt-muted">For {name}</p>
      <div className="mt-6">
        <RadioChoice<PrtEmailKind>
          name="prt-email-kind"
          legend="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "personal", title: "Personal", detail: "Their own address, from their name", permission: personal },
            { value: "special", title: "Special", detail: "A shared address, such as recruitment, with what it's for" },
          ]}
        />
      </div>
      {kind === "personal" ? (
        <PersonalRequestForm memberId={memberId} name={name} onDone={onDone} />
      ) : (
        <SpecialRequestForm memberId={memberId} name={name} movesWith={movesWith} onDone={onDone} />
      )}
    </>
  );
}

/**
 * Personal (issue #798): the address, pre-filled as firstname.lastname on
 * the team domain from the member's name (`aliasPrefill`) and editable, then
 * Cancel and Confirm. It is checked before sending (`checkAliasAddress`),
 * under the field; the server checks it again, and a refusal shows above the
 * buttons and keeps the dialog open.
 */
function PersonalRequestForm({ memberId, name, onDone }: { memberId: number; name: string; onDone: () => void }) {
  const [address, setAddress] = useState(() => aliasPrefill(name));
  const [error, setError] = useState<string>();
  const [refusal, setRefusal] = useState<string>();
  const [pending, startTransition] = useTransition();

  const send = () => {
    const checked = checkAliasAddress(address);
    setRefusal(undefined);
    if (!checked.ok) return setError(checked.error);
    setError(undefined);
    startTransition(async () => {
      const result = await requestAlias({ memberId, address: checked.value.address });
      if (!result.ok) {
        setRefusal(result.error);
        return;
      }
      toast.success(`PRT email requested for ${name}`);
      onDone();
    });
  };

  return (
    <form
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Field label="Address" error={error} className="mt-5">
        {(id, describedBy) => (
          <>
            <input
              id={id}
              type="email"
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setError(undefined);
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={error !== undefined}
              aria-describedby={[describedBy, `${id}-hint`].filter(Boolean).join(" ")}
              className={cn(inputClass(error), BOX)}
            />
            <p id={`${id}-hint`} className="mt-2 text-[12px] text-prt-muted">
              {ALIAS_FORM_HINT}
            </p>
          </>
        )}
      </Field>
      {refusal !== undefined && (
        <p role="alert" className="mt-5 text-[13px] text-danger">
          {refusal}
        </p>
      )}
      <div className={SHEET_BUTTONS}>
        <DialogClose className={cn(SHEET_CANCEL, "sm:h-10")}>Cancel</DialogClose>
        <button type="submit" disabled={pending} className={cn(sheetConfirm(false), "sm:h-10")}>
          Confirm
        </button>
      </div>
    </form>
  );
}

/** The 40px box of board 102b. */
const BOX = "h-10";

/**
 * Special (board 102b, issues #787 and #798): the address, with the team
 * domain as the box's fixed ending; what it is for; and an optional Moves
 * with role from the current org chart, then Cancel and Request. Address and
 * purpose are checked before sending, under their fields; a refusal from the
 * server (taken, already requested, not allowed) shows above the buttons and
 * keeps the dialog open.
 */
function SpecialRequestForm({
  memberId,
  name,
  movesWith,
  onDone,
}: {
  memberId: number;
  name: string;
  movesWith: readonly MovesWithOption[];
  onDone: () => void;
}) {
  const [local, setLocal] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tie, setTie] = useState("");
  const [errors, setErrors] = useState<{ address?: string; purpose?: string }>({});
  const [refusal, setRefusal] = useState<string>();
  const [pending, startTransition] = useTransition();

  const send = () => {
    const address = addressOf(local);
    const checkedAddress = checkTeamAddress(address);
    const checkedPurpose = checkPurpose(purpose);
    const next = {
      address: checkedAddress.ok ? undefined : checkedAddress.error,
      purpose: checkedPurpose.ok ? undefined : checkedPurpose.error,
    };
    setErrors(next);
    setRefusal(undefined);
    if (next.address !== undefined || next.purpose !== undefined) return;
    startTransition(async () => {
      const result = await requestTeamAddress({ memberId, address, purpose, movesWith: tie === "" ? null : tie });
      if (!result.ok) {
        setRefusal(result.error);
        return;
      }
      toast.success(`PRT email requested for ${name}`);
      onDone();
    });
  };

  return (
    <form
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Field label="Address" error={errors.address} className="mt-5">
        {(id, describedBy) => (
          <div
            className={cn(
              inputClass(errors.address),
              BOX,
              "flex items-center px-0 focus-within:border-accent focus-within:bg-accent/[0.06]",
            )}
          >
            <input
              id={id}
              type="text"
              value={local}
              onChange={(event) => {
                setLocal(localOf(event.target.value));
                setErrors((e) => ({ ...e, address: undefined }));
              }}
              placeholder="recruitment"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={errors.address !== undefined}
              aria-describedby={describedBy}
              className="h-full min-w-0 flex-1 bg-transparent pl-3.5 text-[14px] text-prt-text placeholder:text-dim focus:outline-none"
            />
            <span aria-hidden className="shrink-0 pr-3.5 text-[14px] text-prt-muted">
              {DOMAIN_SUFFIX}
            </span>
          </div>
        )}
      </Field>
      <Field label="What it's for" error={errors.purpose} className="mt-5">
        {(id, describedBy) => (
          <input
            id={id}
            type="text"
            value={purpose}
            maxLength={PURPOSE_MAX}
            onChange={(event) => {
              setPurpose(event.target.value);
              setErrors((e) => ({ ...e, purpose: undefined }));
            }}
            placeholder="Recruitment"
            autoComplete="off"
            aria-invalid={errors.purpose !== undefined}
            aria-describedby={describedBy}
            className={cn(inputClass(errors.purpose), BOX)}
          />
        )}
      </Field>
      <Field label="Moves with" hint="optional" className="mt-5">
        {(id) => (
          <>
            <div className="relative">
              <select
                id={id}
                value={tie}
                onChange={(event) => setTie(event.target.value)}
                aria-describedby={`${id}-help`}
                className={cn(inputClass(), BOX, "cursor-pointer appearance-none truncate pr-10", tie === "" && "text-dim")}
              >
                <option value="" className="bg-panel text-prt-text">
                  None
                </option>
                {movesWith.map((o) => (
                  <option key={o.key} value={o.key} className="bg-panel text-prt-text">
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
            </div>
            <p id={`${id}-help`} className="mt-2 text-[12px] leading-relaxed text-prt-muted">
              When the role changes hands, the address goes to the new holder. Leave empty to keep it with this person.
            </p>
          </>
        )}
      </Field>
      {refusal !== undefined && (
        <p role="alert" className="mt-5 text-[13px] text-danger">
          {refusal}
        </p>
      )}
      <div className={SHEET_BUTTONS}>
        <DialogClose className={cn(SHEET_CANCEL, "sm:h-10")}>Cancel</DialogClose>
        <button type="submit" disabled={pending} className={cn(sheetConfirm(false), "sm:h-10")}>
          Request
        </button>
      </div>
    </form>
  );
}

/**
 * Who Edit details is open for: someone the viewer may edit, with what its
 * position part offers (issue #584), on any Members page; or someone waiting
 * to join a division (Fill details).
 */
export type EditTarget =
  | {
      readonly kind: "person";
      readonly actions: MemberActions;
      /** The other Google accounts they sign in with, as the Members page read them (issue #908); empty for none. */
      readonly googleEmails: readonly string[];
    }
  | { readonly kind: "waiting"; readonly waiting: WaitingPerson; readonly division: DivisionHeader };

type Draft = Record<MemberDetailKey, string> & { title: string };

function draftOf(title: string | null, details: MemberDetails): Draft {
  return { ...details, title: title ?? "" };
}

function SelectBox({
  id,
  name,
  describedBy,
  value,
  error,
  onChange,
  options,
  label = (o) => o,
}: {
  id: string;
  name: string;
  describedBy: string | undefined;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label?: (option: string) => string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass(error)} cursor-pointer appearance-none pr-10 ${value === "" ? "text-dim" : ""}`}
      >
        <option value="" className="bg-panel">
          Choose
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-panel text-prt-text">
            {label(o)}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
    </div>
  );
}

const PLACEHOLDERS: Partial<Record<MemberDetailKey, string>> = {
  prtEmail: "name@politorocketteam.it",
  linkedin: "linkedin.com/in/...",
  phone: PHONE_PLACEHOLDER,
  discord: "username",
  politoId: "s312456",
  country: "Italy",
};

/** Each member detail's label in Edit details and Add member, which the error summary names it by too. */
const DETAIL_LABEL: Readonly<Record<MemberDetailKey, string>> = {
  prtEmail: "PRT email",
  phone: "Phone",
  discord: "Discord",
  linkedin: "LinkedIn",
  politoId: "PoliTo ID",
  programme: "Program",
  level: "Level",
  country: "From",
  birthDate: "Date of birth",
  gender: "Gender",
};

/** One member detail as a form control, named by its key: a select for the lists, a date, or text. */
function DetailInput({
  name,
  draft,
  errors,
  set,
  className = "",
}: {
  name: MemberDetailKey;
  draft: Draft;
  errors: MemberDetailErrors;
  set: (key: keyof Draft, value: string) => void;
  className?: string;
}) {
  const error = errors[name];
  const phone = usePhoneGrouping((value) => set("phone", value));
  return (
    <Field label={DETAIL_LABEL[name]} error={error} className={className}>
      {(id, describedBy) =>
        name === "programme" ? (
          <SelectBox id={id} name={name} describedBy={describedBy} value={draft.programme} error={error} onChange={(v) => set("programme", v)} options={DEGREE_PROGRAMMES} />
        ) : name === "level" ? (
          <SelectBox
            id={id}
            name={name}
            describedBy={describedBy}
            value={draft.level}
            error={error}
            onChange={(v) => set("level", v)}
            options={STUDY_PROGRAMMES}
            label={(o) => levelLabel(o as (typeof STUDY_PROGRAMMES)[number])}
          />
        ) : name === "gender" ? (
          <SelectBox id={id} name={name} describedBy={describedBy} value={draft.gender} error={error} onChange={(v) => set("gender", v)} options={GENDERS} />
        ) : (
          <input
            id={id}
            name={name}
            type={name === "birthDate" ? "date" : name === "phone" ? "tel" : name === "prtEmail" ? "email" : "text"}
            value={draft[name]}
            aria-describedby={describedBy}
            aria-invalid={error !== undefined}
            placeholder={PLACEHOLDERS[name]}
            {...(name === "phone" ? phone : { onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, e.target.value) })}
            className={inputClass(error)}
          />
        )
      }
    </Field>
  );
}

/**
 * Edit details' other Google accounts (issue #908): under the personal email,
 * which stays the one sign-in email and the only one Save may correct, each
 * account locked on its own line, since only the member adds or removes them
 * (My profile's Google accounts). Left out when they have none.
 */
function GoogleEmailsField({ emails }: { emails: readonly string[] }) {
  const labelId = useId();
  if (emails.length === 0) return null;
  return (
    <div role="group" aria-labelledby={labelId} className="min-w-0 sm:col-span-2">
      <GroupLabel id={labelId} label="Also signs in with" hint="linked Google accounts" />
      <ul className="flex flex-col gap-2">
        {emails.map((email) => (
          <li key={email} className={LOCKED_INPUT}>
            <span className="min-w-0 flex-1 truncate">{email}</span>
            <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Edit details' Contact details in the order it shows them; the sign-in email sits after the PRT email. */
const CONTACT_DETAILS: readonly MemberDetailKey[] = ["prtEmail", "phone", "discord", "linkedin"];
/** Its Studies and Personal details, in order. */
const OTHER_DETAILS: readonly MemberDetailKey[] = ["politoId", "programme", "level", "country", "birthDate", "gender"];

/** A role title box, named `name` in the form: "Role in <division>", or a seat's "Role" (issues #626, #911). */
function TitleInput({
  name,
  label,
  value,
  error,
  required,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  error: string | undefined;
  required: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint="shown on the Team page" error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          name={name}
          value={value}
          maxLength={80}
          aria-required={required}
          aria-describedby={describedBy}
          aria-invalid={error !== undefined}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(error)}
        />
      )}
    </Field>
  );
}

function useDraft(start: Draft) {
  const [draft, setDraft] = useState(start);
  const [errors, setErrors] = useState<AddMemberErrors>({});
  const set = (key: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  return { draft, setDraft, errors, setErrors, set };
}

function detailsOf(draft: Draft): Record<MemberDetailKey, string> {
  const { title: _title, ...details } = draft;
  return details;
}

/**
 * Edit details (board 61g), the one member editor of every Members page
 * (issue #584): the photo, the role title, contact, studies and personal
 * details, and for someone on the team the position part: for each place the
 * viewer may move them out of, where they go and what they are there (boards
 * 98a and 98b, issue #647; lead or member in the same division is the switch
 * it always was), and Leaving the team (board 46b: Remove from a division,
 * Move to alumni), each locked with its reason where the viewer may not. A
 * head's move asks on Save who heads the department they leave (board 98c).
 * Fill details, for someone waiting, holds the role in their division and the
 * details.
 */
export function EditDetailsDrawer({ target, onClose }: { target: EditTarget | null; onClose: () => void }) {
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);
  const t = target ?? shown;
  if (t === null) return null;
  return <EditForm key={t.kind === "person" ? `p${t.actions.person.id}` : `w${t.waiting.joinId}`} open={target !== null} target={t} onClose={onClose} />;
}

function EditForm({ open, target, onClose }: { open: boolean; target: EditTarget; onClose: () => void }) {
  const person = target.kind === "person" ? target.actions.person : null;
  const position = target.kind === "person" ? target.actions.position : null;
  const waiting = target.kind === "waiting" ? target.waiting : null;
  const name = person?.name ?? waiting?.name ?? waiting?.email ?? "";
  const email = person?.signInEmail ?? waiting?.email ?? "";
  const googleEmails = target.kind === "person" ? target.googleEmails : [];
  // Full access changes a member's sign-in email in one Save (issues #741, #864); the server sets the flag.
  const correctsEmail = target.kind === "person" ? target.actions.correctsSignInEmail : target.waiting.correctsSignInEmail;
  const title = position?.title ?? null;
  // The division whose role title the form sets: the waiting person's, or the person's titled one; none for a seat.
  const titleDivision =
    target.kind === "waiting"
      ? { id: target.division.id, short: divisionLabel(target.division.name) }
      : title?.kind === "division"
        ? { id: title.divisionId, short: title.short }
        : null;
  const startTitle = waiting?.title ?? (title?.kind === "division" || title?.kind === "seat" ? title.value : null);
  const openedDetails = person?.details ?? waiting?.details ?? NO_MEMBER_DETAILS;
  const { draft, errors, setErrors, set } = useDraft(draftOf(startTitle, openedDetails));
  // Where each place they hold goes, and what they are there (boards 98a, 98b); a seat is never one (issue #647).
  const places = position?.moves ?? [];
  const departments = useMoveTargets(places.length > 0 && person !== null ? person.id : null);
  const [choices, setChoices] = useState<Readonly<Record<string, MoveChoice>>>(() => Object.fromEntries(places.map((p) => [placeKey(p), choiceOf(p)])));
  const choiceFor = (place: MovablePlace) => choices[placeKey(place)] ?? choiceOf(place);
  // Every division row holds its own title, from its stored one (issue #911); the row of the division the form
  // opened titled in sends its title as the form's own, the others as `divisionTitles`.
  const [rowTitles, setRowTitles] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(places.flatMap((p) => (p.kind === "division" ? [[placeKey(p), p.title ?? ""] as const] : []))),
  );
  const [rowErrors, setRowErrors] = useState<Readonly<Record<string, string>>>({});
  const rowTitleOf = (place: MovablePlace) => rowTitles[placeKey(place)] ?? "";
  const setRowTitle = (place: MovablePlace, value: string) => {
    const key = placeKey(place);
    setRowTitles((t) => ({ ...t, [key]: value }));
    setRowErrors(({ [key]: _fixed, ...rest }) => rest);
  };
  const titledRow = title?.kind === "division" ? (places.find((p) => p.kind === "division" && p.divisionId === title.divisionId) ?? null) : null;
  // A seat's title stays the form's one, under the boxes of the department they head (issue #626).
  const seatPlace = title?.kind === "seat" ? (places.find((p) => p.kind === "head" && p.title === title.value) ?? null) : null;
  const titledPlace = titledRow ?? seatPlace;
  const titledMove = titledPlace === null ? null : moveToOf(titledPlace, choiceFor(titledPlace), departments);
  /** A new choice for `place`; a new unit empties that place's title, and back where they are shows its stored one (issue #777). */
  const choose = (place: MovablePlace, next: MoveChoice) => {
    const from = moveToOf(place, choiceFor(place), departments);
    const to = moveToOf(place, next, departments);
    if (place.kind === "division") {
      const nextTitle = titleOnMove({ current: rowTitleOf(place), stored: place.title, from, to });
      if (nextTitle !== rowTitleOf(place)) setRowTitle(place, nextTitle);
    } else if (place === seatPlace) {
      const nextTitle = titleOnMove({ current: draft.title, stored: startTitle, from, to });
      if (nextTitle !== draft.title) set("title", nextTitle);
    }
    setChoices((c) => ({ ...c, [placeKey(place)]: next }));
  };
  // Why the last Save was refused by the server, until the next Save starts (issue #911). A refusal closes the
  // head-move question, so the summary above Save is in view.
  const [refusal, setRefusalState] = useState<string | null>(null);
  const setRefusal = (message: string | null) => {
    setRefusalState(message);
    if (message !== null) setConfirming(false);
  };
  // Their first and last name, for someone on the team (issue #668); someone waiting keeps the name they were added with.
  const [names, setNames] = useState<PersonName | null>(position?.name ?? null);
  const [signInEmail, setSignInEmail] = useState(email);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  // What this form's last Save wrote, once one did: a retry then writes only what changed since, so a record
  // that Save moved onto another login keeps that login's own fields (issue #864).
  const [landed, setLanded] = useState<LandedSent | null>(null);

  const setName = (key: keyof PersonName, value: string) => {
    setNames((n) => (n === null ? n : { ...n, [key]: value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  // A head's move changes who heads their department, so Save asks first (board 98c).
  const headMove = places.flatMap((p) => {
    const to = p.kind === "head" ? moveToOf(p, choiceFor(p), departments) : null;
    return p.kind === "head" && to !== null ? [{ place: p, to }] : [];
  })[0];

  /**
   * The details as Save sends them, checked: a moved place's title goes with its move, so the details keep the
   * one it had; a division row that stays sends its title only when it changed (issue #911). `ok` false holds the
   * errors to show, each row title's under its row's key.
   */
  const checkedDetails = () => {
    // The sign-in email is sent only when corrected, so a save that leaves it as shown asks for no correction.
    const corrected = correctsEmail && signInEmail.trim().toLowerCase() !== email.toLowerCase();
    const staying = (p: MovablePlace) => moveToOf(p, choiceFor(p), departments) === null;
    const divisionTitles = places.flatMap((p) =>
      p.kind === "division" && p !== titledRow && staying(p) && rowTitleOf(p).trim() !== (p.title ?? "") ? [{ divisionId: p.divisionId, title: rowTitleOf(p) }] : [],
    );
    const input = {
      title: titledMove !== null ? (startTitle ?? "") : titledRow !== null ? rowTitleOf(titledRow) : draft.title,
      divisionTitles,
      details: detailsOf(draft),
      ...names,
      ...(corrected ? { signInEmail } : {}),
      ...(landed === null ? {} : { landed }),
    };
    const rowErrs: Record<string, string> = Object.fromEntries(
      places.flatMap((p) => {
        const error = p.kind === "division" ? roleTitleError(rowTitleOf(p)) : null;
        return error === null ? [] : [[placeKey(p), error] as const];
      }),
    );
    // The phone the form opened with saves as it is, whatever its format (issue #887).
    const checked = checkMemberEdit(input, openedDetails.phone, title?.kind === "seat" && titledMove === null ? "required" : "optional");
    if (checked.ok && Object.keys(rowErrs).length === 0) return { ok: true as const, input, value: checked.value };
    // A titled row's title is checked as its row's, so its error shows under that row and nowhere else.
    const { title: titleError, ...rest }: AddMemberErrors = checked.ok ? {} : checked.errors;
    return { ok: false as const, errors: titledRow === null ? { ...rest, title: titleError } : rest, rowErrors: rowErrs };
  };

  /** Shows why Save was refused: each field's error, the summary above Save, and the first field in error scrolled to and focused. */
  const refuse = (form: HTMLFormElement, refused: { errors: AddMemberErrors; rowErrors: Readonly<Record<string, string>> }) => {
    setErrors(refused.errors);
    setRowErrors(refused.rowErrors);
    const shown = fieldSummaryOf(summaryFields(refused.errors, refused.rowErrors));
    if (shown === null) setRefusal("Check the form and try again.");
    else if (shown.kind === "fields") focusField(form, shown.first);
  };

  const save = async (answer: HeadMoveAnswer | null) => {
    const checked = checkedDetails();
    // Field errors are caught on submit, before any Save starts.
    if (!checked.ok) return;
    const { input } = checked;
    setRefusal(null);
    setPending(true);
    try {
      const result = await saveMemberDetails(
        person ? { kind: "person", id: person.id } : { kind: "waiting", joinId: waiting!.joinId },
        titleDivision?.id ?? null,
        input,
      );
      if (!result.ok) {
        setRefusal(`Could not save the details. ${result.error}`);
        return;
      }
      setLanded({ details: checked.value.details, ...(checked.value.name ?? {}) });
      for (const place of person === null ? [] : places) {
        const choice = choiceFor(place);
        const to = moveToOf(place, choice, departments);
        if (to !== null) {
          // One move per place: each ends one placement and starts the new one in a single write.
          const moved = await moveMember({
            personId: person!.id,
            from: place.kind === "division" ? { kind: "division", divisionId: place.divisionId } : { kind: "head", departmentId: place.departmentId },
            to,
            // Each division row's own title goes with its move, and a seat's with its head place's; a new unit's
            // title is typed, never the old unit's (issues #777, #911).
            title: place.kind === "division" ? rowTitleOf(place) : place === seatPlace ? draft.title : "",
            replaced: place.kind === "head" ? (answer?.replaced ?? null) : null,
            replacing: place.kind === "head" ? (answer?.replacing ?? null) : null,
            successor: place.kind === "head" ? (answer?.successor ?? null) : null,
          });
          if (!moved.ok) {
            setRefusal(`Could not move them from ${place.kind === "division" ? place.short : place.department}. ${moved.error}`);
            return;
          }
        } else if (place.kind === "division" && choice.as !== place.role && choice.as !== "head") {
          // Lead or member in the same division: the switch it always was, checked on the server.
          const changed = await saveMember(person!.id, place.divisionId, choice.as === "lead" ? "division-lead" : "member");
          if (!changed.ok) {
            setRefusal(`Could not change who leads ${place.short}. ${changed.error}`);
            return;
          }
        }
      }
      toast.success(`Saved ${checked.value.name === null ? name : `${checked.value.name.firstName} ${checked.value.name.lastName}`}`);
      setConfirming(false);
      onClose();
    } catch (err) {
      setRefusal(`Could not save the details. ${err instanceof Error ? err.message : "Please try again."}`);
    } finally {
      setPending(false);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRefusal(null);
    const checked = checkedDetails();
    if (!checked.ok) return refuse(e.currentTarget, checked);
    if (headMove !== undefined) return setConfirming(true);
    void save(null);
  };

  /** The label of a place's title field: its division's, or where its move takes it (issue #777). */
  const titleLabelOf = (place: MovablePlace): string => {
    const choice = choiceFor(place);
    const to = moveToOf(place, choice, departments);
    if (to === null) return place.kind === "division" ? `Role in ${place.short}` : "Role";
    return to.kind === "division" ? `Role in ${unitShort(departments, choice.unit) ?? ""}` : "Role";
  };
  /** The form's own title field, when no place carries it: the waiting person's division, a seat, or a division they cannot be moved out of. */
  const ownTitleShown = titledPlace === null && (titleDivision !== null || title?.kind === "seat");
  const ownTitleLabel = titleDivision !== null ? `Role in ${titleDivision.short}` : "Role";
  const rowFieldName = (place: MovablePlace) => `title-${placeKey(place)}`;

  /** Every field the error summary may name, in the order the form shows them, with its error. */
  const summaryFields = (errs: AddMemberErrors, rowErrs: Readonly<Record<string, string>>): SummaryField[] => [
    ...(names === null
      ? []
      : [
          { name: "firstName", label: "First name", error: errs.firstName },
          { name: "lastName", label: "Last name", error: errs.lastName },
        ]),
    ...(ownTitleShown ? [{ name: "title", label: ownTitleLabel, error: errs.title }] : []),
    ...places.flatMap((p) =>
      p.kind === "division"
        ? [{ name: rowFieldName(p), label: titleLabelOf(p), error: rowErrs[placeKey(p)] }]
        : p === seatPlace
          ? [{ name: "title", label: titleLabelOf(p), error: errs.title }]
          : [],
    ),
    ...CONTACT_DETAILS.flatMap((key) => [
      { name: key, label: DETAIL_LABEL[key], error: errs[key] },
      ...(key === "prtEmail" && correctsEmail ? [{ name: "signInEmail", label: "Personal email", error: errs.signInEmail }] : []),
    ]),
    ...OTHER_DETAILS.map((key) => ({ name: key, label: DETAIL_LABEL[key], error: errs[key] })),
  ];
  // The summary above Save: the fields still in error, or the server's refusal (issue #911).
  const summary: FormSummary | null = refusal !== null ? { kind: "refusal", message: refusal } : fieldSummaryOf(summaryFields(errors, rowErrors));

  /** The boxes of one place, its title field (every division row's, and a seat's head place's), the hint and the no-head note. */
  const placeFields = (place: MovablePlace) => {
    const choice = choiceFor(place);
    const to = moveToOf(place, choice, departments);
    // Every division they are in, the ones this viewer does not reach included: none is a place to move into.
    const taken = (person?.divisions ?? []).map((d) => d.divisionId).filter((id) => place.kind !== "division" || id !== place.divisionId);
    return (
      <div key={placeKey(place)}>
        <MoveFields
          place={place}
          departments={departments}
          value={choice}
          taken={taken}
          onChange={(next) => choose(place, next)}
        />
        {place.kind === "division" ? (
          <div className="mt-4">
            <TitleInput
              name={rowFieldName(place)}
              label={titleLabelOf(place)}
              value={rowTitleOf(place)}
              error={rowErrors[placeKey(place)]}
              required={false}
              onChange={(value) => setRowTitle(place, value)}
            />
          </div>
        ) : (
          place === seatPlace && <div className="mt-4">{titleField(titleLabelOf(place), to === null)}</div>
        )}
        <MoveHint place={place} moving={to !== null} />
        {place.kind === "head" && to !== null && person !== null && headsAfterMove(departments, place.departmentId, person.id).kind === "none" && (
          <NoHeadNote department={place.department} />
        )}
      </div>
    );
  };

  /** The form's own role title field: "Role in <division>", or a seat's "Role" (issue #626). */
  const titleField = (label: string, required: boolean) => (
    <TitleInput name="title" label={label} value={draft.title} error={errors.title} required={required} onChange={(value) => set("title", value)} />
  );

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={name}
        detail={person ? "Edit details" : "Fill details"}
        leading={person ? <Avatar size="panel" person={person} /> : undefined}
        submitLabel="Save"
        submitting={pending}
        onSubmit={submit}
        summary={summary}
      >
        {person && (
          <Section title="Photo">
            <PhotoField person={person} />
          </Section>
        )}

        {names !== null && (
          <Section title="Name">
            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName}>
                {(id, describedBy) => (
                  <input
                    id={id}
                    name="firstName"
                    value={names.firstName}
                    maxLength={MAX_NAME}
                    autoComplete="off"
                    aria-required
                    aria-describedby={describedBy}
                    aria-invalid={errors.firstName !== undefined}
                    onChange={(e) => setName("firstName", e.target.value)}
                    className={inputClass(errors.firstName)}
                  />
                )}
              </Field>
              <Field label="Last name" error={errors.lastName}>
                {(id, describedBy) => (
                  <input
                    id={id}
                    name="lastName"
                    value={names.lastName}
                    maxLength={MAX_NAME}
                    autoComplete="off"
                    aria-required
                    aria-describedby={describedBy}
                    aria-invalid={errors.lastName !== undefined}
                    onChange={(e) => setName("lastName", e.target.value)}
                    className={inputClass(errors.lastName)}
                  />
                )}
              </Field>
            </div>
          </Section>
        )}

        <Section title="Role">
          {titledPlace === null &&
            (titleDivision !== null || title?.kind === "seat"
              ? // A division's title, or a seat's: the head's, the team leader's or a team-level seat's (issue #626).
                titleField(ownTitleLabel, titleDivision === null)
              : title?.kind === "fixed" && (
                  <Field label="Role" hint="set on the Team tree">
                    {(id) => (
                      <span id={id} className={LOCKED_INPUT}>
                        <span className="min-w-0 flex-1 truncate">{title.label}</span>
                        <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      </span>
                    )}
                  </Field>
                ))}
          {places.length > 0 && (
            // One set of boxes per place they hold: a division, or the department they head (boards 98a, 98b).
            <div className={`flex flex-col gap-6 ${titledPlace === null && title !== null ? "mt-4" : ""}`}>
              {places.map(placeFields)}
            </div>
          )}
        </Section>

        <Section title="Contact">
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <DetailInput name="prtEmail" draft={draft} errors={errors} set={set} />
            <Field label="Personal email" hint="sign-in email" error={correctsEmail ? errors.signInEmail : undefined}>
              {(id, describedBy) =>
                correctsEmail ? (
                  <input
                    id={id}
                    name="signInEmail"
                    type="email"
                    value={signInEmail}
                    maxLength={200}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    aria-invalid={errors.signInEmail !== undefined}
                    onChange={(e) => {
                      setSignInEmail(e.target.value);
                      setErrors((errs) => ({ ...errs, signInEmail: undefined }));
                    }}
                    className={inputClass(errors.signInEmail)}
                  />
                ) : (
                  <span id={id} className={LOCKED_INPUT}>
                    <span className="min-w-0 flex-1 truncate">{email}</span>
                    <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  </span>
                )
              }
            </Field>
            <GoogleEmailsField emails={googleEmails} />
            <DetailInput name="phone" draft={draft} errors={errors} set={set} />
            <DetailInput name="discord" draft={draft} errors={errors} set={set} />
            <DetailInput name="linkedin" draft={draft} errors={errors} set={set} className="sm:col-span-2" />
          </div>
        </Section>

        <Section title="Studies">
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <DetailInput name="politoId" draft={draft} errors={errors} set={set} />
            <DetailInput name="programme" draft={draft} errors={errors} set={set} />
            <DetailInput name="level" draft={draft} errors={errors} set={set} />
            <DetailInput name="country" draft={draft} errors={errors} set={set} />
          </div>
        </Section>

        <Section title="Personal">
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <DetailInput name="birthDate" draft={draft} errors={errors} set={set} />
            <DetailInput name="gender" draft={draft} errors={errors} set={set} />
          </div>
        </Section>

        {person && position && <LeavingSection person={person} position={position} onAsk={setAsking} />}
      </Drawer>
      <MemberDialogs asking={asking} onClose={() => setAsking(null)} onDone={onClose} />
      {headMove !== undefined && headMove.place.kind === "head" && person !== null && (
        <HeadMoveConfirm
          open={confirming}
          onOpenChange={setConfirming}
          person={name}
          personId={person.id}
          from={{ id: headMove.place.departmentId, name: headMove.place.department }}
          to={headMove.to}
          departments={departments}
          pending={pending}
          onConfirm={(answer) => void save(answer)}
        />
      )}
    </>
  );
}

const LEAVING_BUTTON = `inline-flex h-9 items-center gap-2 rounded-full border border-danger/60 px-4 text-[13px] font-semibold text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-danger/60 disabled:hover:bg-transparent ${FOCUS}`;

/**
 * Leaving the team (board 46b), the end of Edit details: Remove from each of
 * the person's divisions the viewer reaches, where `removalFrom` offers it,
 * then Move to alumni. Each opens the row ⋯ menu's own "are you sure"; an
 * action the viewer may not take is locked with the reason the menu gives.
 */
function LeavingSection({ person, position, onAsk }: { person: EditPerson; position: MemberPosition; onAsk: (asking: Asking) => void }) {
  const firstName = person.name.split(" ")[0];
  const removals = position.removals.filter((r) => r.removal.kind === "offered" || r.removal.kind === "locked");
  return (
    <section className="mt-8 rounded-xl border border-danger/40 bg-danger/[0.06] p-4">
      <h3 className="text-[14px] font-semibold text-prt-text">Leaving the team</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-prt-muted">
        {removals.length > 0 && `Remove from a division ends only that role; ${firstName} keeps the others. `}
        Move to alumni moves {firstName} to Alumni with the years on the team. The account stays; dashboard access ends.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {removals.map((r) => (
          <button
            key={r.divisionId}
            type="button"
            disabled={r.removal.kind === "locked"}
            title={r.removal.kind === "locked" ? r.removal.reason : undefined}
            onClick={() => onAsk({ kind: "remove", person, divisionId: r.divisionId, short: r.short })}
            className={LEAVING_BUTTON}
          >
            {r.removal.kind === "locked" ? <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> : <UserMinus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            Remove from {r.short}
          </button>
        ))}
        <button
          type="button"
          disabled={!position.leave.allowed}
          title={position.leave.allowed ? undefined : position.leave.reason}
          onClick={() => onAsk({ kind: "leave", person })}
          className={LEAVING_BUTTON}
        >
          {!position.leave.allowed && <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
          Move to alumni
        </button>
      </div>
      {[...removals.flatMap((r) => (r.removal.kind === "locked" ? [r.removal.reason] : [])), ...(position.leave.allowed ? [] : [position.leave.reason])]
        .filter((reason, i, all) => all.indexOf(reason) === i)
        .map((reason) => (
          <p key={reason} className="mt-2.5 flex items-start gap-2 text-[12px] leading-snug text-prt-muted">
            <Lock aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
            {reason}
          </p>
        ))}
    </section>
  );
}

/** The photo row of Edit details: Upload photo opens the square crop; the saved photo is a JPEG under 500 KB. */
function PhotoField({ person }: { person: Pick<EditPerson, "id" | "photoUrl"> }) {
  const [cropping, setCropping] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(person.photoUrl);
  const input = useRef<HTMLInputElement>(null);

  const save = async (square: File) => {
    const error = checkMemberPhoto(square);
    if (error !== null) {
      toast.error("Could not use that photo", { description: error });
      return;
    }
    setPending(true);
    try {
      const form = new FormData();
      form.set("photo", square);
      const result = await setMemberPhoto(person.id, form);
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return;
      }
      setPreview(URL.createObjectURL(square));
      setCropping(null);
      toast.success("Photo updated");
    } catch (err) {
      toast.error("Could not upload the photo", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar size="panel" person={{ photoUrl: preview }} />
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) setCropping(file);
        }}
      />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className={GHOST_PILL}>
        <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Upload photo
      </button>
      <span className="text-[13px] text-prt-muted">
        Square JPEG, under <span className="whitespace-nowrap">500 KB</span>
      </span>
      <PhotoCropDialog
        file={cropping}
        onOpenChange={(next) => !next && setCropping(null)}
        onChooseAnother={() => input.current?.click()}
        onSave={save}
        pending={pending}
      />
    </div>
  );
}

const EMPTY_DRAFT: Draft = { ...NO_MEMBER_DETAILS, title: "" };

/** Where Add member adds to: one division (a lead's page), or a choice of the department's divisions (a head's, board 69c). */
export type AddTarget =
  | { readonly kind: "division"; readonly division: DivisionHeader }
  | {
      readonly kind: "department";
      /** "Aerodynamics" */
      readonly department: string;
      readonly divisions: readonly DivisionHeader[];
      /** The division the select starts on: the open tab's, else the first. */
      readonly start: number;
    };

/**
 * Add member (boards 61h, 61h2 and 69c): type an email or search the team by
 * name. Someone on the team joins at once and keeps their other divisions; an
 * email new to the team shows the amber "isn't on the team yet" line and waits
 * for Confirm NDA. "Fill in their other details now" opens the rest of the
 * form. The site sends no emails, so the drawer says to tell them. A head
 * picks the division first, from their department's divisions only.
 */
export function AddMemberDrawer({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: AddTarget }) {
  const [round, setRound] = useState(0);
  const start = target.kind === "division" ? target.division.id : target.start;
  return (
    <AddForm
      // A new round, or a new starting division, starts a fresh form.
      key={`${round}-${start}`}
      open={open}
      target={target}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setRound((r) => r + 1);
      }}
    />
  );
}

/** The Division select at the top of a head's Add member (board 69c): a code chip and the name, the department's divisions only. */
function DivisionSelect({
  id,
  divisions,
  value,
  onChange,
}: {
  id: string;
  divisions: readonly DivisionHeader[];
  value: DivisionHeader;
  onChange: (divisionId: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger id={id} className={`${inputClass()} flex items-center gap-2.5 text-left data-[state=open]:border-accent ${FOCUS}`}>
        <DivisionName division={value} />
        <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup value={String(value.id)} onValueChange={(next) => onChange(Number(next))}>
            {divisions.map((d) => (
              <DropdownMenuPrimitive.RadioItem
                key={d.id}
                value={String(d.id)}
                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none transition-colors data-[highlighted]:bg-white-5"
              >
                <DivisionName division={d} />
                <DropdownMenuPrimitive.ItemIndicator className="ml-auto">
                  <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                </DropdownMenuPrimitive.ItemIndicator>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function DivisionName({ division }: { division: DivisionHeader }) {
  return (
    <>
      {division.code !== null && <Chips chips={[{ divisionId: division.id, label: division.code, code: true }]} />}
      <span className="min-w-0 truncate text-[14px] text-prt-text">{divisionLabel(division.name)}</span>
    </>
  );
}

function AddForm({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: AddTarget }) {
  const choices = target.kind === "department" ? target.divisions : [target.division];
  const [divisionId, setDivisionId] = useState(target.kind === "division" ? target.division.id : target.start);
  const division = choices.find((d) => d.id === divisionId) ?? choices[0];
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<AddLookup>({ kind: "none" });
  const [picked, setPicked] = useState<TeamMatch | null>(null);
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const [fillNow, setFillNow] = useState(false);
  const { draft, errors, setErrors, set } = useDraft(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const asked = useRef(0);
  const short = divisionLabel(division.name);

  useEffect(() => {
    if (picked !== null) return;
    const ask = ++asked.current;
    const timer = setTimeout(async () => {
      const answer = await findForAdd(division.id, query);
      if (ask === asked.current) setLookup(answer);
      // An empty field asks at once: the team is listed as the field opens (issue #618).
    }, query === "" ? 0 : 250);
    return () => clearTimeout(timer);
  }, [query, picked, division.id]);

  const isNew = picked === null && lookup.kind === "new-email";
  const found = lookup.kind === "people" ? lookup.people : [];

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = picked
      ? { kind: "member", divisionId: division.id, personId: picked.id, title: draft.title }
      : {
          kind: "email",
          divisionId: division.id,
          email: query,
          firstName: names.firstName,
          lastName: names.lastName,
          title: draft.title,
          details: fillNow ? detailsOf(draft) : null,
        };
    const checked = checkAddMember(input);
    if (!checked.ok) return setErrors(checked.errors);
    if (!picked && !isNew) {
      return setErrors({ email: lookup.kind === "waiting" ? "They are already waiting for their NDA here." : "Pick someone from the team, or write a new email." });
    }
    setPending(true);
    try {
      const result = await addMember(input);
      if (!result.ok) {
        toast.error("Could not add them", { description: result.error });
        return;
      }
      toast.success(
        result.value === "joined"
          ? `${picked?.name ?? query} joined ${short}`
          : `${query} was added and is waiting for their signed NDA. The site sends no emails, so message them to sign in with Google. They join when you confirm the NDA.`,
      );
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add member"
      detail={target.kind === "department" ? `To a division in ${target.department}` : `To ${division.name}`}
      submitLabel="Add member"
      submitting={pending}
      onSubmit={submit}
    >
      {target.kind === "department" && (
        <div className="mb-5">
          <Field label="Division" hint={`${choices.length} in ${target.department}`}>
            {(id) => (
              <DivisionSelect
                id={id}
                divisions={choices}
                value={division}
                onChange={(next) => {
                  setDivisionId(next);
                  // Who is already here, or waiting here, depends on the division.
                  setPicked(null);
                  setLookup({ kind: "none" });
                }}
              />
            )}
          </Field>
          <p className="mt-2 text-[12px] text-prt-muted">Already in other divisions? They keep them.</p>
        </div>
      )}
      <Field label="Email" hint="or search the team by name" error={errors.email}>
        {(id, describedBy) =>
          picked ? (
            <span className="flex items-center gap-3 rounded-[10px] border border-accent bg-accent/[0.06] px-3.5 py-2.5">
              <Avatar size="sm" person={picked} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-prt-text">{picked.name}</span>
                <span className="block truncate text-[12px] text-prt-muted">{picked.email}</span>
              </span>
              <Chips chips={picked.chips} />
              <IconButton label="Choose someone else" onClick={() => setPicked(null)}>
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </span>
          ) : (
            <PersonCombobox
              id={id}
              people={found.map((m) => ({ id: m.id, name: m.name, photoUrl: m.photoUrl, line: m.email, taken: m.here ? `Already in ${short}` : null, trail: <Chips chips={m.chips} /> }))}
              value={null}
              onChoose={(personId) => setPicked(found.find((m) => m.id === personId) ?? null)}
              placeholder="Email or name"
              search={{
                text: query,
                onText: (text) => {
                  setQuery(text);
                  setErrors((x) => ({ ...x, email: undefined }));
                },
              }}
              heading="On the team"
              describedBy={describedBy}
              invalid={errors.email !== undefined}
            />
          )
        }
      </Field>
      {picked === null && <p className="mt-2 text-[12px] text-prt-muted">{GOOGLE_EMAIL_NOTE}</p>}
      {picked !== null && target.kind === "division" &&<p className="mt-2 text-[12px] text-prt-muted">Already in other divisions? They keep them.</p>}
      {picked === null && lookup.kind === "waiting" && (
        <p className="mt-2 flex items-start gap-2 text-[13px] text-warning">
          <UserPlus aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Already waiting for their NDA here.
        </p>
      )}
      {isNew && (
        <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-warning">
          <UserPlus aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>
            {query.trim()} isn&apos;t on the team yet. After you add them, they wait for their signed NDA and join when you confirm it.
            {fillNow && " The site doesn't send emails, so they won't know you added them. Message them to sign in with Google using this address."}
          </span>
        </p>
      )}

      {isNew && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName}>
            {(id) => (
              <input id={id} value={names.firstName} autoComplete="off" onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))} className={inputClass(errors.firstName)} />
            )}
          </Field>
          <Field label="Last name" error={errors.lastName}>
            {(id) => (
              <input id={id} value={names.lastName} autoComplete="off" onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))} className={inputClass(errors.lastName)} />
            )}
          </Field>
        </div>
      )}

      {(isNew || picked !== null) && (
        <div className="mt-5">
          <Field label={`Role in ${short}`} hint="shown on the Team page" error={errors.title}>
            {(id) => <input id={id} value={draft.title} maxLength={80} onChange={(e) => set("title", e.target.value)} className={inputClass(errors.title)} />}
          </Field>
        </div>
      )}

      {isNew && (
        <div className="mt-5 rounded-xl border border-hairline p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <Toggle checked={fillNow} onCheckedChange={setFillNow} label="Fill in their other details now" />
            <span className="text-[14px] font-medium text-prt-text">Fill in their other details now</span>
          </label>
          {fillNow ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                <DetailInput name="prtEmail" draft={draft} errors={errors} set={set} />
                <DetailInput name="linkedin" draft={draft} errors={errors} set={set} />
                <DetailInput name="phone" draft={draft} errors={errors} set={set} />
                <DetailInput name="discord" draft={draft} errors={errors} set={set} />
                <DetailInput name="politoId" draft={draft} errors={errors} set={set} />
                <DetailInput name="programme" draft={draft} errors={errors} set={set} />
                <DetailInput name="level" draft={draft} errors={errors} set={set} />
                <DetailInput name="country" draft={draft} errors={errors} set={set} />
                <DetailInput name="birthDate" draft={draft} errors={errors} set={set} />
                <DetailInput name="gender" draft={draft} errors={errors} set={set} />
              </div>
              <p className="mt-4 text-[12px] text-prt-muted">Everything here is optional. Empty fields can be filled later by you or by them.</p>
            </>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-prt-muted">
              Phone, Discord, studies and personal details. Leave this off and they can sign in with this email and fill them in themselves, or you
              can add them later.
            </p>
          )}
        </div>
      )}

      {isNew && !fillNow && (
        <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.05] px-4 py-3 text-[13px] text-text-2">
          <Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          The site doesn&apos;t send emails, so they won&apos;t know you added them. Message them to sign in with Google using this address. Until they
          sign in or their details are filled in, a box under Members reminds you.
        </p>
      )}
    </Drawer>
  );
}
