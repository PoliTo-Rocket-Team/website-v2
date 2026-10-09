// The test developer's team (issue #141): typed arrays the dashboard reads in
// place of the database. Names and numbers follow boards 40 to 46. Later
// dashboard pages (#142 to #146) add their arrays beside these.

export type DummyDepartment = { readonly id: number; readonly name: string };

export type DummyDivision = {
  readonly id: number;
  readonly name: string;
  readonly departmentId: number;
};

export type DummyPerson = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  /** Null for someone added to the roster but not yet placed in a division. */
  readonly divisionId: number | null;
  readonly role: "head" | "division-lead" | "member";
  readonly title: string;
  readonly since: string;
  readonly hasPhoto: boolean;
  readonly linkedin: string | null;
};

export type DummyPosition = {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly divisionId: number;
  readonly open: boolean;
  readonly applications: number;
  readonly newApplications: number;
  readonly daysSinceLastApplication: number | null;
  /** Of the new applications, how many came in since Monday. */
  readonly newSinceMonday: number;
};

export const departments = [
  { id: 1, name: "Operations" },
  { id: 2, name: "Aerodynamics" },
  { id: 3, name: "Recovery" },
  { id: 4, name: "Electronics" },
  { id: 5, name: "Structures" },
] as const satisfies readonly DummyDepartment[];

export const divisions = [
  { id: 1, name: "Operations Department", departmentId: 1 },
  { id: 2, name: "Safety Division", departmentId: 1 },
  { id: 3, name: "Mission Analysis Division", departmentId: 2 },
  { id: 4, name: "Recovery Systems Division", departmentId: 3 },
  { id: 5, name: "Avionics Software Division", departmentId: 4 },
  { id: 6, name: "Manufacturing Division", departmentId: 5 },
] as const satisfies readonly DummyDivision[];

export const people = [
  { id: 1, name: "Giulia Rossi", email: "g.rossi@politorocketteam.it", divisionId: 1, role: "head", title: "Operations Lead", since: "2022-10-01", hasPhoto: true, linkedin: null },
  { id: 2, name: "Marco Bianchi", email: "m.bianchi@politorocketteam.it", divisionId: 3, role: "division-lead", title: "Mission Analysis Lead", since: "2023-10-01", hasPhoto: true, linkedin: null },
  { id: 3, name: "Sofia Neri", email: "s.neri@politorocketteam.it", divisionId: 3, role: "member", title: "Member", since: "2024-10-01", hasPhoto: true, linkedin: null },
  { id: 4, name: "Luca Marino", email: "l.marino@politorocketteam.it", divisionId: 3, role: "member", title: "Member", since: "2024-10-01", hasPhoto: true, linkedin: null },
  { id: 5, name: "Elif Kaya", email: "elif.kaya@gmail.com", divisionId: 3, role: "member", title: "Member", since: "2025-10-01", hasPhoto: false, linkedin: null },
  { id: 6, name: "Pietro Ricci", email: "p.ricci@politorocketteam.it", divisionId: 3, role: "member", title: "Member", since: "2025-10-01", hasPhoto: false, linkedin: null },
  { id: 7, name: "Sara Conti", email: "s.conti@politorocketteam.it", divisionId: 3, role: "member", title: "Member", since: "2024-10-01", hasPhoto: true, linkedin: null },
  { id: 8, name: "Andrea Ferri", email: "a.ferri@politorocketteam.it", divisionId: 1, role: "member", title: "Member", since: "2023-10-01", hasPhoto: true, linkedin: null },
  { id: 9, name: "Luca Bianchi", email: "l.bianchi@politorocketteam.it", divisionId: 5, role: "division-lead", title: "Avionics Software Lead", since: "2023-10-01", hasPhoto: true, linkedin: null },
  { id: 10, name: "Tommaso Galli", email: "t.galli@politorocketteam.it", divisionId: null, role: "member", title: "Member", since: "2026-10-01", hasPhoto: false, linkedin: null },
  { id: 11, name: "Chiara Ricci", email: "c.ricci@politorocketteam.it", divisionId: null, role: "member", title: "Member", since: "2026-10-01", hasPhoto: false, linkedin: null },
  { id: 12, name: "Kenji Watanabe", email: "k.watanabe@politorocketteam.it", divisionId: null, role: "member", title: "Member", since: "2026-10-01", hasPhoto: false, linkedin: null },
] as const satisfies readonly DummyPerson[];

