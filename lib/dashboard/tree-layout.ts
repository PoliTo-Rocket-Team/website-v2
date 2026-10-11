import { BOARD_SEAT_TITLES, divisionLabel, type TeamTree, type TreePerson } from "./team";

// Where every card, row and line of the Team tree canvas sits (board 54c),
// in canvas pixels at 100% zoom. The tree reads top-down: the team leader,
// the board seats side by side, every department head in one row, each
// head's division leads, and each division's members as a short list under
// its lead. The viewer's path carries `onPath` from the leader down to them.

export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type CardLevel = "leader" | "board" | "head" | "lead";

export type TreeNode =
  | (Box & {
      readonly kind: "card";
      readonly key: string;
      readonly level: CardLevel;
      /** Null for a department with no head or a division with no lead: the card names the unit. */
      readonly person: TreePerson | null;
      readonly title: string;
      readonly subtitle: string | null;
      readonly onPath: boolean;
    })
  | (Box & { readonly kind: "row"; readonly key: string; readonly person: TreePerson });

export type Point = readonly [x: number, y: number];

export type TreeEdge = { readonly points: readonly Point[]; readonly onPath: boolean };

/**
 * A dashed line from a division to someone in it who is drawn under another
 * division (board 54e): from the foot of the division's member rail, down
 * under the tree, across and up to them.
 */
export type TreeLink = { readonly key: string; readonly divisionId: number; readonly personId: number; readonly points: readonly Point[] };

export type TreeLayout = {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  /** The dashed lines to people drawn under another division; none when nobody is in two. */
  readonly links: readonly TreeLink[];
  /** What the canvas opens on: the viewer's department, or the top of the tree for the leader and board. Null for no place. */
  readonly focus: Box | null;
};

export const CARD = { w: 184, h: 52 } as const;
export const LEAD_CARD = { w: 164, h: 58 } as const;
const COLUMN_GAP = 12;
const DEPARTMENT_GAP = 48;
const BOARD_GAP = 24;
const ROW = { pitch: 30, h: 24, top: 14, rail: 14, indent: 26 } as const;

/** How far under the lowest card or row a dashed line runs across, and the step between two of them. */
const LINK_DROP = 28;
const LINK_STEP = 8;

const LEADER_Y = 0;
const BOARD_Y = LEADER_Y + CARD.h + 56;
const HEAD_Y = BOARD_Y + CARD.h + 72;
const LEAD_Y = HEAD_Y + CARD.h + 64;
const BOARD_BUS = LEADER_Y + CARD.h + 28;
const HEAD_BUS = HEAD_Y - 28;
const LEAD_BUS = HEAD_Y + CARD.h + 32;

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

function membersHeight(count: number): number {
  return count === 0 ? 0 : ROW.top + (count - 1) * ROW.pitch + ROW.h;
}

/** Where a dashed line can reach a person: their box, whether anything is drawn under it in its column, and the gap beside the column. */
type Target = { readonly box: Box; readonly covered: boolean; readonly gutterX: number };

