import { mayManageDepartments } from "./department-edit";
import { mayManageDivisionsIn } from "./division-edit";
import { divisionMembers, type DivisionMembers, type PersonRecord, type WaitingPerson } from "./division-members";
import { divisionLabel, roleIn, type Joining, type OrgChart, type TeamActor } from "./team";
import type { ViewerStanding } from "./viewer";

// The Team tree's edit view (issue #251, boards 77b and 66t-b): every open
// department with its head, and every open division under it with its lead,
// each box collapsed with a count. Structure is edited here and nowhere else:
// the team leader and full access edit every department and division, a
// department head only their own department's divisions. Both sides of the
// data interface build it here from their own records.

export type StructurePerson = { readonly id: number; readonly name: string };

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
};

export type StructureDepartment = {
  readonly id: number;
  /** "Aerodynamics" */
  readonly name: string;
  readonly code: string | null;
  readonly head: (StructurePerson & { readonly divisions: readonly string[] }) | null;
  /** Everyone in it, head included, each once. */
  readonly size: number;
  /** Pencils on its divisions and its Add division: its head, the team leader and full access. */
  readonly divisionsEditable: boolean;
  readonly divisions: readonly StructureDivision[];
};

export type TeamStructure = {
  readonly leader: StructurePerson | null;
  /** The department pencils and Add department (board 77b): the team leader and full access only, never a head (66t-b). */
  readonly departmentsEditable: boolean;
  readonly departments: readonly StructureDepartment[];
  /** The code of every open division of the team: a division code is unique among them (#232). */
  readonly takenCodes: readonly { readonly id: number; readonly name: string; readonly code: string | null }[];
};

/** Whether the actor edits any structure at all: a division lead and a member get no Edit button (boards 77, 66t). */
export function editsStructure(actor: TeamActor | null): actor is Exclude<TeamActor, { kind: "lead" }> {
  return actor !== null && actor.kind !== "lead";
}

/**
 * Whether the Team tree shows the viewer its Edit button (boards 77 and 66t):
 * full access (the team leader, the operations lead, the IT lead) and a
 * department head. The data source answers who they act as
 * (`teamStructure`), and the server checks every write again.
 */
export function showsTreeEdit(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead" || viewer.kind === "department-head";
}

/** The divisions whose page the edit view needs: those the actor may change. */
export function editableDivisionIds(actor: TeamActor | null, org: OrgChart): number[] {
  if (!editsStructure(actor)) return [];
  return org.divisions.filter((d) => mayManageDivisionsIn(actor, d.departmentId)).map((d) => d.id);
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
  readonly waiting: Readonly<Record<number, readonly WaitingPerson[]>>;
  readonly joining: Readonly<Record<number, readonly Joining[]>>;
  readonly openPositions: Readonly<Record<number, number>>;
}): TeamStructure | null {
  const { records, org, actor } = input;
  if (!editsStructure(actor)) return null;
  const person = (r: PersonRecord): StructurePerson => ({ id: r.id, name: r.name });
  const leader = records.find((r) => r.beyondDivisions.some((b) => b.kind === "team-leader"));

  const departments = org.departments.map((department): StructureDepartment => {
    const head = records.find((r) => r.beyondDivisions.some((b) => b.kind === "head" && b.departmentId === department.id));
    const editable = mayManageDivisionsIn(actor, department.id);
    const own = org.divisions.filter((d) => d.departmentId === department.id);
    const inDepartment = new Set<number>();
    const divisions = own.map((division): StructureDivision => {
      const people = records.filter((r) => roleIn(r.memberships, division.id) !== null);
      for (const p of people) if (p.id !== head?.id) inDepartment.add(p.id);
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
        page: editable
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
      };
    });
    const headDivisions = head
      ? head.memberships.flatMap((m) => {
          const division = org.divisions.find((d) => d.id === m.divisionId);
          return division ? [divisionLabel(division.name)] : [];
        })
      : [];
    return {
      id: department.id,
      name: department.name,
      code: department.code ?? null,
      head: head ? { ...person(head), divisions: headDivisions } : null,
      size: (head ? 1 : 0) + inDepartment.size,
      divisionsEditable: editable,
      divisions,
    };
  });

  return {
    leader: leader ? person(leader) : null,
    departmentsEditable: mayManageDepartments(actor),
    departments,
    takenCodes: org.divisions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null })),
  };
}
