import { closingPeople, mayManageDepartments, type ClosingPerson } from "./department-edit";
import { mayManageDivisionsIn } from "./division-edit";
import { divisionMembers, type DivisionMembers, type PersonRecord, type WaitingPerson } from "./division-members";
import {
  boardFlagOf,
  boardSeatKey,
  boardTitleOf,
  bySeatOrder,
  divisionLabel,
  mayChangeDivision,
  roleIn,
  type BoardFlag,
  type BoardRole,
  type DepartmentKind,
  type Joining,
  type OrgChart,
  type OrgDivision,
  type TeamActor,
} from "./team";
import { mayHandOverTeamLeader, type HeldSeat } from "./hand-over";
import type { FullAccessSeat, ViewerStanding } from "./viewer";

// The Team tree's edit view (issue #251, boards 77b and 66t-b): every open
// department with its heads, and every open division under it with its lead,
// each box collapsed with a count. A box for a seat names every holder of it
// (epic #861). Structure is edited here and nowhere else:
// the team leader and full access edit every department and division, a
// department head only their own department's divisions, and a division lead
// only the divisions they lead (issue #594). Both sides of the data interface
// build it here from their own records.

/** A person a box names, with their stored photo (issue #622); null for the PRT mark. */
export type StructurePerson = { readonly id: number; readonly name: string; readonly photoUrl: string | null };

export type StructureDivision = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
  readonly code: string | null;
  /** The lead the box names (board 77b): the first lead by name; null while it has none. */
  readonly lead: StructurePerson | null;
  /** Everyone in it, leads included. */
  readonly size: number;
  /**
   * The division's own page, for Edit division and Close division (boards
   * 68b to 68c): its people, the people waiting for their NDA and the people
   * joining. Null where the viewer may not change the division, so its box
   * has no pencil.
   */
  readonly page: DivisionMembers | null;
  /** Its open positions: Close division and Close department say how many close (boards 68c, 77f). */
  readonly openPositions: number;
  /** The viewer leads it: its box wears the accent ring and tint (issue #405). */
  readonly yours: boolean;
};

/** A department's head as its box and Edit department name them: the divisions they are in beside the department. */
export type StructureHead = StructurePerson & { readonly divisions: readonly string[] };

export type StructureDepartment = {
  readonly id: number;
  /** "Aerodynamics" */
  readonly name: string;
  readonly code: string | null;
  /** The Team page slide its head sits on (issue #325); Edit department sets it. */
  readonly kind: DepartmentKind;
  /** Every head of it, by name (epic #861: a seat may have several holders); none while it has no head. */
  readonly heads: readonly StructureHead[];
  /** Everyone in it, heads included, each once. */
  readonly size: number;
  /**
   * Its Add division, and Close division on each of its divisions: its head,
   * the team leader and full access. A division's pencil is its `page`, which
   * a lead also gets on the divisions they lead (issue #594).
   */
  readonly divisionsEditable: boolean;
  readonly divisions: readonly StructureDivision[];
  /** Everyone Close department moves (`closingPeople`, issue #441); none where the viewer may not close departments. */
  readonly closing: readonly ClosingPerson[];
  /** The viewer heads it: its box wears the accent ring and tint (issue #405). */
  readonly yours: boolean;
};

/** At least one person: a seat on the tree is drawn only while someone holds it. */
export type Holders = readonly [StructurePerson, ...StructurePerson[]];

/** A team-level seat's holder, with the row they hold it by. */
export type SeatHolder = StructurePerson & { readonly roleId: number };

/** At least one holder of a team-level seat, each with their own row. */
export type SeatHolders = readonly [SeatHolder, ...SeatHolder[]];

/**
 * The Team Leader box (board 77i): every team leader (epic #861), the viewer
 * when they are one and so may hand their role over (`mayHandOverTeamLeader`),
 * and whether the viewer is one, so the box wears the accent ring and tint
 * (issue #405).
 */
export type StructureLeader = {
  /** By name. */
  readonly holders: Holders;
  /** The viewer, when they are a team leader: "Hand over your role" hands over theirs. Null for anyone else. */
  readonly handsOver: StructurePerson | null;
  readonly yours: boolean;
};

/**
 * A box on the seat row under the Team Leader box (issue #627): one
 * team-level seat (`boardSeatKey`), its stored title (`boardTitleOf`), every
 * holder of it (epic #861), and the full-access seat its rows are flagged as,
 * which moves with the seat on Change holder.
 */