export function layoutTeamTree(tree: TeamTree): TreeLayout {
  const path = tree.path;
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  /** Where each division's dashed lines start: the foot of its member rail, or under its card. */
  const starts = new Map<number, Point>();
  const targets = new Map<number, Target>();

  const columns = tree.departments.map((department) => {
    const leads = department.divisions.length;
    const leadsWidth = leads * LEAD_CARD.w + Math.max(0, leads - 1) * COLUMN_GAP;
    return { department, width: Math.max(CARD.w, leadsWidth), leadsWidth };
  });
  const headsWidth = columns.reduce((sum, c) => sum + c.width, 0) + Math.max(0, columns.length - 1) * DEPARTMENT_GAP;
  const boardWidth = tree.board.length * CARD.w + Math.max(0, tree.board.length - 1) * BOARD_GAP;
  const width = Math.max(headsWidth, boardWidth, CARD.w);
  const centre = width / 2;

  const leaderBox: Box = { x: centre - CARD.w / 2, y: LEADER_Y, w: CARD.w, h: CARD.h };
  const aboveDepartments = tree.leader?.self === true || tree.board.some((b) => b.person.self);
  if (tree.leader) {
    nodes.push({
      kind: "card",
      key: `leader-${tree.leader.id}`,
      level: "leader",
      ...leaderBox,
      person: tree.leader,
      title: tree.leader.name,
      subtitle: "Team Leader",
      onPath: path !== null || aboveDepartments,
    });
  }

  const boardLeft = centre - boardWidth / 2;
  tree.board.forEach(({ seat, person }, i) => {
    const box: Box = { x: boardLeft + i * (CARD.w + BOARD_GAP), y: BOARD_Y, w: CARD.w, h: CARD.h };
    nodes.push({ kind: "card", key: `board-${person.id}`, level: "board", ...box, person, title: person.name, subtitle: BOARD_SEAT_TITLES[seat], onPath: person.self });
    if (tree.leader) edges.push(elbow(leaderBox, box, BOARD_BUS, person.self));
  });

  let height = tree.board.length > 0 ? BOARD_Y + CARD.h : LEADER_Y + CARD.h;
  let focus: Box | null = aboveDepartments ? { x: Math.min(leaderBox.x, boardLeft), y: 0, w: Math.max(CARD.w, boardWidth), h: height } : null;

  let left = (width - headsWidth) / 2;
  for (const { department, width: columnWidth, leadsWidth } of columns) {
    const onDepartment = path?.departmentId === department.id;
    const headBox: Box = { x: left + columnWidth / 2 - CARD.w / 2, y: HEAD_Y, w: CARD.w, h: CARD.h };
    nodes.push({
      kind: "card",
      key: `head-${department.id}`,
      level: "head",
      ...headBox,
      person: department.head,
      title: department.head?.name ?? department.name,
      subtitle: department.head ? `Head of ${department.name}` : null,
      onPath: onDepartment,
    });
    // The trunk runs from the leader past the board seats to every head.
    if (tree.leader) edges.push(elbow(leaderBox, headBox, HEAD_BUS, onDepartment));

    let columnBottom = bottom(headBox);
    const leadsLeft = left + (columnWidth - leadsWidth) / 2;
    department.divisions.forEach((division, j) => {
      const onDivision = onDepartment && path?.divisionId === division.id;
      const leadBox: Box = { x: leadsLeft + j * (LEAD_CARD.w + COLUMN_GAP), y: LEAD_Y, w: LEAD_CARD.w, h: LEAD_CARD.h };
      const label = divisionLabel(division.name);
      nodes.push({
        kind: "card",
        key: `lead-${division.id}`,
        level: "lead",
        ...leadBox,
        person: division.lead,
        title: division.lead?.name ?? label,
        subtitle: division.lead ? `${label} · lead` : null,
        onPath: onDivision,
      });
      edges.push(elbow(headBox, leadBox, LEAD_BUS, onDivision));

      const railX = leadBox.x + ROW.rail;
      const rows = division.members.map((_, k): Box => ({
        x: leadBox.x + ROW.indent,
        y: bottom(leadBox) + ROW.top + k * ROW.pitch,
        w: LEAD_CARD.w - ROW.indent,
        h: ROW.h,
      }));
      division.members.forEach((person, k) => nodes.push({ kind: "row", key: `row-${person.id}`, ...rows[k], person }));
      const gutterX = leadBox.x + leadBox.w + COLUMN_GAP / 2;
      if (division.lead) targets.set(division.lead.id, { box: leadBox, covered: rows.length > 0, gutterX });
      division.members.forEach((person, k) => targets.set(person.id, { box: rows[k], covered: k < rows.length - 1, gutterX }));
      const lastRow = rows[rows.length - 1];
      starts.set(division.id, lastRow ? [railX, lastRow.y + lastRow.h / 2] : [middle(leadBox), bottom(leadBox)]);
      if (rows.length > 0) {
        const rowMiddle = (box: Box) => box.y + box.h / 2;
        edges.push({ points: [[railX, bottom(leadBox)], [railX, rowMiddle(rows[rows.length - 1])]], onPath: false });
        rows.forEach((row, k) => edges.push({ points: [[railX, rowMiddle(row)], [row.x, rowMiddle(row)]], onPath: false }));
        const mine = division.members.findIndex((m) => m.self);
        if (mine >= 0) {
          const row = rows[mine];
          edges.push({ points: [[railX, bottom(leadBox)], [railX, rowMiddle(row)], [row.x, rowMiddle(row)]], onPath: true });
        }
      }
      columnBottom = Math.max(columnBottom, bottom(leadBox) + membersHeight(rows.length));
    });

    if (onDepartment) focus = { x: left, y: HEAD_Y, w: columnWidth, h: columnBottom - HEAD_Y };
    height = Math.max(height, columnBottom);
    left += columnWidth + DEPARTMENT_GAP;
  }

  const links = linksOf(tree, nodes, starts, targets);
  for (const link of links) height = Math.max(height, ...link.points.map(([, y]) => y + LINK_STEP));
  return { width, height, nodes, edges, links, focus };
}

/**
 * One dashed line per division a person is in beyond the one they are drawn
 * under (board 54e). Each runs down from the division's rail to just under the
 * lowest card or row it passes, across, and up to the person: straight up into
 * the bottom of their box when nothing is drawn under it, else up the gap
 * beside their column and into its side, so it crosses no one. Lines are
 * stacked LINK_STEP apart so no two run across on one level.
 */
function linksOf(tree: TeamTree, nodes: readonly TreeNode[], starts: ReadonlyMap<number, Point>, targets: ReadonlyMap<number, Target>): TreeLink[] {
  const links: TreeLink[] = [];
  for (const division of tree.departments.flatMap((d) => d.divisions)) {
    const start = starts.get(division.id);
    for (const personId of division.elsewhere) {
      const target = targets.get(personId);
      if (!start || !target) continue;
      const { box, covered, gutterX } = target;
      const endX = covered ? gutterX : middle(box);
      const [from, to] = [Math.min(start[0], endX, box.x), Math.max(start[0], endX, box.x + box.w)];
      const lowest = Math.max(start[1], ...nodes.filter((n) => n.x < to && n.x + n.w > from).map(bottom));
      const busY = lowest + LINK_DROP + links.length * LINK_STEP;
      const up: Point[] = covered
        ? [
            [gutterX, busY],
            [gutterX, box.y + box.h / 2],
            [box.x + box.w, box.y + box.h / 2],
          ]
        : [
            [endX, busY],
            [endX, bottom(box)],
          ];
      links.push({ key: `also-${division.id}-${personId}`, divisionId: division.id, personId, points: [start, [start[0], busY], ...up] });
    }
  }
  return links;
}

/** The box of the card or row that shows `personId`, for "Find someone" and "Show me". */
export function boxOf(layout: TreeLayout, personId: number): Box | null {
  return layout.nodes.find((n) => n.person?.id === personId) ?? null;
}
