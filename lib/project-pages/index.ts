// How the project page template (components/project-page/) reads a page
// record: its blocks laid out in rows and numbered, and the lists in order.
// The records themselves are read off the projects' stored records
// (lib/project-content/record.ts, issue #295).

import type { PageBlock, Plan, PlanStep, ProjectPageRecord, TextBlock, Version, Versions } from "./types";

export type * from "./types";
export { specRows } from "./types";

/** A block as the page draws it, with the number its heading shows; null for a block with no heading. */
export type NumberedBlock<B extends PageBlock = PageBlock> = { readonly block: B; readonly num: string | null };

/**
 * One row of the page: a block on its own, or two half-width text blocks side
 * by side. A half-width text block with no half-width neighbour sits on its
 * own, at half the width.
 */
export type PageRow =
  | { readonly kind: "block"; readonly block: NumberedBlock }
  | { readonly kind: "halves"; readonly blocks: readonly [NumberedBlock<TextBlock>, NumberedBlock<TextBlock>] };

const pad = (i: number) => String(i).padStart(2, "0");

/** Whether the block draws a numbered heading: every kind with a title, and text only when it has a heading. */
export function hasHeading(block: PageBlock): boolean {
  switch (block.kind) {
    case "text":
      return block.heading !== undefined;
    case "facts":
    case "photo":
      return false;
    default:
      return true;
  }
}

const isHalf = (b: NumberedBlock): b is NumberedBlock<TextBlock> => b.block.kind === "text" && b.block.width === "half";

/**
 * The rows the page draws, in block order. A hidden block is left out, and
 * takes no number: the numbers run 01, 02, 03 ... over the headings the page
 * shows. Two half-width text blocks in a row pair up, first with second,
 * third with fourth; nothing else pairs them (Owner decision on #522).
 */
export function pageRowsOf(record: Pick<ProjectPageRecord, "blocks">): PageRow[] {
  let count = 0;
  const numbered = record.blocks
    .filter((block) => !block.hidden)
    .map((block): NumberedBlock => ({ block, num: hasHeading(block) ? pad(++count) : null }));
  const rows: PageRow[] = [];
  for (let i = 0; i < numbered.length; i++) {
    const here = numbered[i];
    const next = numbered[i + 1];
    if (isHalf(here) && next !== undefined && isHalf(next)) {
      rows.push({ kind: "halves", blocks: [here, next] });
      i++;
    } else rows.push({ kind: "block", block: here });
  }
  return rows;
}

/** The versions in table order. */
export function versionList(v: Versions): readonly Version[] {
  return [...v.before, v.highlighted, ...v.after];
}

export type PlanStatus = "done" | "now" | "next" | "later";

/** The plan's steps in order, each with its status. */
export function planSteps(plan: Plan): readonly (PlanStep & { status: PlanStatus })[] {
  return [
    ...plan.done.map((s) => ({ ...s, status: "done" as const })),
    { ...plan.now, status: "now" as const },
    ...plan.next.map((s) => ({ ...s, status: "next" as const })),
    ...plan.later.map((s) => ({ ...s, status: "later" as const })),
  ];
}

/** A parts list's numbers: drawn top to bottom, numbered bottom to top. */
export const partNumber = (index: number, count: number) => pad(count - index);

export { pad as twoDigits };
