// The people-and-roles seed (issue #304): every person with a `users` row,
// their member rows, every role they hold or held, and the local testers'
// sign-in rows (issue #129). Member ids 2–38 and the applicants' user ids
// keep the numbers the old SQL seed used; the orders and recruitment modules
// name people by them.
//
// Who holds what now: a team leader; a Project Manager and a Chief Engineer,
// the two board seats (issue #311); an operations lead and an IT lead (the
// two flagged seats, issue #238); department heads; division leads; members,
// some in two divisions; an advisor in a division and a team-level advisor,
// the former team leader (issue #253). Who left: people whose last role ended
// in each academic year from 2021–22 to 2025–26, the founders among them; the
// alumni seed (./alumni.ts) adds how they show on the Alumni page.

import { betterAuthUsers, members, roles, users } from "@/db/schema";
import { clearedUser, CLEARED_MEMBER } from "@/lib/dashboard/anonymize";
import { TESTERS } from "@/lib/dev-tester";
import { SEEDED_RENAMED_ALUMNUS, SEEDED_TEAM_LEADER, seedUserId } from "@/lib/test-viewer-people";
import { rowsOf, tableSeedModule, type SeedStatement } from "./rows";
import { DEPARTMENT, DIVISION } from "./structure";

type Level = "Bachelor" | "Master" | "PhD";

/** A person as the seed writes them: one `users` row, and a member row when `memberId` is set. */
type Person = {
  readonly userId: string;
  readonly memberId: number | null;
  readonly first: string;
  readonly last: string;
  readonly level: Level;
  readonly program: string;
  /** The day their account was made and, for a member, their NDA was signed. */
  readonly joined: string;
  /** For someone moved to alumni (issue #172): the years their lead gave. */
  readonly team?: { readonly from: number; readonly to: number };
};

