// The people-and-roles seed (issues #304, #326): every person with a `users`
// row, their member rows, every role they hold or held, and the local
// testers' sign-in rows (issue #129).
//
// This year's team is the one the site publishes (./public-team.ts, from
// lib/about/team.ts): its names, roles, units, photos and LinkedIn handles.
// What the site does not publish is invented for everyone: emails on
// reserved test domains, phone numbers, PoliTo ids, study programmes and the
// day each person joined. The public data holds no history, so the people
// who left and the two advisors whose roles carry one are invented: a former
// team leader who now advises the whole team (issue #253), a former lead who
// stayed as an advisor in their division, and people whose last role ended
// in each academic year from 2021–22 to 2025–26. The alumni seed
// (./alumni.ts) adds how they show on the Alumni page. The local testers
// take seats lib/about/team.ts leaves empty: the Test Bench lead and the
// head of Research and Development. The applicants' user ids keep the numbers the old SQL seed used;
// the recruitment module names them.

import { betterAuthUsers, members, roles, users } from "@/db/schema";
import { clearedUser, CLEARED_MEMBER } from "@/lib/dashboard/anonymize";
import { TESTERS } from "@/lib/dev-tester";
import { SEEDED_DEPARTMENT_HEAD, SEEDED_RENAMED_ALUMNUS, SEEDED_TEAM_LEADER, seedUserId } from "@/lib/test-viewer-people";
import { PUBLIC_TEAM, publicMember, type PublicTeammate } from "./public-team";
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
  /** What the site publishes about them (lib/about/team.ts); null for an invented person. */
  readonly photo: string | null;
  readonly linkedin: string | null;
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

/** An invented member. */
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
  return { userId, memberId, first, last, level, program, joined, team, photo: null, linkedin: null };
}

function applicant(userId: string, first: string, last: string, level: Level, program: string, joined: string): Person {
  return { userId, memberId: null, first, last, level, program, joined, photo: null, linkedin: null };
}

/** The day this year's roles start: the site publishes no start days, so every public role starts on it. */
export const PUBLIC_ROLES_START = "2025-10-01";
/** The day each public person's account was made (invented). */
const PUBLIC_JOINED = "2025-09-20";

/** Invented levels and programmes, handed out by member id. */
const INVENTED_STUDIES: readonly (readonly [Level, string])[] = [
  ["Master", "Aerospace Engineering"],
  ["Bachelor", "Aerospace Engineering"],
  ["Master", "Mechanical Engineering"],
  ["Bachelor", "Computer Engineering"],
  ["Master", "Electronic Engineering"],
];

/** A public person, split after their first name, with invented studies. */
function publicPerson(p: PublicTeammate): Person {
  const [first, ...rest] = p.name.split(" ");
  const [level, program] = INVENTED_STUDIES[p.memberId % INVENTED_STUDIES.length];
  return {
    userId: seedUserId(p.memberId),
    memberId: p.memberId,
    first,
    last: rest.join(" "),
    level,
    program,
    joined: PUBLIC_JOINED,
    photo: p.photo,
    linkedin: p.linkedin,
  };
}

