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
  /** When the role was last edited (boards 41 and 41c, "Updated"). */
  readonly updatedAt: string;
  /** The role's own question on the application form. */
  readonly question: string;
  readonly requiresMotivationLetter: boolean;
};

/**
 * The moment the dummy team is seen from: every "2 days ago" and "Today" on
 * the dashboard counts back from here, so the pages read the same any day.
 */
export const DUMMY_NOW = "2026-10-09T16:00:00+02:00";

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
  { id: 7, name: "Optimization and Analysis Division", departmentId: 2 },
  { id: 8, name: "Structures Analysis Division", departmentId: 5 },
  { id: 9, name: "Communications Division", departmentId: 1 },
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

// In board 41's order. How many applications each has, and how many are new,
// comes from ./applications.ts, never from a number kept here.
export const positions = [
  { id: 1, title: "Mission Analyst", slug: "1-mission-analyst", divisionId: 3, open: true, updatedAt: "2026-10-07T11:20:00+02:00", question: "Have you worked with safety procedures before?", requiresMotivationLetter: true },
  { id: 8, title: "Aerodynamicist", slug: "8-aerodynamicist", divisionId: 7, open: true, updatedAt: "2026-10-04T09:40:00+02:00", question: "Which CFD or wind tunnel work have you done?", requiresMotivationLetter: false },
  { id: 7, title: "Flight Simulator Developer", slug: "7-flight-simulator-developer", divisionId: 3, open: false, updatedAt: "2026-09-08T15:00:00+02:00", question: "Which languages do you write simulations in?", requiresMotivationLetter: false },
  { id: 9, title: "Structural Engineer", slug: "9-structural-engineer", divisionId: 8, open: true, updatedAt: "2026-10-02T10:30:00+02:00", question: "Have you used FEM software, and which?", requiresMotivationLetter: false },
  { id: 3, title: "Recovery Systems Engineer", slug: "3-recovery-systems-engineer", divisionId: 4, open: true, updatedAt: "2026-09-09T12:00:00+02:00", question: "Have you designed or packed a parachute before?", requiresMotivationLetter: false },
  { id: 5, title: "Firmware Developer", slug: "5-firmware-developer", divisionId: 5, open: true, updatedAt: "2026-10-09T11:00:00+02:00", question: "Which microcontrollers have you written firmware for?", requiresMotivationLetter: false },
  { id: 2, title: "Safety Officer", slug: "2-safety-officer", divisionId: 2, open: true, updatedAt: "2026-10-06T14:10:00+02:00", question: "Have you worked with safety procedures before?", requiresMotivationLetter: true },
  { id: 10, title: "Graphic Designer", slug: "10-graphic-designer", divisionId: 9, open: false, updatedAt: "2026-08-10T10:00:00+02:00", question: "Share a link to your portfolio.", requiresMotivationLetter: false },
  { id: 4, title: "Trajectory Analyst", slug: "4-trajectory-analyst", divisionId: 3, open: true, updatedAt: "2026-10-05T16:45:00+02:00", question: "Which tools have you used for trajectory work?", requiresMotivationLetter: false },
  { id: 6, title: "CFD Analyst", slug: "6-cfd-analyst", divisionId: 3, open: true, updatedAt: "2026-09-30T09:15:00+02:00", question: "Which CFD or wind tunnel work have you done?", requiresMotivationLetter: false },
] as const satisfies readonly DummyPosition[];

/** The roster count for the year; `people` holds only the ones the pages name. */
export const roster = { season: "2026–27", members: 152 } as const;

/** The switch's state before a test developer flips it (#121's cookie in ./recruitment.ts holds the flip). */
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
  { positionId: 2, sent: "2 Oct 2026", status: "received" },
] as const satisfies readonly DummyApplication[];
