import { statusPill, statusTone, STATUS_NAMES, type ApplicationState, type PillTone } from "@/lib/dashboard/application-flow";
import type { BuiltInStatusKey } from "@/lib/dashboard/application-status";

// The status pill of an application (boards 58b, 58i, 58m): a -soft fill under
// the solid text, as the manifest pairs tags. The words and the tone are the
// flow's (lib/dashboard/application-flow.ts); this only paints them.

const TONE: Readonly<Record<PillTone, string>> = {
  neutral: "bg-white-10 text-prt-text",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  muted: "bg-white-5 text-prt-muted",
};

const PILL = "inline-flex h-[22px] max-w-full shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium";

/** The pill for where an application stands; `short` is the phone wording (58m). */
export function StatusPill({ state, short = false }: { state: ApplicationState; short?: boolean }) {
  const pill = statusPill(state);
  return <span className={`${PILL} ${TONE[pill.tone]}`}>{short ? pill.short : pill.label}</span>;
}

/** The plain status, as the Other applications rows show it (board 58). */
export function StatusTag({ status }: { status: BuiltInStatusKey }) {
  return <span className={`${PILL} ${TONE[statusTone(status)]}`}>{STATUS_NAMES[status]}</span>;
}
