import { stagePill, STAGE_LABELS, stageTone, type ApplicationStage, type ApplicationState, type PillTone } from "@/lib/dashboard/application-flow";

// The stage pill of an application (boards 58b, 58i, 58m): a -soft fill under
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
export function StagePill({ state, short = false }: { state: ApplicationState; short?: boolean }) {
  const pill = stagePill(state);
  return <span className={`${PILL} ${TONE[pill.tone]}`}>{short ? pill.short : pill.label}</span>;
}

/** The plain stage, as the Other applications rows show it (board 58). */
export function StageTag({ stage }: { stage: ApplicationStage }) {
  return <span className={`${PILL} ${TONE[stageTone(stage)]}`}>{STAGE_LABELS[stage]}</span>;
}

/** The fill a tone gives a whole button, as the stage menu trigger in the panel uses it (58d, 58g). */
export function toneSurface(tone: PillTone): string {
  switch (tone) {
    case "accent":
      return "border-accent/40 bg-accent-soft text-accent";
    case "success":
      return "border-success/40 bg-success-soft text-success";
    case "info":
      return "border-info/40 bg-info-soft text-info";
    case "neutral":
    case "muted":
      return "border-hairline text-prt-text";
  }
}

/** The dot beside the stage in the panel's stage menu. */
export function toneDot(tone: PillTone): string {
  switch (tone) {
    case "accent":
      return "bg-accent";
    case "success":
      return "bg-success";
    case "info":
      return "bg-info";
    case "neutral":
      return "bg-accent";
    case "muted":
      return "bg-dim";
  }
}