/** The team leader (lib/about/team.ts). */
export const TEAM_LEADER = SEEDED_TEAM_LEADER;
/** Invented: team leader 2023–24 and 2024–25, then an advisor of the whole team. */
export const FORMER_TEAM_LEADER = 40;
/** Invented: the first head of Structures, 2021–22 and 2022–23. */
export const FIRST_STRUCTURES_HEAD = 41;
/** Invented: the first head of Propulsion, 2021–22. */
export const FIRST_PROPULSION_HEAD = 42;
/** Invented: led Liquid System Architecture until the start of this year, then stayed as its advisor. */
export const DIVISION_ADVISOR = 43;
/** Invented: left in 2023–24; their Alumni entry is hidden. */
export const HIDDEN_ALUMNUS = 47;
/** Invented: left in 2024–25, deleted their account, and was anonymized a year later. */
export const ANONYMIZED_ALUMNUS = 48;
/** Invented: left in 2025–26 and asked to be removed from the Alumni page. */
export const REMOVED_ALUMNUS = 49;
/** Invented: left in 2024–25; an editor fixed the name the Alumni page shows. */
export const RENAMED_ALUMNUS = SEEDED_RENAMED_ALUMNUS;
/** Invented: joined through an application in 2022 (./recruitment.ts) and left in 2023–24. */
export const JOINED_MEMBER = 32;
/** Leads Liquid System Architecture (lib/about/team.ts); took it over from the division advisor by a hand-over (./hand-overs.ts). */
export const LSA_SUCCESSOR = publicMember("Samuele Lombardi");
/** The day that hand-over was confirmed: the advisor's lead row ends and their Advisor role starts. */
export const LSA_HAND_OVER_DAY = "2025-10-10";
/** Head of Propulsion (lib/about/team.ts): confirmed that hand-over, answers the waiting one, and is the department-head test viewer. */
export const PROPULSION_HEAD = publicMember("Marco Delogu");
/** Heads Structures and leads both its divisions (lib/about/team.ts): a member of two divisions at once. */
export const TWO_DIVISION_MEMBER = publicMember("Emir Topakci");
/** The IT lead's seat (issue #238): the Information Technology lead in lib/about/team.ts. */
export const IT_LEAD = publicMember("Huseyin Gulec");
/** The two board seats beside the team leader (board 54c), which the Team page draws on its arc (issue #311). */
export const PROJECT_MANAGER = publicMember("Riccardo Savio");
export const CHIEF_ENGINEER = publicMember("Andrea Manzo");

if (PROPULSION_HEAD !== SEEDED_DEPARTMENT_HEAD) throw new Error("the department-head test viewer is not the head of Propulsion");