/** The applicant the non-member viewer signs in as; not on the team, so not in `people`. */
export const applicant = { firstName: "Chiara", lastName: "Lombardi", name: "Chiara Lombardi", email: "chiara.lombardi@gmail.com" } as const;

/** The team member each other viewer signs in as. */
export const personFor = {
  "operations-lead": people[0],
  "division-lead": people[1],
  member: people[4],
} as const satisfies Readonly<Record<"operations-lead" | "division-lead" | "member", DummyPerson>>;

// Ids make the codes (`positionCode`), so the closed Flight Simulator Developer
// is id 2: AER-MSA-002, as board 34b's placeholder of the same role, so one
// role shows one code on `/apply?open=0` and on its own page (issue #157).
export const positions = [
  { id: 1, title: "Mission Analyst", slug: "1-mission-analyst", divisionId: 3, open: true, applications: 14, newApplications: 8, daysSinceLastApplication: 0, newSinceMonday: 3 },
  { id: 7, title: "Safety Officer", slug: "7-safety-officer", divisionId: 2, open: true, applications: 9, newApplications: 4, daysSinceLastApplication: 1, newSinceMonday: 2 },
  { id: 3, title: "Recovery Systems Engineer", slug: "3-recovery-systems-engineer", divisionId: 4, open: true, applications: 2, newApplications: 0, daysSinceLastApplication: 30, newSinceMonday: 0 },
  { id: 4, title: "Trajectory Analyst", slug: "4-trajectory-analyst", divisionId: 3, open: true, applications: 6, newApplications: 0, daysSinceLastApplication: 4, newSinceMonday: 0 },
  { id: 5, title: "Firmware Developer", slug: "5-firmware-developer", divisionId: 5, open: true, applications: 3, newApplications: 0, daysSinceLastApplication: 5, newSinceMonday: 0 },
  { id: 6, title: "CFD Analyst", slug: "6-cfd-analyst", divisionId: 3, open: true, applications: 5, newApplications: 0, daysSinceLastApplication: 9, newSinceMonday: 0 },
  { id: 2, title: "Flight Simulator Developer", slug: "2-flight-simulator-developer", divisionId: 3, open: false, applications: 0, newApplications: 0, daysSinceLastApplication: null, newSinceMonday: 0 },
] as const satisfies readonly DummyPosition[];

/** The roster count for the year; `people` holds only the ones the pages name. */
export const roster = { season: "2026–27", members: 152 } as const;

export const recruitment = { open: true, since: "1 Oct" } as const;

export type DummyActivity = {
  readonly actorId: number | null;
  readonly actor: string;
  readonly text: string;
  readonly when: string;
  /** The division the event is about; null for team-wide events. */
  readonly divisionId: number | null;
};

export const activity = [
  { actorId: null, actor: "Marco Dona", text: "Marco Dona was promoted to Head of R&D", when: "2 hours ago", divisionId: null },
  { actorId: 9, actor: "Luca Bianchi", text: "Luca Bianchi opened Firmware Developer", when: "5 hours ago", divisionId: 5 },
  { actorId: 1, actor: "Giulia Rossi", text: "Giulia Rossi turned recruitment on", when: "Yesterday", divisionId: null },
  { actorId: null, actor: "Davide Costa", text: "Davide Costa left the team", when: "2 days ago", divisionId: null },
  { actorId: 8, actor: "Andrea Ferri", text: "Andrea Ferri edited the Cavour page", when: "3 days ago", divisionId: null },
  { actorId: 2, actor: "Marco Bianchi", text: "Marco Bianchi gave Luca Marino edit access to Positions", when: "3 days ago", divisionId: 3 },
  { actorId: 2, actor: "Marco Bianchi", text: "Marco Bianchi opened CFD Analyst", when: "4 days ago", divisionId: 3 },
] as const satisfies readonly DummyActivity[];

export type DummyApplication = {
  readonly positionId: number;
  readonly sent: string;
  readonly status: "received" | "in-review";
};

/** The non-member test developer's own applications (board 45b). */
export const ownApplications = [
  { positionId: 1, sent: "9 Oct 2026", status: "in-review" },
  { positionId: 7, sent: "2 Oct 2026", status: "received" },
] as const satisfies readonly DummyApplication[];