export type StructureSeat = {
  /** The first holder's row: the one Add another holder addresses. */
  readonly roleId: number;
  readonly title: string;
  /**
   * In seat order (`bySeatOrder`), so the first is the one `roleId` is. Each
   * names their own row of the seat, which Change holder and Remove act on,
   * so they replace or remove that holder alone (issue #872).
   */
  readonly holders: SeatHolders;
  readonly flag: BoardFlag | null;
  /** The viewer holds it: its box wears the accent ring and tint (issue #405). */
  readonly yours: boolean;
};

export type TeamStructure = {
  readonly leader: StructureLeader | null;
  /** The team-level seats in seat order (`bySeatOrder`), as the Team tree's seat row draws them. Change holder and Add seat: `departmentsEditable`. */
  readonly board: readonly StructureSeat[];
  /** The department pencils and Add department (board 77b): the team leader and full access only, never a head (66t-b). */
  readonly departmentsEditable: boolean;
  readonly departments: readonly StructureDepartment[];
  /** The code of every open division of the team: a division code is unique among them (#232). */
  readonly takenCodes: readonly { readonly id: number; readonly name: string; readonly code: string | null }[];
  /** The full-access seats on the team's lead and head roles: Change head and lead replace say when one moves (`fullAccessMovesLine`, issue #501). */
  readonly seats: readonly HeldSeat[];
};

/**
 * Whether the actor may open Edit division on the division, by the rule its
 * save is checked with (`mayChangeDivision`): the team, its department's
 * head, or a lead of it by role (issue #594). A Members grant opens none.
 */
function editsDivision(actor: TeamActor, division: OrgDivision, org: OrgChart): boolean {
  return mayChangeDivision(actor, division.id, org).allowed;
}

/** The divisions whose page the edit view needs: those the actor may open Edit division on. */
export function editableDivisionIds(actor: TeamActor | null, org: OrgChart): number[] {
  if (actor === null) return [];
  return org.divisions.filter((d) => editsDivision(actor, d, org)).map((d) => d.id);
}

/**
 * Whether the actor edits any structure at all: the team, a head, and a lead
 * of an open division (issue #594). A member, and someone a Members grant
 * alone makes an actor, get no Edit button (boards 77, 66t).
 */
export function editsStructure(actor: TeamActor | null, org: OrgChart): actor is TeamActor {
  return actor !== null && (actor.kind !== "lead" || editableDivisionIds(actor, org).length > 0);
}

/**
 * Whether the Team tree shows the viewer its Edit button (boards 77 and 66t):
 * full access (the team leader, the operations lead, the IT lead), a
 * department head and a division lead (issue #594). The data source answers
 * who they act as (`teamStructure`), and the server checks every write again.
 */
export function showsTreeEdit(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead" || viewer.kind === "department-head" || viewer.kind === "division-lead";
}