/** The people the site publishes, then the invented ones, then the applicants. */
export const PEOPLE: readonly Person[] = [
  ...PUBLIC_TEAM.map(publicPerson),

  teammate(FORMER_TEAM_LEADER, seedUserId(40), "Paolo", "Neri", "Master", "Aerospace Engineering", "2021-09-20"),
  teammate(FIRST_STRUCTURES_HEAD, seedUserId(41), "Giorgio", "Valli", "PhD", "Aerospace Engineering", "2021-09-15", { from: 2021, to: 2022 }),
  teammate(FIRST_PROPULSION_HEAD, seedUserId(42), "Irene", "Fabbri", "Master", "Mechanical Engineering", "2021-09-15", { from: 2021, to: 2021 }),
  teammate(DIVISION_ADVISOR, seedUserId(43), "Chiara", "Benassi", "PhD", "Chemical Engineering", "2021-09-20"),
  teammate(44, seedUserId(44), "Fabio", "Greco", "Bachelor", "Mechanical Engineering", "2021-09-25", { from: 2021, to: 2021 }),
  teammate(45, seedUserId(45), "Ilaria", "Mancini", "Master", "Propulsion Engineering", "2021-09-25", { from: 2021, to: 2022 }),
  teammate(46, seedUserId(46), "Stefano", "Gatti", "Bachelor", "Chemical Engineering", "2022-09-20", { from: 2022, to: 2022 }),
  teammate(HIDDEN_ALUMNUS, seedUserId(47), "Roberta", "Sanna", "Master", "Aerospace Engineering", "2022-09-20", { from: 2022, to: 2023 }),
  teammate(ANONYMIZED_ALUMNUS, seedUserId(48), "Enrico", "Lodi", "Master", "Electronic Engineering", "2023-09-20", { from: 2023, to: 2024 }),
  teammate(REMOVED_ALUMNUS, seedUserId(49), "Valerio", "Costa", "Bachelor", "Cinema and Media Engineering", "2024-09-20", { from: 2024, to: 2025 }),
  teammate(RENAMED_ALUMNUS, seedUserId(50), "Giada", "Ferraris", "Master", "Management Engineering", "2023-09-20", { from: 2023, to: 2024 }),
  teammate(51, seedUserId(51), "Marta", "Rinaldi", "Bachelor", "Aerospace Engineering", "2024-09-20", { from: 2024, to: 2025 }),
  teammate(JOINED_MEMBER, "1c111111-1111-1111-1111-111111111111", "Luca", "Pellegrini", "Master", "Propulsion Engineering", "2022-09-10", { from: 2022, to: 2023 }),

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

/** The domains the seed's invented emails sit on: reserved for examples, so no mail reaches anyone. */
export const SEED_EMAIL_DOMAIN = "example.com";
export const SEED_TEAM_EMAIL_DOMAIN = "prt.example.com";

/**
 * The members the alias seed (./aliases.ts) asks an email alias for: their
 * PRT email is empty, since the alias is saved there once it is created
 * (issue #563). One request is open, one the site made by itself, one was
 * declined.
 */
export const OWED_ALIAS = {
  open: publicMember("Dimitri Mazzone"),
  automatic: publicMember("Maria Angelica Fullone Penna"),
  declined: publicMember("Margherita Boatto"),
} as const;
const OWED_ALIAS_MEMBERS: ReadonlySet<number> = new Set(Object.values(OWED_ALIAS));

function memberRow(person: Person & { readonly memberId: number }) {
  const handle = handleOf(person.first, person.last);
  const row = {
    memberId: person.memberId,
    prtEmail: OWED_ALIAS_MEMBERS.has(person.memberId) ? null : `${handle}@${SEED_TEAM_EMAIL_DOMAIN}`,
    mobileNumber: `+39 3${String(person.memberId).padStart(9, "0")}`,
    discord: handle,
    ndaSignedAt: at(person.joined),
    ndaName: `${person.first} ${person.last}`,
    ndaConfirmedBy: TEAM_LEADER,
    picture: person.photo,
    teamFrom: person.team?.from ?? null,
    teamTo: person.team?.to ?? null,
  };
  return person.memberId === ANONYMIZED_ALUMNUS ? { ...row, ...CLEARED_MEMBER } : row;
}

function userRow(person: Person) {
  const handle = handleOf(person.first, person.last);
  const row = {
    id: person.userId,
    email: `${handle}@${SEED_EMAIL_DOMAIN}`,
    firstName: person.first,
    lastName: person.last,
    origin: "Italy",
    levelOfStudy: person.level,
    linkedin: person.linkedin === null ? null : `linkedin.com/in/${person.linkedin}`,
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

/**
 * The member tester's team email alias (issue #550), which is their PRT email
 * (issue #563): marked created on the alias request the `aliases` module
 * seeds (./aliases.ts), and not yet set up, so their Overview shows "Your
 * email alias is ready" (board 94f). Like every seeded email it is on a
 * reserved test domain, so no mail reaches a real inbox; a real alias is on
 * the team domain.
 */
export const TESTER_MEMBER_ALIAS = TESTERS.member.email;

export const MEMBER_ROWS = rowsOf(members, [
  ...PEOPLE.flatMap((p) => (p.memberId === null ? [] : [memberRow({ ...p, memberId: p.memberId })])),
  ...TESTER_PEOPLE.map((t) => ({
    memberId: t.memberId,
    prtEmail: t.tester.email,
    discord: t.tester.email.split("@")[0],
    ndaSignedAt: TESTER_JOINED,
    ndaName: `${t.tester.name} NDA`,
    ndaConfirmedBy: TEAM_LEADER,
    emailAliasSetUpAt: null,
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

const { propulsion, structures, aerodynamics, recovery, electronics, operations, research } = DEPARTMENT;
const D = DIVISION;

/** Every role lib/about/team.ts gives, started on the first day of this year; the IT lead's carries their seat. */
const PUBLIC_ROLE_ROWS = PUBLIC_TEAM.flatMap((p) =>
  p.roles.map((r) => ({
    memberId: p.memberId,
    deptId: r.deptId,
    divisionId: r.divisionId,
    title: r.title,
    startedAt: PUBLIC_ROLES_START,
    type: r.type,
    ...(p.memberId === IT_LEAD && r.divisionId === D.informationTechnology && { fullAccess: "it_lead" as const }),
  })),
);

export const ROLE_ROWS = rowsOf(roles, [
  ...PUBLIC_ROLE_ROWS,

  // Invented history: the former team leader, now an advisor of the whole team.
  { memberId: FORMER_TEAM_LEADER, deptId: propulsion, divisionId: D.liquidSystems, title: "Valve Engineer", startedAt: "2021-10-01", leavedAt: "2023-09-30", type: "core" },
  { memberId: FORMER_TEAM_LEADER, title: "Team Leader", startedAt: "2023-10-01", leavedAt: "2025-09-30", type: "president" },
  { memberId: FORMER_TEAM_LEADER, title: "Advisor", startedAt: "2025-10-01", type: "advisor" },
  { memberId: FIRST_STRUCTURES_HEAD, deptId: structures, title: "Head of Structures", startedAt: "2021-10-01", leavedAt: "2023-09-30", type: "head" },
  { memberId: FIRST_PROPULSION_HEAD, deptId: propulsion, title: "Head of Propulsion", startedAt: "2021-10-01", leavedAt: "2022-09-09", type: "head" },
  // The division advisor handed the lead over to LSA_SUCCESSOR from My profile.
  // Confirm ended the lead row and started the Advisor role on one day, and
  // made the successor's own row in the division the lead (./hand-overs.ts).
  { memberId: DIVISION_ADVISOR, deptId: propulsion, divisionId: D.liquidSystems, title: "Liquid System Architecture Lead", startedAt: "2021-10-01", leavedAt: LSA_HAND_OVER_DAY, type: "lead" },
  { memberId: DIVISION_ADVISOR, deptId: propulsion, divisionId: D.liquidSystems, title: "Advisor", startedAt: LSA_HAND_OVER_DAY, type: "advisor" },
  { memberId: JOINED_MEMBER, deptId: propulsion, divisionId: D.liquidSystems, title: "Feed Systems Engineer", startedAt: "2022-10-05", leavedAt: "2024-06-30", type: "core" },
  { memberId: 45, deptId: propulsion, divisionId: D.hybridMotors, title: "Hybrid Motors Lead", startedAt: "2021-10-01", leavedAt: "2023-09-30", type: "lead" },
  { memberId: 46, deptId: propulsion, divisionId: D.hybridMotors, title: "Grain Casting Engineer", startedAt: "2022-10-01", leavedAt: "2023-06-30", type: "core" },
  { memberId: 44, deptId: structures, divisionId: D.designManufacturing, title: "Composites Technician", startedAt: "2021-10-01", leavedAt: "2022-06-30", type: "core" },
  { memberId: HIDDEN_ALUMNUS, deptId: aerodynamics, divisionId: D.missionAnalysis, title: "Flight Dynamics Engineer", startedAt: "2022-10-01", leavedAt: "2024-07-31", type: "core" },
  { memberId: 51, deptId: recovery, divisionId: D.recoverySystems, title: "Recovery Test Engineer", startedAt: "2024-10-01", leavedAt: "2026-03-31", type: "core" },
  { memberId: ANONYMIZED_ALUMNUS, deptId: electronics, divisionId: D.firmware, title: "Bootloader Engineer", startedAt: "2023-10-01", leavedAt: "2025-06-30", type: "core" },
  { memberId: RENAMED_ALUMNUS, deptId: operations, divisionId: D.logistics, title: "Procurement Coordinator", startedAt: "2023-10-01", leavedAt: "2025-09-30", type: "core" },
  { memberId: REMOVED_ALUMNUS, deptId: operations, divisionId: D.communications, title: "Video Editor", startedAt: "2024-10-01", leavedAt: "2026-06-30", type: "core" },

  // The local testers (issue #129). The public Test Engineers work in Test
  // Bench too (./public-team.ts), but team.ts names no Test Bench lead and no
  // head of Research and Development, so the testers' seats take no one's place.
  { memberId: TESTER_MEMBER.member, deptId: propulsion, divisionId: D.testBench, title: "Test Bench Engineer", startedAt: "2025-10-01", type: "core" },
  { memberId: TESTER_MEMBER["division-lead"], deptId: propulsion, divisionId: D.testBench, title: "Test Bench Lead", startedAt: "2025-10-01", type: "lead" },
  { memberId: TESTER_MEMBER["operations-lead"], deptId: operations, title: "Operations Lead", startedAt: "2025-10-01", type: "lead", fullAccess: "operations_lead" },
  { memberId: TESTER_MEMBER["department-head"], deptId: research, title: "Head of Research and Development", startedAt: "2025-10-01", type: "head" },
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
