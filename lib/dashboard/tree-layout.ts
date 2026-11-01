import { departmentsOnPath, divisionLabel, divisionsOnPath, viewersSeat, type TeamTree, type TreeHead, type TreeHolders, type TreePerson } from "./team";

// Where every card, row and line of the Team tree canvas sits (board 54c),
// in canvas pixels at 100% zoom. The tree reads top-down: the team leader,
// the board seats side by side, every department head in one row, each
// head's division leads, and each division's members as a short list under
// its lead. The viewer's path carries `onPath` from the leader down to every
// place they are drawn (issue #862).
// No name or label is cut off: a long one wraps, and its card or row, and
// everything under it, moves down to fit (Owner decision, 2026-10-19, on #398).
// The cards of one level row all take the tallest one's height (issue #897).

export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type CardLevel = "leader" | "board" | "head" | "lead";

export type TreeNode =
  | (Box & {
      readonly kind: "card";
      readonly key: string;
      readonly level: CardLevel;
      /** Everyone on the card, in its order (issue #916); none for a department with no head or a division with no lead. */
      readonly holders: TreeHolders;
      /** The unit or seat the card stands for, drawn as its heading only when nobody holds it. */
      readonly title: string;
      readonly subtitle: string | null;
      readonly onPath: boolean;
    })
  | (Box & { readonly kind: "row"; readonly key: string; readonly person: TreePerson; readonly onPath: boolean });

/** Everyone drawn on a node: a card's holders, or a row's one person. */
export function peopleOn(node: TreeNode): readonly TreePerson[] {
  return node.kind === "card" ? node.holders : [node.person];
}

/** The caption under the team leaders: "Team Leaders" when several hold the seat, as the edit view reads it. */
export function leaderCaption(leaders: TreeHolders): string {
  return leaders.length > 1 ? "Team Leaders" : "Team Leader";
}

/** A stored title with its role word capitalised: "head of avionics" reads "Head of avionics" (issue #916). */
function withCapitalHead(title: string): string {
  return title.replace(/\bhead\b/gi, "Head");
}

/** The caption under a department's heads: their stored titles, "Head" capitalised, each once; null when it has none. */
export function headCaption(heads: TreeHolders<TreeHead>): string | null {
  return heads.length === 0 ? null : [...new Set(heads.map((h) => withCapitalHead(h.title)))].join(", ");
}

/** The caption under a team-level seat's holders: its stored title, "Head" capitalised. */
export function seatCaption(title: string): string {
  return withCapitalHead(title);
}

/** The caption under a division's leads: "Safety · Lead", or "· Leads" for several; null when it has none. */
export function leadCaption(divisionName: string, leads: TreeHolders): string | null {
  if (leads.length === 0) return null;
  return `${divisionLabel(divisionName)} · ${leads.length > 1 ? "Leads" : "Lead"}`;
}

export type Point = readonly [x: number, y: number];

export type TreeEdge = { readonly points: readonly Point[]; readonly onPath: boolean };

export type TreeLayout = {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  /** What the canvas opens on: the viewer's department, or the top of the tree for the leader and board, each down to its lowest row. Null for no place. */
  readonly focus: Box | null;
};

/** The smallest size of a card; a long name or subtitle makes it taller (`cardHeight`). */
export const CARD = { w: 184, h: 52 } as const;
export const LEAD_CARD = { w: 164, h: 58 } as const;
const COLUMN_GAP = 12;
const DEPARTMENT_GAP = 48;
const BOARD_GAP = 24;
/** A member row: its smallest height, the gap between two rows, the lead card's foot to the first row, the rail's offset and the rows' indent. */
const ROW = { h: 24, gap: 6, top: 14, rail: 14, indent: 26 } as const;
const ROW_WIDTH = LEAD_CARD.w - ROW.indent;

/** The vertical gaps between levels, and where each bus runs inside them. */
const LEADER_TO_BOARD = 56;
const BOARD_TO_HEADS = 72;
const HEADS_TO_LEADS = 64;
const BOARD_BUS_DROP = 28;
const HEAD_BUS_RISE = 28;
const LEAD_BUS_DROP = 32;