/** "A", "A and B", "A, B and C". */
export function andList(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The line under the edit view's title: what the viewer may change. A lead's
 * names the divisions they may edit (issue #594), which `teamStructure` never
 * leaves empty: a lead who may edit none gets no edit view.
 */
export function editViewIntro(structure: Pick<TeamStructure, "departmentsEditable" | "departments">): string {
  if (structure.departmentsEditable) return "Click a box to change who holds a seat, rename a unit, change its head or lead, or close it.";
  const departments = structure.departments.filter((d) => d.divisionsEditable).map((d) => d.name);
  if (departments.length > 0) return `You can edit the divisions of ${andList(departments)}. Ask the team leader to change a department or a seat.`;
  const divisions = structure.departments.flatMap((d) => d.divisions.filter((v) => v.page !== null).map((v) => `${divisionLabel(v.name)} Division`));
  return `You can edit ${andList(divisions)}. Ask your department head to add or close a division.`;
}

const byName = (a: StructurePerson, b: StructurePerson) => a.name.localeCompare(b.name);

/**
 * The edit view as `actor` sees it; null for an actor who edits no
 * structure. `waiting`, `joining` and `openPositions` are keyed by division
 * id, and are read only for `editableDivisionIds`.
 */
export function teamStructure(input: {
  readonly records: readonly PersonRecord[];
  readonly org: OrgChart;
  readonly actor: TeamActor | null;
  readonly selfId: number | null;
  /** The viewer's full-access seat: only the team leader's opens the Team Leader box (`mayHandOverTeamLeader`). */
  readonly seat: FullAccessSeat | null;
  readonly waiting: Readonly<Record<number, readonly WaitingPerson[]>>;
  readonly joining: Readonly<Record<number, readonly Joining[]>>;
  readonly openPositions: Readonly<Record<number, number>>;
  /** The full-access seats on the team's roles, as the data source reads them; none when the team holds none. */
  readonly seats?: readonly HeldSeat[];
}): TeamStructure | null {
  const { records, org, actor } = input;
  if (!editsStructure(actor, org)) return null;
  const person = (r: PersonRecord): StructurePerson => ({ id: r.id, name: r.name, photoUrl: r.photoUrl });
  // Every holder of a seat, never the first found (epic #861).
  const leaders = records.filter((r) => r.beyondDivisions.some((b) => b.kind === "team-leader")).map(person).sort(byName);
  // The viewer's own record: their box is the one the edit view marks (issue #405).
  const self = input.selfId === null ? undefined : records.find((r) => r.id === input.selfId);

  const departments = org.departments.map((department): StructureDepartment => {
    const heads = records.filter((r) => r.beyondDivisions.some((b) => b.kind === "head" && b.departmentId === department.id));
    const headIds = new Set(heads.map((h) => h.id));
    const editable = mayManageDivisionsIn(actor, department.id);
    const own = org.divisions.filter((d) => d.departmentId === department.id);
    const inDepartment = new Set<number>();
    const divisions = own.map((division): StructureDivision => {
      const people = records.filter((r) => roleIn(r.memberships, division.id) !== null);
      for (const p of people) if (!headIds.has(p.id)) inDepartment.add(p.id);
      const [lead] = people
        .filter((r) => roleIn(r.memberships, division.id) === "lead")
        .map(person)
        .sort(byName);
      return {
        id: division.id,
        name: division.name,
        code: division.code ?? null,
        lead: lead ?? null,
        size: people.length,
        page: editsDivision(actor, division, org)
          ? divisionMembers({
              records,
              org,
              divisionId: division.id,
              actor,
              selfId: input.selfId,
              reach: own.map((d) => d.id),
              waiting: input.waiting[division.id] ?? [],
              joining: input.joining[division.id] ?? [],
            })
          : null,
        openPositions: input.openPositions[division.id] ?? 0,
        yours: self !== undefined && roleIn(self.memberships, division.id) === "lead",
      };
    });
    const headOf = (head: PersonRecord): StructureHead => ({
      ...person(head),
      divisions: head.memberships.flatMap((m) => {
        const division = org.divisions.find((d) => d.id === m.divisionId);
        return division ? [divisionLabel(division.name)] : [];
      }),
    });
    return {
      id: department.id,
      name: department.name,
      code: department.code ?? null,
      kind: department.kind,
      heads: heads.map(headOf).sort(byName),
      size: headIds.size + inDepartment.size,
      divisionsEditable: editable,
      divisions,
      closing: mayManageDepartments(actor) ? closingPeople(records, org, department.id) : [],
      yours: self?.beyondDivisions.some((b) => b.kind === "head" && b.departmentId === department.id) ?? false,
    };
  });

  // One box per seat (`boardSeatKey`), its holders in seat order, each by their first row of it; a person holding one seat by two rows is named once.
  const bySeat = new Map<string, { seat: BoardRole; holders: SeatHolder[] }>();
  const rows = records
    .flatMap((r) => r.beyondDivisions.flatMap((b) => (b.kind === "board" ? [{ seat: b.seat, holder: r }] : [])))
    .sort((a, b) => bySeatOrder(a.seat, b.seat));
  for (const { seat, holder } of rows) {
    const named: SeatHolder = { ...person(holder), roleId: seat.roleId };
    const held = bySeat.get(boardSeatKey(seat));
    if (held === undefined) bySeat.set(boardSeatKey(seat), { seat, holders: [named] });
    else if (!held.holders.some((h) => h.id === holder.id)) held.holders.push(named);
  }
  const board = [...bySeat.values()].map(({ seat, holders: [first, ...rest] }): StructureSeat => ({
    roleId: seat.roleId,
    title: boardTitleOf(seat),
    holders: [first, ...rest],
    flag: boardFlagOf(seat.fullAccess),
    yours: [first, ...rest].some((h) => h.id === self?.id),
  }));

  const [firstLeader, ...otherLeaders] = leaders;
  const selfLeader = leaders.find((l) => l.id === self?.id) ?? null;
  return {
    leader:
      firstLeader === undefined
        ? null
        : {
            holders: [firstLeader, ...otherLeaders],
            handsOver: selfLeader !== null && mayHandOverTeamLeader({ seat: input.seat, selfId: input.selfId }, selfLeader.id) ? selfLeader : null,
            yours: selfLeader !== null,
          },
    board,
    departmentsEditable: mayManageDepartments(actor),
    departments,
    takenCodes: org.divisions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null })),
    seats: input.seats ?? [],
  };
}
