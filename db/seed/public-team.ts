// This year's team as the site already publishes it (issue #326): every
// person lib/about/team.ts names, with the role, department or division and
// public photo and LinkedIn it gives them, as the seed's roles. The people
// seed (./people.ts) adds their invented private fields.
//
// team.ts places everyone but its core members. A leader on its arc titled
// "Head of" a seeded department heads it: the head of R&D, a department with
// no divisions (issue #627). A core member's division is
// invented from their role ("Aerodynamicist" sits in Optimization and
// Analysis), so the dashboard's division pages have people in them; the
// title is the one team.ts gives. Ids: the leaders, heads and leads take the
// ones in LEADING_IDS, which the other seed modules name; a core member is
// 100 plus their place in team.ts's core list.

import { team } from "@/lib/about/team";
import { DEPARTMENT_ROWS, DIVISION, DIVISION_ROWS } from "./structure";

/** A role as team.ts gives it: a title in a department, a division, or neither. */
export type PublicRole = {
  readonly title: string;
  readonly type: "president" | "core" | "head" | "lead";
  readonly deptId: number | null;
  readonly divisionId: number | null;
};

/** Someone on this year's team, with what team.ts publishes about them. */
export type PublicTeammate = {
  readonly memberId: number;
  readonly name: string;
  readonly photo: string | null;
  /** The handle after linkedin.com/in/, as team.ts holds it. */
  readonly linkedin: string | null;
  readonly roles: readonly PublicRole[];
};

/** The member id of everyone team.ts places above the core list. */
const LEADING_IDS: Readonly<Record<string, number>> = {
  "Andrea Pantano": 1,
  "Marco Delogu": 2,
  "Rocco Bellon": 3,
  "Emir Topakci": 4,
  "Alessandro Rabino": 5,
  "Daniele Brero": 6,
  "Alessandro Giacobetti": 7,
  "Michele Rossetto": 8,
  "Marco Dona": 9,
  "Samuele Lombardi": 10,
  "Huseyin Gulec": 11,
  "Fabio Zeloni": 12,
  "Maria Angelica Fullone Penna": 13,
  "Stefano Campagnolo": 14,
  "Giovanni Tomasi": 15,
  "Ludovica Cassella": 16,
  "Rocco Donnola": 17,
  "Nicola Montagner": 18,
  "Giorgio Montese": 19,
  "Samuele Martello": 20,
  "Arda Bildik": 21,
  "Luca Beccaria": 22,
  "Ettore De Bartolo": 23,
  "Asmaa Jamai": 24,
  "Riccardo Savio": 52,
  "Andrea Manzo": 53,
};

/** A core member's first id: the core list's first name is 100. */
const FIRST_CORE_ID = 100;

const D = DIVISION;

/** The division a core member's role sits in (invented: team.ts names none). An empty role is "". */
const CORE_DIVISION: Readonly<Record<string, number>> = {
  "": D.liquidSystems,
  "Propulsion Engineer": D.liquidSystems,
  "Feed System Engineer": D.liquidSystems,
  "Valves & Pipelines Engineer": D.liquidSystems,
  "Cryogenic System Engineer": D.liquidSystems,
  "Mechanical/Propulsion Engineer": D.liquidSystems,
  "Ignition System Engineer": D.thrustChamber,
  "Test Engineer": D.testBench,
  "Design & Manufacturing Engineer": D.designManufacturing,
  "Design & Additive Manufacturing Engineer": D.designManufacturing,
  "Structural Engineer": D.structuralAnalysis,
  "Mission Analyst": D.missionAnalysis,
  Aerodynamicist: D.optimization,
  "Recovery Engineer": D.recoverySystems,
  "Control Systems Engineer": D.flightControl,
  "Hardware Engineer": D.hardware,
  "Electronics Engineer": D.hardware,
  "Embedded Software Engineer": D.firmware,
  "RF Specialist": D.groundStation,
  "Safety Officer": D.safety,
  "Test & Mission Support Specialist": D.safety,
  "Sponsoring Specialist": D.communications,
  "Software Engineer": D.informationTechnology,
  "Full Stack Developer": D.informationTechnology,
  "Desktop App Developer": D.informationTechnology,
};

/** The short names team.ts gives a seeded department: "Head of R&D" heads Research and Development (issue #600). */
const SHORT_DEPARTMENT_NAMES: Readonly<Record<string, string>> = { "R&D": "Research and Development" };

