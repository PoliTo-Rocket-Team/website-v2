import type { ApplyPosition } from "@/db/types";
import { placeholderRoles, type PlaceholderRole } from "./placeholder-roles";

// The domain rules of the /apply page (issue #119): which positions are
// public, how a position is named in a URL, and which of the three board
// states the page shows. The page, the position page (#120) and the
// dashboard switch (#121) all read these; none restates them.

/** The site-wide recruitment switch. Off, no position is public. */
export type Recruitment = { isOpen: boolean };

/** What the site assumes when no setting is stored: recruitment is on. */
export const DEFAULT_RECRUITMENT: Recruitment = { isOpen: true };

/** The part of a position the public rule reads. */
export type PositionState = Pick<ApplyPosition, "status" | "is_deleted">;

/** A position is public when it is open, not deleted, and recruitment is on. */
export function isPublic(position: PositionState, recruitment: Recruitment): boolean {
  return recruitment.isOpen && position.status && !position.is_deleted;
}

// A position's slug is its id, then its title in kebab case: `12-mission-analyst`.
// Only the id resolves it, so a link survives a title edit; the title is
// there for people reading the URL.

/** The `/apply/<slug>` segment of a position. */
export function positionSlug(position: Pick<ApplyPosition, "id" | "title">): string {
  const words = (position.title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return words === "" ? String(position.id) : `${position.id}-${words}`;
}

/** The position id a slug names, or null when the slug names none. */
export function positionIdFromSlug(slug: string): number | null {
  const match = /^([1-9][0-9]*)(?:-[a-z0-9-]*)?$/.exec(slug);
  if (match === null) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

/** The page link of a position. */
export function positionHref(position: Pick<ApplyPosition, "id" | "title">): string {
  return `/apply/${positionSlug(position)}`;
}

/** One row of the positions list, real or placeholder. */
export type Role = {
  key: string;
  title: string;
  division: string;
  code: string;
  description: string;
  required: readonly string[];
  desirable: readonly string[];
} & ({ status: "open"; href: string } | { status: "closed" });

/** A department heading and its rows, in list order. */
export type DepartmentGroup = { department: string; roles: readonly [Role, ...Role[]] };

/**
 * The three board states, by the number of public positions (Huey's ruling):
 * none open shows every placeholder (board 34b), one to four show the open
 * ones and then the placeholders of departments with nothing open (34c),
 * five or more show only the open ones (34).
 */
export type ApplyListing =
  | { kind: "none"; placeholders: readonly DepartmentGroup[] }
  | { kind: "few"; open: readonly [DepartmentGroup, ...DepartmentGroup[]]; others: readonly DepartmentGroup[] }
  | { kind: "many"; open: readonly [DepartmentGroup, ...DepartmentGroup[]] };

/** The most public positions that still show the other roles (board 34c). */
export const FEW_OPEN_MAX = 4;

/** Builds the page's listing from the public positions, already filtered by `isPublic`. */
export function applyListing(
  publicPositions: readonly ApplyPosition[],
  placeholders: readonly PlaceholderRole[] = placeholderRoles,
): ApplyListing {
  const order = departmentOrder(placeholders);
  const open = groupByDepartment(
    publicPositions.map((p) => ({ department: p.dept_name, role: openRole(p) })),
    order,
  );
  const closed = (skip: ReadonlySet<string>) =>
    groupByDepartment(
      placeholders.filter((p) => !skip.has(p.department)).map((p) => ({ department: p.department, role: closedRole(p) })),
      order,
    );

  if (!isNonEmpty(open)) return { kind: "none", placeholders: closed(new Set()) };
  if (publicPositions.length <= FEW_OPEN_MAX) {
    return { kind: "few", open, others: closed(new Set(open.map((g) => g.department))) };
  }
  return { kind: "many", open };
}

/** Positions shown as open in a listing. */
export function openCount(listing: ApplyListing): number {
  return listing.kind === "none" ? 0 : listing.open.reduce((n, g) => n + g.roles.length, 0);
}

function openRole(p: ApplyPosition): Role {
  return {
    key: `position-${p.id}`,
    title: p.title ?? "",
    division: p.div_name,
    code: [p.dept_code, p.div_code, String(p.id).padStart(3, "0")].filter((part) => part !== "").join("-"),
    description: p.description ?? "",
    required: p.required_skills ?? [],
    desirable: p.desirable_skills ?? [],
    status: "open",
    href: positionHref(p),
  };
}

function closedRole(p: PlaceholderRole): Role {
  return {
    key: `placeholder-${p.code}`,
    title: p.title,
    division: p.division,
    code: p.code,
    description: p.description,
    required: p.required,
    desirable: p.desirable,
    status: "closed",
  };
}

/** Departments in the placeholder record's order; any other department follows, by name. */
function departmentOrder(placeholders: readonly PlaceholderRole[]): (department: string) => number {
  const known = [...new Set(placeholders.map((p) => p.department))];
  return (department) => {
    const i = known.indexOf(department);
    return i === -1 ? known.length : i;
  };
}

function groupByDepartment(
  rows: readonly { department: string; role: Role }[],
  rank: (department: string) => number,
): DepartmentGroup[] {
  const groups = new Map<string, Role[]>();
  for (const { department, role } of rows) {
    const roles = groups.get(department);
    if (roles === undefined) groups.set(department, [role]);
    else roles.push(role);
  }
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([department, roles]) => ({ department, roles: roles as [Role, ...Role[]] }));
}

function isNonEmpty<T>(list: readonly T[]): list is readonly [T, ...T[]] {
  return list.length > 0;
}