/**
 * A line of text as the tree draws it: its size and line height in canvas
 * pixels, and an upper bound on one character's width (Archivo, the site's
 * face). A bound, not a measure, so a box is never drawn shorter than what
 * it shows.
 */
type TextStyle = { readonly line: number; readonly char: number };
const TITLE: TextStyle = { line: 16.25, char: 13 * 0.64 };
const SUBTITLE: TextStyle = { line: 13.75, char: 11 * 0.6 };
const ROW_NAME: TextStyle = { line: 15, char: 12 * 0.6 };
const ROW_NAME_SELF: TextStyle = { line: 15, char: 12 * 0.64 };
const SUBTITLE_GAP = 2;

/**
 * What sits around a card's text: its border and padding, the avatar and the
 * gap after it across, and its border and padding down.
 */
const CARD_PARTS = { across: 2 + 2 * 10 + 28 + 10, down: 2 + 2 * 4 } as const;
const ROW_PARTS = { across: 2 + 2 * 6 + 20 + 8, down: 2 + 2 * 2 } as const;

/**
 * How many lines `text` wraps to in `width`: words fill a line until the next
 * one would run past it, and a word longer than a whole line breaks across lines.
 */
function lineCount(text: string, style: TextStyle, width: number): number {
  const words = text.split(/\s+/).filter((w) => w !== "");
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const w = word.length * style.char;
    const next = used === 0 ? w : used + style.char + w;
    if (next <= width) {
      used = next;
    } else if (w <= width) {
      lines += used === 0 ? 0 : 1;
      used = w;
    } else {
      const spill = Math.ceil(w / width);
      lines += (used === 0 ? 0 : 1) + spill - 1;
      used = w - (spill - 1) * width;
    }
  }
  return lines;
}

/** The name as drawn: the viewer's carries " · you". */
const shownName = (name: string, self: boolean) => (self ? `${name} · you` : name);

/**
 * A card with several holders (issue #916): one line per holder, their avatar
 * beside their name, the caption under the names. Its border and padding
 * down, the avatar's size, the gap between two holders and the caption's gap
 * (`TreeCard` in components/dashboard/team-tree.tsx draws these).
 */
const HOLDER_ROWS = { down: 2 + 2 * 8, avatar: 28, gap: 6, caption: 4 } as const;

/** How tall a card `width` wide is drawn: the smallest card, or taller to show its whole title and subtitle. */
function cardHeight(title: string, subtitle: string | null, width: number, least: number): number {
  const text = width - CARD_PARTS.across;
  const titleH = lineCount(title, TITLE, text) * TITLE.line;
  const subtitleH = subtitle === null ? 0 : SUBTITLE_GAP + lineCount(subtitle, SUBTITLE, text) * SUBTITLE.line;
  return Math.max(least, Math.ceil(CARD_PARTS.down + titleH + subtitleH));
}

/**
 * How tall a card is drawn for who holds it: as `cardHeight` for one holder
 * or none, so such a card is as it was; for several, every holder's line
 * (each as tall as its avatar, or its wrapped name) and the caption.
 */
function holdersCardHeight(holders: TreeHolders, title: string, subtitle: string | null, width: number, least: number): number {
  if (holders.length <= 1) {
    const only = holders.at(0);
    return cardHeight(only ? shownName(only.name, only.self) : title, subtitle, width, least);
  }
  const text = width - CARD_PARTS.across;
  const names = holders.reduce((sum, p) => sum + Math.max(HOLDER_ROWS.avatar, lineCount(shownName(p.name, p.self), TITLE, text) * TITLE.line), 0);
  const gaps = (holders.length - 1) * HOLDER_ROWS.gap;
  const subtitleH = subtitle === null ? 0 : HOLDER_ROWS.caption + lineCount(subtitle, SUBTITLE, text) * SUBTITLE.line;
  return Math.max(least, Math.ceil(HOLDER_ROWS.down + names + gaps + subtitleH));
}

/**
 * How tall every card in one level row is drawn (the board seats, the
 * department heads, the division leads): the tallest card's height, so cards
 * side by side end on one line and what hangs under them starts on one line
 * (issue #897). No card is drawn shorter than its own text needs.
 */
function levelHeight(heights: readonly number[], least: number): number {
  return Math.max(least, ...heights);
}

