"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ExternalLink, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setApplicationStage } from "@/app/dashboard/recruitment-actions";
import {
  APPLICATION_STAGES,
  nextStage,
  STAGE_LABELS,
  stageCounts,
  type ApplicationEntry,
  type ApplicationsPage,
  type ApplicationStage,
  type PositionRef,
} from "@/lib/dashboard/recruitment";
import { Avatar } from "./avatar";
import { FilterMenu, Segmented } from "./controls";
import { PANEL } from "./panel";

// The Applications page (board 41b): the stage tabs, the position filter, the
// list, and the detail panel of the chosen application. Props in, nothing
// fetched; a stage change writes through the dashboard's server action and
// shows at once.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STAGE_DOT: Readonly<Record<ApplicationStage, string>> = {
  new: "bg-accent",
  "in-review": "bg-warning",
  accepted: "bg-success",
  rejected: "bg-dim",
};

const COLUMNS = "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_110px]";

export function ApplicationsView({
  page,
  initialPosition,
}: {
  page: ApplicationsPage;
  initialPosition: PositionRef | null;
}) {
  const [stages, setStage] = useOptimistic(
    Object.fromEntries(page.applications.map((a) => [a.id, a.stage])) as Record<number, ApplicationStage>,
    (current, change: { id: number; stage: ApplicationStage }) => ({ ...current, [change.id]: change.stage }),
  );
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<ApplicationStage>("new");
  const [position, setPosition] = useState<PositionRef | null>(initialPosition);
  const [chosenId, setChosenId] = useState<number | null>(null);

  const applications = page.applications.map((a) => ({ ...a, stage: stages[a.id] ?? a.stage }));
  const inPosition = applications.filter((a) => position === null || a.position.ref === position);
  const counts = stageCounts(inPosition);
  const rows = inPosition.filter((a) => a.stage === tab);
  const chosen = applications.find((a) => a.id === chosenId) ?? null;

  const move = (id: number, stage: ApplicationStage) =>
    startTransition(async () => {
      setStage({ id, stage });
      const result = await setApplicationStage(id, stage);
      if (!result.ok) toast.error(result.message);
    });

  return (
    <div className={chosen ? "xl:mr-[420px]" : ""}>
      <header>
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">Applications</h1>
        <p className="mt-1 text-[14px] text-prt-muted">Applications for the positions you lead.</p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented
          label="Show applications"
          value={tab}
          onChange={setTab}
          options={APPLICATION_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage], count: counts[stage] }))}
        />
        <FilterMenu
          allLabel="All positions"
          value={position}
          onChange={setPosition}
          options={page.positions.map((p) => ({ value: p.ref, label: p.title }))}
        />
      </div>

      <div className={`${PANEL} mt-4 overflow-hidden`}>
        <div
          aria-hidden="true"
          className={`hidden h-10 items-center gap-4 border-b border-hairline bg-white-5 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim lg:grid ${COLUMNS}`}
        >
          <span>Applicant</span>
          <span>Position</span>
          <span>Applied</span>
        </div>
        <ul className="divide-y divide-hairline">
          {rows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setChosenId(a.id)}
                aria-current={a.id === chosenId ? "true" : undefined}
                className={`grid w-full grid-cols-1 items-center gap-1 px-4 py-2.5 text-left transition-colors duration-300 ease-out lg:gap-4 lg:px-5 ${COLUMNS} ${
                  a.id === chosenId ? "bg-accent/10" : "hover:bg-white-5"
                } focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.applicant.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium leading-snug">{a.applicant.name}</span>
                    <span className="block truncate text-[12px] leading-snug text-prt-muted">{a.applicant.email}</span>
                    <span className="block truncate text-[12px] text-prt-muted lg:hidden">
                      {a.position.title} · {a.applied.day}
                    </span>
                  </span>
                </span>
                <span className="hidden truncate text-[13px] text-text-2 lg:block">{a.position.title}</span>
                <span className="hidden text-[13px] text-prt-muted lg:block">{a.applied.day}</span>
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="px-5 py-6 text-[13px] text-prt-muted">No {STAGE_LABELS[tab].toLowerCase()} applications.</p>
        )}
      </div>

      <DetailPanel application={chosen} onClose={() => setChosenId(null)} onMove={move} />
    </div>
  );
}

// The panel on the right (board 41b); full screen on a phone. It is the repo's
// Radix dialog, not modal: the list stays usable beside it, so choosing another
// row swaps what it shows. Escape and the close button close it. It fades in
// only under motion-safe and closes at once (design-system-manifest.md).
function DetailPanel({
  application,
  onClose,
  onMove,
}: {
  application: ApplicationEntry | null;
  onClose: () => void;
  onMove: (id: number, stage: ApplicationStage) => void;
}) {
  return (
    <Dialog open={application !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogPortal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed inset-0 z-40 flex flex-col bg-ground text-prt-text focus:outline-none md:left-auto md:w-[460px] md:border-l md:border-hairline motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:duration-200"
        >
          {application && <Detail application={application} onMove={onMove} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function Detail({
  application: a,
  onMove,
}: {
  application: ApplicationEntry;
  onMove: (id: number, stage: ApplicationStage) => void;
}) {
  const next = nextStage(a.stage);
  const contact = rows([
    ["Email", a.applicant.email],
    ["Phone", a.applicant.phone],
    ["PoliTo ID", a.applicant.politoId],
  ]);
  const studies = rows([
    ["Year", a.studies.year],
    ["Degree", a.studies.degree],
  ]);
  return (
    <>
      <div className="border-b border-hairline px-5 pb-5 pt-6 md:px-7 md:pt-7">
        <div className="flex items-start gap-4">
          <Avatar name={a.applicant.name} size="panel" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-[20px] font-bold leading-tight">{a.applicant.name}</DialogTitle>
            <p className="mt-1 text-[13px] text-prt-muted">
              {a.position.title} · applied {a.applied.at}
            </p>
          </div>
          <DialogClose
            aria-label="Close"
            className={`-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </DialogClose>
        </div>
        <StageMenu stage={a.stage} onChange={(stage) => onMove(a.id, stage)} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7">
        {contact.length > 0 && <Fields title="Contact" fields={contact} />}
        {studies.length > 0 && <Fields title="Studies" fields={studies} />}
        {a.documents.length > 0 && (
          <Section title="Documents">
            <ul className="flex flex-col gap-2.5">
              {a.documents.map((d) => (
                <li key={d.kind}>
                  <DocumentCard name={d.name} detail={[d.kind === "cv" ? "CV" : "Motivation letter", d.size].filter(Boolean).join(" · ")} href={d.href} />
                </li>
              ))}
            </ul>
          </Section>
        )}
        {a.answers.length > 0 && (
          <Section title="Questions for this role">
            {a.answers.map((qa) => (
              <div key={qa.question} className="mb-4 last:mb-0">
                <p className="text-[13px] text-prt-muted">{qa.question}</p>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{qa.answer}</p>
              </div>
            ))}
          </Section>
        )}
      </div>

      {next && (
        <div className="grid grid-cols-2 gap-3 border-t border-hairline px-5 py-4 md:px-7">
          <button
            type="button"
            onClick={() => onMove(a.id, "rejected")}
            className={`h-11 rounded-full border border-white-10 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onMove(a.id, next.to)}
            className={`h-11 rounded-full bg-prt-text text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 ${FOCUS}`}
          >
            {next.label}
          </button>
        </div>
      )}
    </>
  );
}

function rows(fields: readonly (readonly [string, string | null])[]): [string, string][] {
  return fields.flatMap(([label, value]) => (value ? [[label, value] as [string, string]] : []));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ title, fields }: { title: string; fields: readonly [string, string][] }) {
  return (
    <Section title={title}>
      <dl className="flex flex-col gap-1.5">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-[13px]">
            <dt className="shrink-0 text-prt-muted">{label}</dt>
            <dd className="min-w-0 break-words text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function DocumentCard({ name, detail, href }: { name: string; detail: string; href: string | null }) {
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
        <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{name}</span>
        <span className="block text-[12px] text-prt-muted">{detail}</span>
      </span>
      {href && <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />}
    </>
  );
  const box = "flex items-center gap-3 rounded-lg border border-hairline px-3 py-2.5";
  if (!href) return <div className={box}>{body}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${box} transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
    >
      {body}
    </a>
  );
}

function StageMenu({ stage, onChange }: { stage: ApplicationStage; onChange: (stage: ApplicationStage) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Stage: ${STAGE_LABELS[stage]}. Change stage`}
        className={`mt-4 flex h-9 w-full items-center gap-2 rounded-lg border border-hairline px-3 text-[13px] font-medium transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong ${FOCUS}`}
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STAGE_DOT[stage]}`} />
        {STAGE_LABELS[stage]}
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup value={stage} onValueChange={(v) => onChange(v as ApplicationStage)}>
            {APPLICATION_STAGES.map((s) => (
              <DropdownMenuPrimitive.RadioItem
                key={s}
                value={s}
                className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text"
              >
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STAGE_DOT[s]}`} />
                <span className="flex-1">{STAGE_LABELS[s]}</span>
                <DropdownMenuPrimitive.ItemIndicator>
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