/** The seeded department a "Head of <name>" role heads; null for any other role. */
function departmentNamedBy(role: string): number | null {
  if (!role.startsWith("Head of ")) return null;
  const short = role.slice("Head of ".length);
  const name = SHORT_DEPARTMENT_NAMES[short] ?? short;
  return DEPARTMENT_ROWS.rows.find((d) => d.name === name)?.id ?? null;
}

function departmentHeaded(role: string): number {
  const id = departmentNamedBy(role);
  if (id === null) throw new Error(`no seeded department for "${role}" in lib/about/team.ts`);
  return id;
}

type Division = { readonly id: number; readonly deptId: number };

function divisionWhere(match: (row: (typeof DIVISION_ROWS.rows)[number]) => boolean, what: string): Division {
  const row = DIVISION_ROWS.rows.find((d) => d.closedAt == null && match(d));
  if (row?.id == null || row.deptId == null) throw new Error(`no open seeded division ${what}`);
  return { id: row.id, deptId: row.deptId };
}

const divisionNamed = (name: string) => divisionWhere((d) => d.name === name, `named "${name}" in lib/about/team.ts`);

type Draft = { name: string; photo: string | null; linkedin: string | null; roles: PublicRole[]; memberId: number };

function publicTeam(): PublicTeammate[] {
  const byName = new Map<string, Draft>();
  const coreRole = new Map(team.coreMembers.members.map((m) => [m.name, m.role ?? ""]));

  const add = (person: { name: string; photo?: string; linkedin?: string }, role: PublicRole, coreIndex?: number) => {
    const known = byName.get(person.name);
    if (known !== undefined) {
      known.photo ??= person.photo ?? null;
      known.linkedin ??= person.linkedin ?? null;
      if (!known.roles.some((r) => r.type === role.type && r.deptId === role.deptId && r.divisionId === role.divisionId)) known.roles.push(role);
      return;
    }
    const memberId = LEADING_IDS[person.name] ?? (coreIndex === undefined ? undefined : FIRST_CORE_ID + coreIndex);
    if (memberId === undefined) throw new Error(`no member id for ${person.name}: add them to LEADING_IDS`);
    byName.set(person.name, { name: person.name, photo: person.photo ?? null, linkedin: person.linkedin ?? null, roles: [role], memberId });
  };

  // A lead listed among the core members too keeps the role that list gives them.
  const leadOf = (name: string, division: string): PublicRole => {
    const { id, deptId } = divisionNamed(division);
    return { title: coreRole.get(name) || `${division} Lead`, type: "lead", deptId, divisionId: id };
  };

  const { leader, leaders } = team.orgChart;
  add(leader, { title: leader.role, type: "president", deptId: null, divisionId: null });
  const heads = new Set(team.departments.groups.flatMap((g) => g.members.flatMap((m) => (m.kind === "head" ? [m.name] : []))));
  for (const l of leaders) {
    // A head is placed by the Departments section below.
    if (heads.has(l.name)) continue;
    // The head of a department with no divisions, which the Departments section does not list: "Head of R&D" (issue #627).
    const headed = departmentNamedBy(l.role);
    // Otherwise a board seat, in no unit.
    add(l, { title: l.role, type: headed === null ? "core" : "head", deptId: headed, divisionId: null });
  }
  for (const group of team.departments.groups) {
    for (const member of group.members) {
      if (member.kind === "head") {
        add(member, { title: member.role, type: "head", deptId: departmentHeaded(member.role), divisionId: null });
        for (const lead of member.leads) add(lead, leadOf(lead.name, lead.division));
      } else {
        add(member, leadOf(member.name, member.division));
      }
    }
  }
  team.coreMembers.members.forEach((member, i) => {
    const placed = byName.get(member.name);
    if (placed !== undefined) {
      // Placed above, with the role this list gives as their lead title; keep a LinkedIn handle only this list holds.
      placed.linkedin ??= member.linkedin ?? null;
      return;
    }
    const title = member.role ?? "";
    const divisionId = CORE_DIVISION[title];
    if (divisionId === undefined) throw new Error(`no division for the core role "${title}": add it to CORE_DIVISION`);
    const { deptId } = divisionWhere((d) => d.id === divisionId, `with id ${divisionId}`);
    add(member, { title, type: "core", deptId, divisionId }, i);
  });
  return [...byName.values()].sort((a, b) => a.memberId - b.memberId);
}

export const PUBLIC_TEAM: readonly PublicTeammate[] = publicTeam();

/** The member id team.ts's person seeds as; throws for a name it does not hold. */
export function publicMember(name: string): number {
  const person = PUBLIC_TEAM.find((p) => p.name === name);
  if (person === undefined) throw new Error(`lib/about/team.ts names no one called ${name}`);
  return person.memberId;
}
