// The edit shell (boards 74b, 74e and 75b, issue #288): a content type's real
// page under an edit bar, with its blocks outlined on hover. Nothing here
// knows a content type: Outreach, Projects and the Team page each name their
// own blocks, sections and pages.

/** How wide Phone mode shows the page, px (board 74e). */
export const PHONE_FRAME_WIDTH = 390;

/** Desktop shows the page at the window's width; Phone in a 390px frame. */
export type EditDevice = "desktop" | "phone";

/**
 * One outlined block of the page: the name its outline shows, the panel
 * section its Edit chip opens, and the chip's words when they are not just
 * "Edit" (board 75b: "Edit launch history"). Several blocks may open one
 * section, as the cover photo and the photo grid both open Photos.
 */
export type EditBlock<Section extends string> = {
  readonly name: string;
  readonly section: Section;
  readonly chip?: string;
};

/** A page's blocks by id: one entry per id, so no two blocks share one. */
export type EditBlocks<Id extends string, Section extends string> = Readonly<Record<Id, EditBlock<Section>>>;

/** What a block's outline shows, and what its Edit chip does. */
export type EditChip = {
  readonly name: string;
  readonly label: string;
  readonly edit: () => void;
};

/** Each block's chip: clicking it hands the block's section to `onEdit`. */
export function editChips<Id extends string, Section extends string>(
  blocks: EditBlocks<Id, Section>,
  onEdit: (section: Section) => void,
): (id: Id) => EditChip {
  return (id) => {
    const block: EditBlock<Section> | undefined = blocks[id];
    if (block === undefined) throw new Error(`The page marks a block "${id}" that its blocks do not name.`);
    return { name: block.name, label: block.chip ?? "Edit", edit: () => onEdit(block.section) };
  };
}

/**
 * One line of the checklist under Publish (board 74f): what a new item still
 * needs before it can go on the site. Publish stays off until every line is done.
 */
export type PublishCheck = { readonly label: string; readonly done: boolean };

/** Whether Publish may run: every line of the checklist is done. */
export function checklistDone(checks: readonly PublishCheck[]): boolean {
  return checks.every((c) => c.done);
}

/** One page the switch shows (board 75d: Project page, Home, Projects list). */
export type PageTarget<Page extends string> = {
  readonly id: Page;
  readonly label: string;
};

/** The page switch shows only when there is another page to switch to. */
export function showsPageSwitch(targets: readonly PageTarget<string>[]): boolean {
  return targets.length > 1;
}
