import { statusPill, type ApplicationState } from "@/lib/dashboard/application-flow";
import type { ListedStatus } from "@/lib/dashboard/application-status";

// The status pill of an application (boards 58b, 58i, 58m, 97): its status's
// name and colour as the status list stores them, so renaming or recolouring
// a status in the Statuses editor changes every pill of it (issue #752). The
// colour is data the editor sets, as the Status picker's dots are
// (design-system-manifest.md): a -soft fill of it and a dot in it, under
// paper text that stays legible whatever colour is picked. The words are the
// flow's (lib/dashboard/application-flow.ts); this only paints them.

const PILL = "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium text-prt-text";

function Pill({ colour, children }: { colour: string; children: string }) {
  return (
    <span className={PILL} style={{ backgroundColor: `color-mix(in srgb, ${colour} 16%, transparent)` }}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** The pill for where an application stands; `short` is the phone wording (58m). */
export function StatusPill({ state, listed, short = false }: { state: ApplicationState; listed: ListedStatus; short?: boolean }) {
  const words = statusPill(state, listed.name);
  return <Pill colour={listed.colour}>{short ? words.short : words.label}</Pill>;
}

/** The plain status, as the Other applications rows show it (board 58). */
export function StatusTag({ listed }: { listed: ListedStatus }) {
  return <Pill colour={listed.colour}>{listed.name}</Pill>;
}