/** "Nicolò De Santis" gives "nicolo.de.santis". */
function handleOf(first: string, last: string): string {
  return `${first} ${last}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .join(".");
}

function at(day: string): string {
  return `${day} 10:00:00+00`;
}

function teammate(
  memberId: number,
  userId: string,
  first: string,
  last: string,
  level: Level,
  program: string,
  joined: string,
  team?: Person["team"],
): Person {
  return { userId, memberId, first, last, level, program, joined, team };
}

function applicant(userId: string, first: string, last: string, level: Level, program: string, joined: string): Person {
  return { userId, memberId: null, first, last, level, program, joined };
}

/** The team leader since 2025–26. */
export const TEAM_LEADER = SEEDED_TEAM_LEADER;
/** Team leader 2023–24 and 2024–25, then an advisor of the whole team. */
export const FORMER_TEAM_LEADER = 40;
/** Founder and team leader 2021–22 and 2022–23. */
export const FOUNDER = 41;
/** Co-founder and first head of Propulsion, 2021–22. */
export const CO_FOUNDER = 42;
/** Led Liquid Systems Architecture in 2021–22, then stayed as its advisor. */
export const DIVISION_ADVISOR = 43;
/** Left in 2023–24; their Alumni entry is hidden. */
export const HIDDEN_ALUMNUS = 47;
/** Left in 2024–25, deleted their account, and was anonymized a year later. */
export const ANONYMIZED_ALUMNUS = 48;
/** Left in 2025–26 and asked to be removed from the Alumni page. */
export const REMOVED_ALUMNUS = 49;
/** Left in 2024–25; an editor fixed the name the Alumni page shows. */
export const RENAMED_ALUMNUS = SEEDED_RENAMED_ALUMNUS;
/** Took over Liquid Systems Architecture from the division advisor by a hand-over sent from My profile (./hand-overs.ts). */
export const LSA_SUCCESSOR = 16;
/** The day that hand-over was confirmed: the advisor's lead row ends and their Advisor role starts. */
export const LSA_HAND_OVER_DAY = "2022-09-30";
/** Head of Propulsion since 2022–23; confirmed that hand-over. */
export const PROPULSION_HEAD = 2;
/** The Optimization and Analysis lead's hand-over to a member of the division, waiting for the head of Aerodynamics. */
export const WAITING_HAND_OVER = { from: 20, to: 29 } as const;
/** A member of two divisions at once. */
export const TWO_DIVISION_MEMBER = 15;
/** The IT lead's seat (issue #238). */
export const IT_LEAD = 11;
/** The two board seats beside the team leader (board 54c), which the Team page draws on its arc (issue #311). */
export const PROJECT_MANAGER = 52;
export const CHIEF_ENGINEER = 53;

export const PEOPLE: readonly Person[] = [
  teammate(TEAM_LEADER, seedUserId(1), "Aurora", "Galli", "Master", "Aerospace Engineering", "2022-09-01"),
  teammate(2, "22222222-2222-2222-2222-222222222222", "Giulia", "Ferrari", "Bachelor", "Electronic Engineering", "2022-09-01"),
  teammate(3, "33333333-3333-3333-3333-333333333333", "Alessandro", "Russo", "PhD", "Mechanical Engineering", "2022-09-01"),
  teammate(4, "44444444-4444-4444-4444-444444444444", "Valentina", "Esposito", "Master", "Management Engineering", "2022-09-01"),
  teammate(5, "55555555-5555-5555-5555-555555555555", "Luca", "Bianchi", "Bachelor", "Computer Science", "2022-09-01"),
  teammate(6, "66666666-6666-6666-6666-666666666666", "Sofia", "Ricci", "Master", "Data Science", "2022-09-01"),
  teammate(7, "77777777-7777-7777-7777-777777777777", "Matteo", "Conti", "Bachelor", "Electronic Engineering", "2022-09-15"),
  teammate(8, "88888888-8888-8888-8888-888888888888", "Elena", "Martini", "Master", "Architecture", "2022-09-01"),
  teammate(9, "99999999-9999-9999-9999-999999999999", "Andrea", "Gallo", "PhD", "Mechanical Engineering", "2022-09-15"),
  teammate(10, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "Francesca", "Leone", "Bachelor", "Energy Engineering", "2022-09-01"),
  teammate(IT_LEAD, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "Simone", "Lombardi", "Master", "Computer Engineering", "2022-09-15"),
  teammate(12, "cccccccc-cccc-cccc-cccc-cccccccccccc", "Claudia", "Marino", "Bachelor", "Biomedical Engineering", "2022-09-01"),
  teammate(13, "11111111-1111-1111-1111-111111111111", "Marco", "Rossi", "Master", "Computer Engineering", "2022-09-15"),
  teammate(14, "1a111111-1111-1111-1111-111111111111", "Giovanni", "Bruno", "Master", "Propulsion Engineering", "2022-09-15"),
  teammate(TWO_DIVISION_MEMBER, "1a222222-2222-2222-2222-222222222222", "Martina", "Costa", "Bachelor", "Chemical Engineering", "2022-09-15"),
  teammate(16, "1a333333-3333-3333-3333-333333333333", "Federico", "Romano", "Master", "Propulsion Engineering", "2022-09-15"),
  teammate(17, "1a444444-4444-4444-4444-444444444444", "Alice", "Fontana", "PhD", "Mechanical Engineering", "2022-09-15"),
  teammate(18, "1a555555-5555-5555-5555-555555555555", "Lorenzo", "Sala", "Master", "Structural Engineering", "2022-09-15"),
  teammate(19, "1a666666-6666-6666-6666-666666666666", "Beatrice", "Moro", "Bachelor", "Aerospace Engineering", "2022-09-15"),
  teammate(20, "1a777777-7777-7777-7777-777777777777", "Tommaso", "Ferrari", "Master", "Aerospace Engineering", "2022-09-15"),
  teammate(21, "1a888888-8888-8888-8888-888888888888", "Sara", "Barbieri", "PhD", "Operations Management", "2022-09-15"),
  teammate(22, "1a999999-9999-9999-9999-999999999999", "Nicolò", "Benedetti", "Master", "Computer Engineering", "2022-09-15"),
  teammate(23, "1b111111-1111-1111-1111-111111111111", "Camilla", "De Santis", "Bachelor", "Computer Science", "2022-09-15"),
  teammate(24, "1b222222-2222-2222-2222-222222222222", "Riccardo", "Grassi", "Master", "Electronic Engineering", "2022-09-15"),
  teammate(25, "1b333333-3333-3333-3333-333333333333", "Anna", "Serra", "PhD", "Electronic Engineering", "2022-09-15"),
  teammate(26, "1b444444-4444-4444-4444-444444444444", "Manuel", "Vitale", "Master", "Control Systems Engineering", "2022-09-15"),
  teammate(27, "1b555555-5555-5555-5555-555555555555", "Jessica", "Monti", "Bachelor", "Aerospace Engineering", "2022-09-15"),
  teammate(28, "1b666666-6666-6666-6666-666666666666", "Antonio", "Palmieri", "Master", "Aerospace Engineering", "2022-09-15"),
  teammate(29, "1b777777-7777-7777-7777-777777777777", "Chiara", "Santoro", "PhD", "Computer Science", "2022-09-15"),
  teammate(30, "1b888888-8888-8888-8888-888888888888", "Marco", "Caruso", "Master", "Mechanical Engineering", "2022-09-15"),
  teammate(31, "1b999999-9999-9999-9999-999999999999", "Elena", "Moretti", "Bachelor", "Mechanical Engineering", "2022-09-15"),
  teammate(32, "1c111111-1111-1111-1111-111111111111", "Luca", "Pellegrini", "Master", "Propulsion Engineering", "2022-09-15"),
  teammate(33, "1c222222-2222-2222-2222-222222222222", "Sofia", "Greco", "PhD", "Chemical Engineering", "2022-09-15"),
  teammate(34, "1c333333-3333-3333-3333-333333333333", "Matteo", "Villa", "Master", "Propulsion Engineering", "2022-09-15"),
  teammate(35, "1c444444-4444-4444-4444-444444444444", "Giulia", "Longo", "Bachelor", "Chemical Engineering", "2022-09-15"),
  teammate(36, "1c555555-5555-5555-5555-555555555555", "Davide", "Rosso", "Master", "Communications Engineering", "2022-09-15"),
  teammate(37, "1c666666-6666-6666-6666-666666666666", "Laura", "Verde", "Bachelor", "Management Engineering", "2022-09-15"),
  teammate(38, "1c777777-7777-7777-7777-777777777777", "Gabriele", "Azzurro", "Master", "Computer Engineering", "2022-09-15"),
  teammate(PROJECT_MANAGER, seedUserId(PROJECT_MANAGER), "Davide", "Ferrero", "Master", "Management Engineering", "2023-09-15"),
  teammate(CHIEF_ENGINEER, seedUserId(CHIEF_ENGINEER), "Noemi", "Bellini", "Master", "Aerospace Engineering", "2023-09-15"),

  teammate(FORMER_TEAM_LEADER, seedUserId(40), "Paolo", "Neri", "Master", "Aerospace Engineering", "2021-09-20"),
  teammate(FOUNDER, seedUserId(41), "Giorgio", "Valli", "PhD", "Aerospace Engineering", "2021-09-15", { from: 2021, to: 2022 }),
  teammate(CO_FOUNDER, seedUserId(42), "Irene", "Fabbri", "Master", "Mechanical Engineering", "2021-09-15", { from: 2021, to: 2021 }),
  teammate(DIVISION_ADVISOR, seedUserId(43), "Chiara", "Benassi", "PhD", "Chemical Engineering", "2021-09-20"),
  teammate(44, seedUserId(44), "Fabio", "Greco", "Bachelor", "Mechanical Engineering", "2021-09-25", { from: 2021, to: 2021 }),
  teammate(45, seedUserId(45), "Ilaria", "Mancini", "Master", "Propulsion Engineering", "2021-09-25", { from: 2021, to: 2022 }),
  teammate(46, seedUserId(46), "Stefano", "Gatti", "Bachelor", "Chemical Engineering", "2022-09-20", { from: 2022, to: 2022 }),
  teammate(HIDDEN_ALUMNUS, seedUserId(47), "Roberta", "Sanna", "Master", "Aerospace Engineering", "2022-09-20", { from: 2022, to: 2023 }),
  teammate(ANONYMIZED_ALUMNUS, seedUserId(48), "Enrico", "Lodi", "Master", "Electronic Engineering", "2023-09-20", { from: 2023, to: 2024 }),
  teammate(REMOVED_ALUMNUS, seedUserId(49), "Valerio", "Costa", "Bachelor", "Cinema and Media Engineering", "2024-09-20", { from: 2024, to: 2025 }),
  teammate(RENAMED_ALUMNUS, seedUserId(50), "Giada", "Ferraris", "Master", "Management Engineering", "2023-09-20", { from: 2023, to: 2024 }),
  teammate(51, seedUserId(51), "Marta", "Rinaldi", "Bachelor", "Aerospace Engineering", "2024-09-20", { from: 2024, to: 2025 }),

  applicant("dddddddd-dddd-dddd-dddd-dddddddddddd", "Chiara", "Verdi", "Master", "Biomedical Engineering", "2023-03-05"),
  applicant("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "Davide", "Marino", "Bachelor", "Aerospace Engineering", "2023-03-10"),
  applicant("f1111111-1111-1111-1111-111111111111", "Lorenzo", "Bruno", "Master", "Communication Design", "2023-06-01"),
  applicant("f2222222-2222-2222-2222-222222222222", "Martina", "Bianchi", "Bachelor", "Cinema and Media Engineering", "2023-06-02"),
  applicant("f3333333-3333-3333-3333-333333333333", "Federico", "Neri", "Master", "Communications Engineering", "2023-06-03"),
  applicant("f4444444-4444-4444-4444-444444444444", "Alice", "Rossi", "PhD", "Computer Engineering", "2023-06-04"),
  applicant("f5555555-5555-5555-5555-555555555555", "Giovanni", "Villa", "Master", "Management Engineering", "2023-06-05"),
  applicant("f6666666-6666-6666-6666-666666666666", "Beatrice", "Conti", "Bachelor", "Event Management", "2023-06-06"),
  applicant("f7777777-7777-7777-7777-777777777777", "Tommaso", "Ricci", "Master", "Industrial Engineering", "2023-06-07"),
  applicant("f8888888-8888-8888-8888-888888888888", "Sara", "Galli", "PhD", "Safety Engineering", "2023-06-08"),
  applicant("f9999999-9999-9999-9999-999999999999", "Nicolò", "Mancini", "Master", "Computer Engineering", "2023-06-09"),
  applicant("1d111111-1111-1111-1111-111111111111", "Camilla", "Fabbri", "Bachelor", "Computer Science", "2023-06-10"),
  applicant("1d222222-2222-2222-2222-222222222222", "Riccardo", "Monti", "Master", "Electronic Engineering", "2023-06-11"),
  applicant("1d333333-3333-3333-3333-333333333333", "Anna", "Lucchesi", "PhD", "Electronic Engineering", "2023-06-12"),
  applicant("1d444444-4444-4444-4444-444444444444", "Manuel", "Testa", "Master", "Control Systems Engineering", "2023-06-13"),
  applicant("1d555555-5555-5555-5555-555555555555", "Jessica", "Orlando", "Bachelor", "Aerospace Engineering", "2023-06-14"),
  applicant("1d666666-6666-6666-6666-666666666666", "Antonio", "Marchetti", "Master", "Aerospace Engineering", "2023-06-15"),
  applicant("1d777777-7777-7777-7777-777777777777", "Chiara", "Milani", "PhD", "Computer Science", "2023-06-16"),
  applicant("1d888888-8888-8888-8888-888888888888", "Marco", "Bernardi", "Master", "Mechanical Engineering", "2023-06-17"),
  applicant("1d999999-9999-9999-9999-999999999999", "Elena", "Barone", "Bachelor", "Mechanical Engineering", "2023-06-18"),
  applicant("1e111111-1111-1111-1111-111111111111", "Luca", "Fiore", "Master", "Propulsion Engineering", "2023-06-19"),
  applicant("1e222222-2222-2222-2222-222222222222", "Sofia", "Colombo", "PhD", "Chemical Engineering", "2023-06-20"),
  applicant("1e333333-3333-3333-3333-333333333333", "Matteo", "Leone", "Master", "Propulsion Engineering", "2023-06-21"),
  applicant("1e444444-4444-4444-4444-444444444444", "Giulia", "Ferri", "Bachelor", "Chemical Engineering", "2023-06-22"),
];

/** When the anonymized alumnus closed their account, and when it was anonymized (issue #191). */
export const ANONYMIZED_ACCOUNT = {
  deletedAt: "2025-07-15T10:00:00.000Z",
  anonymizedAt: "2026-07-20T03:00:00.000Z",
} as const;

const TESTER_JOINED = "2026-10-09 10:00:00+02";
const TESTER_JOINED_AT = new Date("2026-10-09T10:00:00+02:00");

/** The local testers' member ids (issue #129): one per tester on the team. */
export const TESTER_MEMBER = {
  member: 901,
  "division-lead": 902,
  "operations-lead": 903,
  "department-head": 904,
} as const;

const TESTER_PEOPLE = [
  { memberId: TESTER_MEMBER.member, tester: TESTERS.member, first: "Tester", last: "Member", level: "Master", program: "Aerospace Engineering", politoId: "s900002" },
  { memberId: TESTER_MEMBER["division-lead"], tester: TESTERS["division-lead"], first: "Tester", last: "Division Lead", level: "Master", program: "Aerospace Engineering", politoId: "s900003" },
  { memberId: TESTER_MEMBER["operations-lead"], tester: TESTERS["operations-lead"], first: "Tester", last: "Operations Lead", level: "Master", program: "Management Engineering", politoId: "s900004" },
  { memberId: TESTER_MEMBER["department-head"], tester: TESTERS["department-head"], first: "Tester", last: "Department Head", level: "Master", program: "Aerospace Engineering", politoId: "s900005" },
] as const;

function memberRow(person: Person & { readonly memberId: number }) {
  const handle = handleOf(person.first, person.last);
  const row = {
    memberId: person.memberId,
    prtEmail: `${handle}@prt.it`,
    mobileNumber: `+39 3${String(person.memberId).padStart(9, "0")}`,
    discord: handle,
    ndaSignedAt: at(person.joined),
    ndaName: `${person.first} ${person.last}`,
    ndaConfirmedBy: TEAM_LEADER,
    picture: null,
    teamFrom: person.team?.from ?? null,
    teamTo: person.team?.to ?? null,
  };
  return person.memberId === ANONYMIZED_ALUMNUS ? { ...row, ...CLEARED_MEMBER } : row;
}

function userRow(person: Person) {
  const handle = handleOf(person.first, person.last);
  const row = {
    id: person.userId,
    email: `${handle}@example.com`,
    firstName: person.first,
    lastName: person.last,
    origin: "Italy",
    levelOfStudy: person.level,
    linkedin: `linkedin.com/in/${handle.replace(/\./g, "")}`,
    politoId: person.memberId === null ? null : `s${String(100000 + person.memberId)}`,
    program: person.program,
    member: person.memberId,
    createdAt: at(person.joined),
    updatedAt: null,
    access: ["drive", "wiki"],
    deletedAt: null,
    anonymizedAt: null,
  };
  if (person.memberId !== ANONYMIZED_ALUMNUS) return row;
  return { ...row, ...clearedUser(new Date(ANONYMIZED_ACCOUNT.anonymizedAt)), deletedAt: ANONYMIZED_ACCOUNT.deletedAt };
}

export const MEMBER_ROWS = rowsOf(members, [
  ...PEOPLE.flatMap((p) => (p.memberId === null ? [] : [memberRow({ ...p, memberId: p.memberId })])),
  ...TESTER_PEOPLE.map((t) => ({
    memberId: t.memberId,
    prtEmail: t.tester.email,
    discord: t.tester.email.split("@")[0],
    ndaSignedAt: TESTER_JOINED,
    ndaName: `${t.tester.name} NDA`,
    ndaConfirmedBy: TEAM_LEADER,
  })),
]);

export const USER_ROWS = rowsOf(users, [
  ...PEOPLE.map(userRow),
  {
    id: TESTERS.applicant.id,
    email: TESTERS.applicant.email,
    firstName: "Tester",
    lastName: "Applicant",
    origin: "Italy",
    levelOfStudy: "Bachelor",
    politoId: "s900001",
    program: "Aerospace Engineering",
    member: null,
    createdAt: TESTER_JOINED,
  },
  ...TESTER_PEOPLE.map((t) => ({
    id: t.tester.id,
    email: t.tester.email,
    firstName: t.first,
    lastName: t.last,
    origin: "Italy",
    levelOfStudy: t.level,
    politoId: t.politoId,
    program: t.program,
    member: t.memberId,
    createdAt: TESTER_JOINED,
  })),
]);

const { propulsion, structures, aerodynamics, recovery, controls, electronics, operations, research } = DEPARTMENT;
const D = DIVISION;

export const ROLE_ROWS = rowsOf(roles, [
  // Leadership: the founder, then the former team leader, then the team leader now.
  { memberId: FOUNDER, title: "Team Leader", startedAt: "2021-10-01", leavedAt: "2023-09-30", type: "president" },
  { memberId: FORMER_TEAM_LEADER, title: "Team Leader", startedAt: "2023-10-01", leavedAt: "2025-09-30", type: "president" },
  { memberId: FORMER_TEAM_LEADER, title: "Advisor", startedAt: "2025-10-01", type: "advisor" },
  { memberId: TEAM_LEADER, title: "Team Leader", startedAt: "2025-10-01", type: "president" },
  // The board seats: a role in no department or division whose title names the seat.
  { memberId: PROJECT_MANAGER, title: "Project Manager", startedAt: "2025-10-01", type: "core" },
  { memberId: CHIEF_ENGINEER, title: "Chief Engineer", startedAt: "2025-10-01", type: "core" },

  // Propulsion
  { memberId: CO_FOUNDER, deptId: propulsion, title: "Head of Propulsion", startedAt: "2021-10-01", leavedAt: "2022-09-09", type: "head" },
  { memberId: PROPULSION_HEAD, deptId: propulsion, title: "Head of Propulsion", startedAt: "2022-09-10", type: "head" },
  { memberId: 14, deptId: propulsion, divisionId: D.testBench, title: "Test Bench Lead", startedAt: "2022-09-20", type: "lead" },
  { memberId: TWO_DIVISION_MEMBER, deptId: propulsion, divisionId: D.testBench, title: "Test Operations Engineer", startedAt: "2022-09-25", type: "core" },
  { memberId: TWO_DIVISION_MEMBER, deptId: propulsion, divisionId: D.liquidSystems, title: "Feed Systems Engineer", startedAt: "2024-10-01", type: "core" },
  // The division advisor handed the lead over to LSA_SUCCESSOR from My profile.
  // Confirm ended the lead row and started the Advisor role on one day, and
  // made the successor's own row in the division the lead (./hand-overs.ts).
  { memberId: DIVISION_ADVISOR, deptId: propulsion, divisionId: D.liquidSystems, title: "LSA Lead Engineer", startedAt: "2021-10-01", leavedAt: LSA_HAND_OVER_DAY, type: "lead" },
  { memberId: DIVISION_ADVISOR, deptId: propulsion, divisionId: D.liquidSystems, title: "Advisor", startedAt: LSA_HAND_OVER_DAY, type: "advisor" },
  { memberId: FORMER_TEAM_LEADER, deptId: propulsion, divisionId: D.liquidSystems, title: "Valve Engineer", startedAt: "2021-10-01", leavedAt: "2023-09-30", type: "core" },
  { memberId: LSA_SUCCESSOR, deptId: propulsion, divisionId: D.liquidSystems, title: "LSA Lead Engineer", startedAt: "2022-09-15", type: "lead" },
  { memberId: 32, deptId: propulsion, divisionId: D.liquidSystems, title: "Feed Systems Engineer", startedAt: "2022-10-05", type: "core" },
  { memberId: 34, deptId: propulsion, divisionId: D.thrustChamber, title: "TCA Lead Engineer", startedAt: "2022-10-10", type: "lead" },
  { memberId: 35, deptId: propulsion, divisionId: D.thrustChamber, title: "Combustion Engineer", startedAt: "2022-10-15", type: "core" },
  { memberId: 45, deptId: propulsion, divisionId: D.hybridMotors, title: "Hybrid Motors Lead", startedAt: "2021-10-01", leavedAt: "2023-09-30", type: "lead" },
  { memberId: 46, deptId: propulsion, divisionId: D.hybridMotors, title: "Grain Casting Engineer", startedAt: "2022-10-01", leavedAt: "2023-06-30", type: "core" },

  // Structures
  { memberId: 4, deptId: structures, title: "Head of Structures", startedAt: "2022-09-10", type: "head" },
  { memberId: 17, deptId: structures, divisionId: D.designManufacturing, title: "Design & Manufacturing Lead", startedAt: "2022-09-20", type: "lead" },
  { memberId: 30, deptId: structures, divisionId: D.designManufacturing, title: "Manufacturing Engineer", startedAt: "2022-09-25", type: "core" },
  { memberId: 44, deptId: structures, divisionId: D.designManufacturing, title: "Composites Technician", startedAt: "2021-10-01", leavedAt: "2022-06-30", type: "core" },
  { memberId: 18, deptId: structures, divisionId: D.structuralAnalysis, title: "Structural Analysis Lead", startedAt: "2022-10-01", type: "lead" },
  { memberId: 31, deptId: structures, divisionId: D.structuralAnalysis, title: "FEA Specialist", startedAt: "2022-10-05", type: "core" },

  // Aerodynamics: the department-head tester heads it.
  { memberId: 19, deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Mission Analysis Lead", startedAt: "2022-09-20", leavedAt: "2025-09-30", type: "lead" },
  { memberId: 19, deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Trajectory Engineer", startedAt: "2025-10-01", type: "core" },
  { memberId: 28, deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Mission Analyst", startedAt: "2022-09-25", type: "core" },
  { memberId: HIDDEN_ALUMNUS, deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Flight Dynamics Engineer", startedAt: "2022-10-01", leavedAt: "2024-07-31", type: "core" },
  { memberId: WAITING_HAND_OVER.from, deptId: aerodynamics, divisionId: D.optimization, title: "Optimization Lead", startedAt: "2022-10-01", type: "lead" },
  { memberId: WAITING_HAND_OVER.to, deptId: aerodynamics, divisionId: D.optimization, title: "Analysis Software Engineer", startedAt: "2022-10-05", type: "core" },

  // Recovery
  { memberId: 8, deptId: recovery, title: "Head of Recovery", startedAt: "2022-09-10", type: "head" },
  { memberId: 27, deptId: recovery, divisionId: D.recovery, title: "Recovery Lead Engineer", startedAt: "2022-09-20", type: "lead" },
  { memberId: 21, deptId: recovery, divisionId: D.recovery, title: "Parachute Systems Engineer", startedAt: "2022-09-25", type: "core" },
  { memberId: 51, deptId: recovery, divisionId: D.recovery, title: "Recovery Test Engineer", startedAt: "2024-10-01", leavedAt: "2026-03-31", type: "core" },

  // Controls and Systems
  { memberId: 10, deptId: controls, title: "Head of Controls", startedAt: "2022-09-10", type: "head" },
  { memberId: 26, deptId: controls, divisionId: D.flightControl, title: "Flight Control Lead", startedAt: "2022-09-20", type: "lead" },
  { memberId: 22, deptId: controls, divisionId: D.flightControl, title: "GNC Engineer", startedAt: "2022-09-25", type: "core" },
  { memberId: 23, deptId: controls, divisionId: D.engineControl, title: "Engine Control Lead", startedAt: "2022-10-01", type: "lead" },
  { memberId: 24, deptId: controls, divisionId: D.engineControl, title: "Systems Integration Engineer", startedAt: "2022-10-05", type: "core" },

  // Electronics
  { memberId: 12, deptId: electronics, title: "Head of Electronics", startedAt: "2022-09-10", type: "head" },
  { memberId: 33, deptId: electronics, divisionId: D.groundStation, title: "Ground Station Lead", startedAt: "2022-09-20", type: "lead" },
  { memberId: 36, deptId: electronics, divisionId: D.groundStation, title: "RF Systems Engineer", startedAt: "2022-09-25", type: "core" },
  { memberId: 37, deptId: electronics, divisionId: D.firmware, title: "Firmware Lead", startedAt: "2022-10-01", type: "lead" },
  { memberId: 38, deptId: electronics, divisionId: D.firmware, title: "Embedded Software Engineer", startedAt: "2022-10-05", type: "core" },
  { memberId: ANONYMIZED_ALUMNUS, deptId: electronics, divisionId: D.firmware, title: "Bootloader Engineer", startedAt: "2023-10-01", leavedAt: "2025-06-30", type: "core" },
  { memberId: 13, deptId: electronics, divisionId: D.hardware, title: "Hardware Lead Engineer", startedAt: "2022-10-10", type: "lead" },
  { memberId: 2, deptId: electronics, divisionId: D.hardware, title: "PCB Design Engineer", startedAt: "2022-10-15", type: "core" },
  { memberId: 25, deptId: electronics, divisionId: D.hardware, title: "Avionics Engineer", startedAt: "2022-10-20", type: "core" },

  // Operations: the operations-lead tester holds the operations lead's seat.
  { memberId: 3, deptId: operations, title: "Head of Operations", startedAt: "2022-09-10", type: "head" },
  { memberId: 5, deptId: operations, divisionId: D.safety, title: "Safety Officer", startedAt: "2022-09-20", type: "lead" },
  { memberId: 6, deptId: operations, divisionId: D.safety, title: "Safety Engineer", startedAt: "2022-09-25", type: "core" },
  { memberId: 7, deptId: operations, divisionId: D.logistics, title: "Logistics Lead", startedAt: "2022-10-01", type: "lead" },
  { memberId: 8, deptId: operations, divisionId: D.logistics, title: "Supply Chain Coordinator", startedAt: "2022-10-05", type: "core" },
  { memberId: RENAMED_ALUMNUS, deptId: operations, divisionId: D.logistics, title: "Procurement Coordinator", startedAt: "2023-10-01", leavedAt: "2025-09-30", type: "core" },
  { memberId: 9, deptId: operations, divisionId: D.communications, title: "Communications Lead", startedAt: "2022-10-10", type: "lead" },
  { memberId: 10, deptId: operations, divisionId: D.communications, title: "Media Specialist", startedAt: "2022-10-15", type: "core" },
  { memberId: REMOVED_ALUMNUS, deptId: operations, divisionId: D.communications, title: "Video Editor", startedAt: "2024-10-01", leavedAt: "2026-06-30", type: "core" },
  { memberId: IT_LEAD, deptId: operations, divisionId: D.informationTechnology, title: "IT Lead", startedAt: "2022-10-20", type: "lead", fullAccess: "it_lead" },
  { memberId: 12, deptId: operations, divisionId: D.informationTechnology, title: "Software Developer", startedAt: "2022-10-25", type: "core" },

  // Research and Development: Payload Integration has nobody yet.
  { memberId: 6, deptId: research, title: "Head of Research and Development", startedAt: "2023-09-10", type: "head" },

  // The local testers (issue #129).
  { memberId: TESTER_MEMBER.member, deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Mission Analysis Engineer", startedAt: "2025-10-01", type: "core" },
  { memberId: TESTER_MEMBER["division-lead"], deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Mission Analysis Lead", startedAt: "2025-10-01", type: "lead" },
  { memberId: TESTER_MEMBER["operations-lead"], deptId: operations, title: "Operations Lead", startedAt: "2025-10-01", type: "lead", fullAccess: "operations_lead" },
  { memberId: TESTER_MEMBER["department-head"], deptId: aerodynamics, title: "Head of Aerodynamics", startedAt: "2025-10-01", type: "head" },
]);

/** The testers' sign-in rows; the `sync_auth_users` trigger links each to its `users` row by id. */
export const TESTER_AUTH_ROWS = rowsOf(betterAuthUsers, [
  ...[TESTERS.applicant, ...TESTER_PEOPLE.map((t) => t.tester)].map((tester) => ({
    id: tester.id,
    email: tester.email,
    name: tester.name,
    emailVerified: true,
    createdAt: TESTER_JOINED_AT,
    updatedAt: TESTER_JOINED_AT,
  })),
]);

/** Matches every tester's sign-in row, by id or email, so the reset removes stale ones too. */
export const TESTER_AUTH_RESET: SeedStatement = {
  sql: `DELETE FROM better_auth."user" WHERE id LIKE '7e57e500-0000-4000-8000-00000000000_' OR email LIKE '%.tester@example.com'`,
  params: [],
};

/**
 * The `sync_auth_users` trigger set each tester's `users.updated_at` to now
 * when their sign-in row went in; this sets it back to a fixed time so a
 * second run leaves the same rows.
 */
export const TESTER_UPDATED_AT_FIX: SeedStatement = {
  sql: `UPDATE users SET updated_at = '${TESTER_JOINED}'::timestamptz WHERE id LIKE '7e57e500-0000-4000-8000-00000000000_'`,
  params: [],
};

/** The seeded person each test viewer is (lib/test-viewer-people.ts), which the app reads too. */
export { TEST_VIEWER_PEOPLE } from "@/lib/test-viewer-people";

export const people = tableSeedModule({
  name: "people",
  owns: [members, users, roles],
  // Only the testers' sign-in rows: a developer's own account stays.
  keyed: [{ table: betterAuthUsers, reset: TESTER_AUTH_RESET }],
  rows: [MEMBER_ROWS, USER_ROWS, ROLE_ROWS, TESTER_AUTH_ROWS],
  afterInsert: [TESTER_UPDATED_AT_FIX],
});
