import { divisionMembers, type DivisionHeader, type DivisionMembers, type DivisionPerson, type PersonRecord, type WaitingPerson } from "./division-members";
import { divisionLabel, type Joining, type OrgChart, type Removal, type TeamActor } from "./team";

// A department head's Members page (issue #235, boards 69 to 69c and 69m):
// every division of the department as a tab, each the division page the lead
// sees (./division-members.ts), plus "All divisions" with everyone in the
// department once. It holds no structure tools and no Closed tab: divisions
// are created, edited and closed in the Team tree's edit view, and a closed
// division never opens again (issue #251). Both sides of the data interface
// build it here from their own records.

/** "Remove from <division>" for one division of the department a person is in. */
export type DivisionRemoval = {
  readonly divisionId: number;
  /** "Mission Analysis" */
  readonly short: string;
  readonly removal: Removal;
};

/**
 * Someone under All divisions: their row as their first division of the
 * department shows it (role, title, chips), with a removal for each division
 * of the department they are in.
 */
export type DepartmentPerson = DivisionPerson & { readonly removals: readonly DivisionRemoval[] };

export type DepartmentMembers = {
  readonly department: { readonly id: number; readonly name: string };
  /** One tab per open division of the department, in display order: the division's own page. */
  readonly tabs: readonly DivisionMembers[];
  /** Everyone in the department's divisions, once each: leads first, then by division and name. */
  readonly everyone: readonly DepartmentPerson[];
};

/**
 * The department's page as `actor` sees it. Null when the department is not
 * on the chart. `waiting` and `joining` are keyed by division id.
 */
export function departmentMembers(input: {
  readonly records: readonly PersonRecord[];
  readonly org: OrgChart;
  readonly departmentId: number;
  readonly actor: TeamActor;
  readonly selfId: number | null;
  readonly waiting: Readonly<Record<number, readonly WaitingPerson[]>>;
  readonly joining: Readonly<Record<number, readonly Joining[]>>;
}): DepartmentMembers | null {
  const { org, departmentId, actor } = input;
  const department = org.departments.find((d) => d.id === departmentId);
  if (!department) return null;
  const divisionIds = org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id);
  const tabs = divisionIds.flatMap((divisionId) => {
    const page = divisionMembers({
      records: input.records,
      org,
      divisionId,
      actor,
      selfId: input.selfId,
      reach: divisionIds,
      waiting: input.waiting[divisionId] ?? [],
      joining: input.joining[divisionId] ?? [],
    });
    return page === null ? [] : [page];
  });
  return {
    department: { id: department.id, name: department.name },
    tabs,
    everyone: everyoneIn(tabs, divisionIds),
  };
}

/** Everyone once, as their first division of the department lists them, with a removal per division they are in. */
function everyoneIn(tabs: readonly DivisionMembers[], divisionIds: readonly number[]): DepartmentPerson[] {
  const seen = new Map<number, DepartmentPerson>();
  for (const tab of tabs) {
    for (const person of tab.people) {
      if (seen.has(person.id)) continue;
      // Their own order, home division first: the first one in this department is the row's.
      const first = person.divisions.find((d) => d.sameDepartment)?.divisionId ?? tab.division.id;
      const row = tabs.find((t) => t.division.id === first)?.people.find((p) => p.id === person.id) ?? person;
      const removals = row.divisions.flatMap((d): DivisionRemoval[] => {
        if (!d.sameDepartment) return [];
        const removal = tabs.find((t) => t.division.id === d.divisionId)?.people.find((p) => p.id === person.id)?.removal;
        return removal ? [{ divisionId: d.divisionId, short: d.name, removal }] : [];
      });
      seen.set(person.id, { ...row, removals });
    }
  }
  const order = (p: DepartmentPerson) => divisionIds.indexOf(p.divisions[0]?.divisionId ?? -1);
  return [...seen.values()].sort(
    (a, b) => Number(b.role === "lead") - Number(a.role === "lead") || order(a) - order(b) || a.name.localeCompare(b.name),
  );
}

/** "Aerodynamics Department · 16 people in 2 divisions" under the title (board 69). */
export function departmentLine(page: Pick<DepartmentMembers, "department" | "everyone" | "tabs">): string {
  const people = page.everyone.length;
  const divisions = page.tabs.length;
  return `${page.department.name} Department · ${people} ${people === 1 ? "person" : "people"} in ${divisions} ${divisions === 1 ? "division" : "divisions"}`;
}

/** The open tab: All divisions, or one division (by id). */
export type DepartmentTab = { readonly kind: "all" } | { readonly kind: "division"; readonly divisionId: number };

export const ALL_TAB: DepartmentTab = { kind: "all" };

/** A tab as a string key, for the tab strip and the phone select. */
export function tabKey(tab: DepartmentTab): string {
  return tab.kind === "division" ? `d${tab.divisionId}` : tab.kind;
}

export function tabOfKey(key: string, page: Pick<DepartmentMembers, "tabs">): DepartmentTab {
  const divisionId = Number(key.slice(1));
  return key.startsWith("d") && page.tabs.some((t) => t.division.id === divisionId) ? { kind: "division", divisionId } : ALL_TAB;
}

export type DepartmentTabOption = { readonly key: string; readonly label: string; readonly count: number };

/**
 * The tabs (board 69): All divisions with everyone once, then each division
 * with the people it lists (those waiting for their NDA included).
 */
export function departmentTabs(page: Pick<DepartmentMembers, "tabs" | "everyone">): DepartmentTabOption[] {
  return [
    { key: tabKey(ALL_TAB), label: "All divisions", count: page.everyone.length },
    ...page.tabs.map((t) => ({
      key: tabKey({ kind: "division", divisionId: t.division.id }),
      label: divisionLabel(t.division.name),
      count: t.people.length + t.waiting.length,
    })),
  ];
}

/**
 * Add member's Division select (board 69c): only the department's open
 * divisions, starting on the open division tab, else the first.
 */
export function addMemberDivisions(
  page: Pick<DepartmentMembers, "tabs">,
  open: DepartmentTab,
): { readonly divisions: readonly DivisionHeader[]; readonly start: number | null } {
  const divisions = page.tabs.map((t) => t.division);
  const start = open.kind === "division" && divisions.some((d) => d.id === open.divisionId) ? open.divisionId : (divisions[0]?.id ?? null);
  return { divisions, start };
}