/** How tall a member row is drawn: one line, or taller to show the whole name. */
function rowHeight(person: TreePerson): number {
  const style = person.self ? ROW_NAME_SELF : ROW_NAME;
  const lines = lineCount(shownName(person.name, person.self), style, ROW_WIDTH - ROW_PARTS.across);
  return Math.max(ROW.h, Math.ceil(ROW_PARTS.down + lines * style.line));
}

const bottom = (box: Box) => box.y + box.h;
const middle = (box: Box) => box.x + box.w / 2;

/** A line from a parent's bottom edge to a child's top edge, turning on the bus at `busY`. */
function elbow(parent: Box, child: Box, busY: number, onPath: boolean, from = middle(parent)): TreeEdge {
  return {
    points: [
      [from, bottom(parent)],
      [from, busY],
      [middle(child), busY],
      [middle(child), child.y],
    ],
    onPath,
  };
}

export function layoutTeamTree(tree: TeamTree): TreeLayout {
  const path = tree.path;
  const pathDepartments = departmentsOnPath(path);
  const pathDivisions = divisionsOnPath(path);
  // The canvas opens on the viewer's first place: its department, or the top of the tree for a seat.
  const first = path?.[0] ?? null;
  const firstDepartment = first?.kind === "head" || first?.kind === "division" ? first.departmentId : null;
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  const columns = tree.departments.map((department) => {
    const leadsWidth = department.divisions.length * LEAD_CARD.w + Math.max(0, department.divisions.length - 1) * COLUMN_GAP;
    return { department, width: Math.max(CARD.w, leadsWidth), leadsWidth };
  });
  const headsWidth = columns.reduce((sum, c) => sum + c.width, 0) + Math.max(0, columns.length - 1) * DEPARTMENT_GAP;
  const boardWidth = tree.board.length * CARD.w + Math.max(0, tree.board.length - 1) * BOARD_GAP;
  const width = Math.max(headsWidth, boardWidth, CARD.w);
  const centre = width / 2;

  const { leaders } = tree;
  const hasLeader = leaders.length > 0;
  const leaderCaptionText = leaderCaption(leaders);
  const leaderBox: Box = { x: centre - CARD.w / 2, y: 0, w: CARD.w, h: hasLeader ? holdersCardHeight(leaders, leaderCaptionText, leaderCaptionText, CARD.w, CARD.h) : CARD.h };
  const aboveDepartments = first?.kind === "leader" || first?.kind === "board";
  if (hasLeader) {
    nodes.push({
      kind: "card",
      key: `leader-${leaders[0].id}`,
      level: "leader",
      ...leaderBox,
      holders: leaders,
      title: leaderCaptionText,
      subtitle: leaderCaptionText,
      onPath: path !== null,
    });
  }

  const boardY = bottom(leaderBox) + LEADER_TO_BOARD;
  const boardBus = bottom(leaderBox) + BOARD_BUS_DROP;
  const boardLeft = centre - boardWidth / 2;
  const seatH = levelHeight(
    tree.board.map(({ title, holders }) => holdersCardHeight(holders, title, seatCaption(title), CARD.w, CARD.h)),
    CARD.h,
  );
  const boardBottom = boardY + seatH;
  tree.board.forEach(({ key, title, holders }, i) => {
    const mine = viewersSeat(holders);
    const box: Box = { x: boardLeft + i * (CARD.w + BOARD_GAP), y: boardY, w: CARD.w, h: seatH };
    // Keyed by the seat, not a holder: one person can hold two seats (issue #929).
    nodes.push({ kind: "card", key: `board-${key}`, level: "board", ...box, holders, title, subtitle: seatCaption(title), onPath: mine });
    if (hasLeader) edges.push(elbow(leaderBox, box, boardBus, mine));
  });

  const headY = boardBottom + BOARD_TO_HEADS;
  const headBus = headY - HEAD_BUS_RISE;
  const headH = levelHeight(
    columns.map(({ department }) => holdersCardHeight(department.heads, department.name, headCaption(department.heads), CARD.w, CARD.h)),
    CARD.h,
  );
  const headsBottom = headY + headH;
  const leadY = headsBottom + HEADS_TO_LEADS;
  const leadBus = headsBottom + LEAD_BUS_DROP;
  // The division leads of every department share one row, so they share its height.
  const leadH = levelHeight(
    columns.flatMap(({ department }) =>
      department.divisions.map((division) =>
        holdersCardHeight(division.leads, divisionLabel(division.name), leadCaption(division.name, division.leads), LEAD_CARD.w, LEAD_CARD.h),
      ),
    ),
    LEAD_CARD.h,
  );

  let height = tree.board.length > 0 ? boardBottom : bottom(leaderBox);
  let ownColumn: Box | null = null;

  let left = (width - headsWidth) / 2;
  for (const { department, width: columnWidth, leadsWidth } of columns) {
    const onDepartment = pathDepartments.has(department.id);
    const headBox: Box = { x: left + columnWidth / 2 - CARD.w / 2, y: headY, w: CARD.w, h: headH };
    nodes.push({
      kind: "card",
      key: `head-${department.id}`,
      level: "head",
      ...headBox,
      holders: department.heads,
      title: department.name,
      subtitle: headCaption(department.heads),
      onPath: onDepartment,
    });
    // The trunk runs from the leader past the board seats to every head.
    if (hasLeader) edges.push(elbow(leaderBox, headBox, headBus, onDepartment));

    let columnBottom = bottom(headBox);
    let slotLeft = left + (columnWidth - leadsWidth) / 2;
    for (const division of department.divisions) {
      const onDivision = pathDivisions.has(division.id);
      const title = divisionLabel(division.name);
      const subtitle = leadCaption(division.name, division.leads);
      const leadBox: Box = { x: slotLeft, y: leadY, w: LEAD_CARD.w, h: leadH };
      slotLeft += LEAD_CARD.w + COLUMN_GAP;
      nodes.push({ kind: "card", key: `lead-${division.id}`, level: "lead", ...leadBox, holders: division.leads, title, subtitle, onPath: onDivision });
      edges.push(elbow(headBox, leadBox, leadBus, onDivision));

      // Each row sits under the one before it, so a row that grows pushes the rest down.
      const rows: Box[] = [];
      let rowY = bottom(leadBox) + ROW.top;
      for (const person of division.members) {
        const row: Box = { x: leadBox.x + ROW.indent, y: rowY, w: ROW_WIDTH, h: rowHeight(person) };
        rows.push(row);
        rowY = bottom(row) + ROW.gap;
      }
      division.members.forEach((person, k) =>
        nodes.push({ kind: "row", key: `row-${division.id}-${person.id}`, ...rows[k], person, onPath: onDivision && person.self }),
      );
      if (rows.length > 0) {
        const railX = leadBox.x + ROW.rail;
        const rowMiddle = (box: Box) => box.y + box.h / 2;
        edges.push({ points: [[railX, bottom(leadBox)], [railX, rowMiddle(rows[rows.length - 1])]], onPath: false });
        rows.forEach((row) => edges.push({ points: [[railX, rowMiddle(row)], [row.x, rowMiddle(row)]], onPath: false }));
        const mine = onDivision ? division.members.findIndex((m) => m.self) : -1;
        if (mine >= 0) {
          const row = rows[mine];
          edges.push({ points: [[railX, bottom(leadBox)], [railX, rowMiddle(row)], [row.x, rowMiddle(row)]], onPath: true });
        }
      }
      columnBottom = Math.max(columnBottom, rows.length > 0 ? bottom(rows[rows.length - 1]) : bottom(leadBox));
    }

    if (department.id === firstDepartment) ownColumn = { x: left, y: headY, w: columnWidth, h: columnBottom - headY };
    height = Math.max(height, columnBottom);
    left += columnWidth + DEPARTMENT_GAP;
  }

  // The leader and board open on the top of the tree, down to its lowest row, so the opening view leaves no row cut off.
  const top: Box | null = aboveDepartments ? { x: Math.min(leaderBox.x, boardLeft), y: 0, w: Math.max(CARD.w, boardWidth), h: height } : null;
  return { width, height, nodes, edges, focus: ownColumn ?? top };
}

/** The box of the card or row at the person's first place, for "Find someone" and "Show me". */
export function boxOf(layout: TreeLayout, personId: number): Box | null {
  return layout.nodes.find((n) => peopleOn(n).some((p) => p.id === personId && p.first)) ?? null;
}
