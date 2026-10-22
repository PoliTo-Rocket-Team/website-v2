// The edit shell (boards 74b, 74e and 75b, issue #288): a content type's real
// page under an edit bar, with its blocks outlined on hover. Nothing here
// knows a content type: Outreach, Projects and the Team page each name their
// own blocks, sections and pages.

/** How wide Phone mode shows the page, px (board 74e). */
export const PHONE_FRAME_WIDTH = 390;

/** Desktop shows the page at the window's width; Phone in a 390px frame. */
export type EditDevice = "desktop" | "phone";

/** The width a scaled Desktop preview lays the page out at: the 1440 board (board 93). */
export const DESKTOP_FRAME_WIDTH = 1440;

/** A page laid out at `width` x `height` and drawn at `scale` of that size. */
export type ScaledFrame = { readonly width: number; readonly height: number; readonly scale: number };

/**
 * Desktop beside an open panel, for a content type that opts in (board 93,
 * issue #526): the page keeps the desktop layout, laid out at least 1440px
 * wide, and is scaled down to fill the room left of the panel, never up. Its
 * height fills the room once scaled. A room with no size yet has no frame.
 */
export function scaledFrameOf(room: { readonly width: number; readonly height: number }): ScaledFrame | null {
  if (room.width <= 0 || room.height <= 0) return null;
  const width = Math.max(DESKTOP_FRAME_WIDTH, room.width);
  const scale = room.width / width;
  return { width, height: room.height / scale, scale };
}

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

/**
 * Whether the editor still has to check the item on a page of the switch
 * before Publish (board 93e): a red cross until they confirm it looks right,
 * then a green tick.
 */
export type PageCheck = "unchecked" | "checked";

/** One page the switch shows (board 75d: Project page, Home, Projects list), with its check mark where it has one. */
export type PageTarget<Page extends string> = {
  readonly id: Page;
  readonly label: string;
  readonly check?: PageCheck;
};

/** The page switch shows only when there is another page to switch to. */
export function showsPageSwitch(targets: readonly PageTarget<string>[]): boolean {
  return targets.length > 1;
}
