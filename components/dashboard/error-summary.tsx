"use client";

import { CircleAlert } from "lucide-react";
import { summaryLine, type FormSummary } from "@/lib/dashboard/error-summary";

/**
 * Why Save was refused, right above a form drawer's Save and Cancel buttons
 * (issue #911): the fields in error by label, or the server's refusal. The
 * `Drawer` draws it only for a form that passes one.
 */
export function ErrorSummary({ summary }: { summary: FormSummary }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[10px] border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-snug text-prt-text">
      <CircleAlert aria-hidden className="mt-px h-4 w-4 shrink-0 text-danger" strokeWidth={1.75} />
      <p className="min-w-0">{summaryLine(summary)}</p>
    </div>
  );
}

/**
 * The controls in `form` named `name` that a refused Save can focus: each
 * enabled control, with a radio group counted once, at its first enabled
 * radio. A form that names a field in its summary renders exactly one
 * (issue #927).
 */
export function focusTargets(form: HTMLFormElement, name: string): HTMLElement[] {
  const targets: HTMLElement[] = [];
  let radioGroup = false;
  for (const el of form.elements) {
    if (!(el instanceof HTMLElement) || el.getAttribute("name") !== name) continue;
    if ("disabled" in el && el.disabled === true) continue;
    const radio = el instanceof HTMLInputElement && el.type === "radio";
    if (radio && radioGroup) continue;
    radioGroup ||= radio;
    targets.push(el);
  }
  return targets;
}

/**
 * Brings the control named `name` in `form` into view and focuses it: the
 * first field in error once Save is refused.
 */
export function focusField(form: HTMLFormElement, name: string): void {
  const [control] = focusTargets(form, name);
  if (control === undefined) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  control.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  control.focus({ preventScroll: true });
}
