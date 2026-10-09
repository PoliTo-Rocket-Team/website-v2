// The test developer's team (issue #141): typed arrays the dashboard reads in
// place of the database. Names and numbers follow boards 40 to 46; the
// roster follows the Team tree (board 42b), so every Team page (#143) and
// the Overview read the same people. Later dashboard pages add their arrays
// beside these.

import type { OrgDepartment, OrgDivision, Placement } from "@/lib/dashboard/team";

export type DummyDepartment = OrgDepartment;

export type DummyDivision = OrgDivision;

export type DummyPerson = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly placement: Placement;
  /** Their role's title, as the user card shows it: "Operations Lead", "Member". */
  readonly title: string;
  /** The title under their name on the public Team page, when one is set. */
  readonly pageTitle: string | null;
  readonly since: string;
  readonly hasPhoto: boolean;
  readonly linkedin: string | null;
  readonly program: string;
  readonly study: string;
  readonly access: readonly string[];
};

export const departments = [
  { id: 1, name: "Aerodynamics" },
  { id: 2, name: "Structures" },
  { id: 3, name: "Recovery" },
  { id: 4, name: "Controls and Systems" },
  { id: 5, name: "Electronics" },
  { id: 6, name: "Operations" },
] as const satisfies readonly DummyDepartment[];

export const divisions = [
  { id: 1, name: "Mission Analysis Division", departmentId: 1 },
  { id: 2, name: "Optimization and Analysis Division", departmentId: 1 },
  { id: 3, name: "Design & Manufacturing Division", departmentId: 2 },
  { id: 4, name: "Structures Analysis Division", departmentId: 2 },
  { id: 5, name: "Parachutes Division", departmentId: 3 },
  { id: 6, name: "Recovery Systems Division", departmentId: 3 },
  { id: 7, name: "Flight Control Systems Division", departmentId: 4 },
  { id: 8, name: "Systems Engineering Division", departmentId: 4 },
  { id: 9, name: "Hardware Division", departmentId: 5 },
  { id: 10, name: "Avionics Software Division", departmentId: 5 },
  { id: 11, name: "Communications Division", departmentId: 6 },
  { id: 12, name: "Logistics Division", departmentId: 6 },
  { id: 13, name: "Safety Division", departmentId: 6 },
  { id: 14, name: "Sponsorship Division", departmentId: 6 },
] as const satisfies readonly DummyDivision[];

const leader = { role: "team-leader" } as const satisfies Placement;
const head = (departmentId: number): Placement => ({ role: "head", departmentId });
const lead = (divisionId: number): Placement => ({ role: "division-lead", divisionId });
const member = (divisionId: number | null): Placement => ({ role: "member", divisionId });

const PROGRAMS = [
  "Aerospace Eng.",
  "Mechanical Eng.",
  "Physics",
  "Mathematical Eng.",
  "Computer Eng.",
  "Electronic Eng.",
  "Energy Eng.",
] as const;

type Row = readonly [
  id: number,
  name: string,
  placement: Placement,
  title: string,
  joined: number,
  extra?: Partial<Pick<DummyPerson, "email" | "pageTitle" | "hasPhoto" | "program" | "study" | "access">>,
];

/** A row in full: email, programme and study follow from the id where the row gives none. */
function person([id, name, placement, title, joined, extra = {}]: Row): DummyPerson {
  const [first, ...rest] = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(" ");
  const degree = id % 3 === 0 ? "BSc" : "MSc";
  return {
    id,
    name,
    email: extra.email ?? `${first[0]}.${rest.join("")}@politorocketteam.it`,
    placement,
    title,
    pageTitle: extra.pageTitle ?? null,
    since: `${joined}-10-01`,
    hasPhoto: extra.hasPhoto ?? id % 4 !== 1,
    linkedin: null,
    program: extra.program ?? PROGRAMS[id % PROGRAMS.length],
    study: extra.study ?? `${degree} · year ${degree === "BSc" ? 1 + (id % 3) : 1 + (id % 2)}`,
    access: extra.access ?? [],
  };
}

const M = "Member";

/** This year's roster. Ids 1 to 12 are the people the Overview names. */
export const people: readonly DummyPerson[] = ([
  [1, "Giulia Rossi", head(6), "Operations Lead", 2022, { hasPhoto: true, access: ["All pages · edit"] }],
  [2, "Marco Bianchi", lead(1), "Mission Analysis Lead", 2023, { hasPhoto: true, pageTitle: "Mission Analysis Lead", program: "Aerospace Eng.", study: "MSc · year 1", access: ["Positions · edit", "Applications · edit"] }],
  [3, "Sofia Neri", member(1), M, 2024, { program: "Aerospace Eng.", study: "BSc · year 3" }],
  [4, "Luca Marino", member(1), M, 2024, { program: "Physics", study: "MSc · year 2", access: ["Positions · edit"] }],
  [5, "Elif Kaya", member(1), M, 2025, { email: "elif.kaya@gmail.com", hasPhoto: false, program: "Aerospace Eng.", study: "BSc · year 2" }],
  [6, "Pietro Ricci", member(1), M, 2025, { hasPhoto: false, program: "Mechanical Eng.", study: "MSc · year 1" }],
  [7, "Sara Conti", member(1), M, 2024, { pageTitle: "Mission Analyst", program: "Aerospace Eng.", study: "BSc · year 3", access: ["Applications · view"] }],
  [8, "Andrea Ferri", member(11), M, 2023, { access: ["Projects · edit"] }],
  [9, "Lorenzo De Luca", lead(10), "Avionics Software Lead", 2023],
  [10, "Tommaso Galli", member(null), M, 2026, { hasPhoto: false }],
  [11, "Chiara Ricci", member(null), M, 2026, { hasPhoto: false }],
  [12, "Kenji Watanabe", member(null), M, 2026, { hasPhoto: false }],
  [13, "Anna Villa", member(1), M, 2025, { program: "Mathematical Eng.", study: "MSc · year 1" }],
  [14, "Alessandro Greco", leader, "Team Leader", 2021],
  [15, "Chiara Rinaldi", head(1), "Head of Aerodynamics", 2022],
  [16, "Davide Russo", head(2), "Head of Structures", 2022],
  [17, "Irene Galli", head(3), "Head of Recovery", 2022],
  [18, "Omar Haddad", head(4), "Head of Controls and Systems", 2022],
  [19, "Nicolò Ferrara", head(5), "Head of Electronics", 2021],
  [20, "Paolo Conti", lead(2), "Optimization and Analysis Lead", 2023],
  [21, "Federica Leone", lead(3), "Design & Manufacturing Lead", 2023],
  [22, "Riccardo Moretti", lead(4), "Structures Analysis Lead", 2023],
  [23, "Simone Testa", lead(5), "Parachutes Lead", 2023],
  [24, "Elisa Marchi", lead(6), "Recovery Systems Lead", 2023],
  [25, "Andrea Monti", lead(7), "Flight Control Systems Lead", 2023],
  [26, "Valeria Bruno", lead(8), "Systems Engineering Lead", 2024],
  [27, "Stefano Mancini", lead(9), "Hardware Lead", 2023],
  [28, "Silvia Grasso", lead(11), "Communications Lead", 2024],
  [29, "Filippo Orlando", lead(12), "Logistics Lead", 2024],
  [30, "Bruno Valli", lead(13), "Safety Lead", 2023],
  [31, "Laura Esposito", lead(14), "Sponsorship Lead", 2024],
  [32, "Sara Fontana", member(2), M, 2024],
  [33, "Ahmed Saleh", member(2), M, 2025],
  [34, "Giorgio Lodi", member(2), M, 2024],
  [35, "Mina Park", member(2), M, 2025],
  [36, "Irene Sala", member(2), M, 2025],
  [37, "Nadia Ferro", member(2), M, 2026],
  [38, "Matteo Riva", member(3), M, 2024],
  [39, "Lara Sala", member(3), M, 2025],
  [40, "Tommaso Gatti", member(3), M, 2024],
  [41, "Yusuf Demir", member(3), M, 2025],
  [42, "Paolo Mele", member(3), M, 2026],
  [43, "Greta Fabbri", member(3), M, 2026],
  [44, "Alice Ferri", member(4), M, 2024],
  [45, "Jonas Berg", member(4), M, 2025],
  [46, "Chiara Pace", member(4), M, 2024],
  [47, "Leo Brun", member(4), M, 2025],
  [48, "Giada Rizzo", member(5), M, 2024],
  [49, "Hugo Martin", member(5), M, 2025],
  [50, "Bianca Serra", member(5), M, 2024],
  [51, "Kemal Arslan", member(5), M, 2025],
  [52, "Elena Riva", member(5), M, 2026],
  [53, "Nicola Bassi", member(6), M, 2024],
  [54, "Rosa Longo", member(6), M, 2025],
  [55, "Dario Fabbri", member(6), M, 2024],
  [56, "Ines Costa", member(6), M, 2025],
  [57, "Marta Villa", member(6), M, 2026],
  [58, "Luca Serra", member(6), M, 2026],
  [59, "Fabio Caruso", member(7), M, 2024],
  [60, "Elena Vitale", member(7), M, 2025],
  [61, "Samir Aziz", member(7), M, 2024],
  [62, "Lucia Greco", member(7), M, 2025],
  [63, "Enzo Pellegrini", member(8), M, 2024],
  [64, "Nora Hansen", member(8), M, 2025],
  [65, "Marta Gentile", member(8), M, 2024],
  [66, "Ivan Petrov", member(8), M, 2025],
  [67, "Sara Lodi", member(8), M, 2026],
  [68, "Cristina Rossetti", member(9), M, 2024],
  [69, "Pablo Ruiz", member(9), M, 2025],
  [70, "Gaia Sartori", member(9), M, 2024],
  [71, "Hiro Tanaka", member(9), M, 2025],
  [72, "Matteo Greco", member(9), M, 2026],
  [73, "Priya Nair", member(9), M, 2026],
  [74, "Emma Bianco", member(10), M, 2024],
  [75, "Can Yilmaz", member(10), M, 2025],
  [76, "Martina Fiore", member(10), M, 2024],
  [77, "Ali Rahimi", member(10), M, 2025],
  [78, "Aisha Rahman", member(10), M, 2026],
  [79, "Omar Fadel", member(10), M, 2026],
  [80, "Ludovica Neri", member(11), M, 2024],
  [81, "Kaan Öz", member(11), M, 2025],
  [82, "Arianna Dini", member(11), M, 2025],
  [83, "Diego Sanna", member(12), M, 2024],
  [84, "Noemi Cattaneo", member(12), M, 2025],
  [85, "Rami Khalil", member(12), M, 2026],
  [86, "Carla Mele", member(13), M, 2024],
  [87, "Viktor Novak", member(13), M, 2025],
  [88, "Beatrice Gallo", member(14), M, 2024],
  [89, "Marco Piras", member(14), M, 2025],
  [90, "Selin Aydın", member(14), M, 2025],
  [91, "Lena Fischer", member(14), M, 2026],
  [92, "Davide Galli", member(14), M, 2026],
] as const satisfies readonly Row[]).map(person);

/** People who were on the team (board 46c). `shownOnSite` is the switch on the Alumni page. */
export type DummyAlumnus = {
  readonly id: number;
  readonly name: string;
  readonly lastRole: string;
  readonly unit: string;
  readonly department: string;
  readonly from: number;
  readonly to: number;
  readonly shownOnSite: boolean;
};

export const alumni = [
  { id: 1001, name: "Davide Costa", lastRole: "Member", unit: "Hardware", department: "Electronics", from: 2023, to: 2026, shownOnSite: true },
  { id: 1002, name: "Federico Marino", lastRole: "Head of Propulsion", unit: "Propulsion", department: "Propulsion", from: 2021, to: 2025, shownOnSite: true },
  { id: 1003, name: "Alessia Romano", lastRole: "Team Leader", unit: "Board", department: "Board", from: 2020, to: 2025, shownOnSite: true },
  { id: 1004, name: "Jonas Weber", lastRole: "Member", unit: "Avionics Software", department: "Electronics", from: 2023, to: 2025, shownOnSite: true },
  { id: 1005, name: "Giorgio Costa", lastRole: "Division Lead", unit: "Recovery Systems", department: "Recovery", from: 2022, to: 2025, shownOnSite: true },
  { id: 1006, name: "Hana Kim", lastRole: "Member", unit: "Communications", department: "Operations", from: 2024, to: 2025, shownOnSite: false },
  { id: 1007, name: "Riccardo Lombardi", lastRole: "Member", unit: "Structures Analysis", department: "Structures", from: 2022, to: 2024, shownOnSite: true },
  { id: 1008, name: "Ines Duarte", lastRole: "Member", unit: "Mission Analysis", department: "Aerodynamics", from: 2023, to: 2024, shownOnSite: true },
  { id: 1009, name: "Paolo Gentile", lastRole: "Head of Structures", unit: "Structures", department: "Structures", from: 2019, to: 2024, shownOnSite: true },
  { id: 1010, name: "Marta Leone", lastRole: "Member", unit: "Parachutes", department: "Recovery", from: 2022, to: 2024, shownOnSite: true },
  { id: 1011, name: "Gabriele Rota", lastRole: "Division Lead", unit: "Hardware", department: "Electronics", from: 2020, to: 2024, shownOnSite: true },
  { id: 1012, name: "Sofia Bassi", lastRole: "Member", unit: "Logistics", department: "Operations", from: 2022, to: 2023, shownOnSite: false },
  { id: 1013, name: "Luca Fontana", lastRole: "Member", unit: "Flight Control Systems", department: "Controls and Systems", from: 2021, to: 2023, shownOnSite: true },
  { id: 1014, name: "Elisa Monti", lastRole: "Head of Recovery", unit: "Recovery", department: "Recovery", from: 2018, to: 2023, shownOnSite: true },
  { id: 1015, name: "Tobias Klein", lastRole: "Member", unit: "Design & Manufacturing", department: "Structures", from: 2021, to: 2023, shownOnSite: true },
  { id: 1016, name: "Giulia Ferraro", lastRole: "Member", unit: "Sponsorship", department: "Operations", from: 2020, to: 2022, shownOnSite: true },
  { id: 1017, name: "Matteo Conti", lastRole: "Team Leader", unit: "Board", department: "Board", from: 2017, to: 2022, shownOnSite: true },
  { id: 1018, name: "Yara Haddad", lastRole: "Member", unit: "Mission Analysis", department: "Aerodynamics", from: 2020, to: 2022, shownOnSite: true },
] as const satisfies readonly DummyAlumnus[];

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

/** The applicant the non-member viewer signs in as; not on the team, so not in `people`. */
export const applicant = { firstName: "Chiara", lastName: "Lombardi", name: "Chiara Lombardi", email: "chiara.lombardi@gmail.com" } as const;

function personById(id: number): DummyPerson {
  return people.find((p) => p.id === id)!;
}

/** The team member each other viewer signs in as. */
export const personFor = {
  "operations-lead": personById(1),
  "division-lead": personById(2),
  member: personById(5),
} as const satisfies Readonly<Record<"operations-lead" | "division-lead" | "member", DummyPerson>>;

// In board 41's order. How many applications each has, and how many are new,
// comes from ./applications.ts, never from a number kept here. Ids make the
// codes (`positionCode`), so the closed Flight Simulator Developer is id 2:
// AER-MSA-002, as board 34b's placeholder of the same role, so one role shows
// one code on `/apply?open=0` and on its own page (issue #157).
export const positions = [
  { id: 1, title: "Mission Analyst", slug: "1-mission-analyst", divisionId: 1, open: true, updatedAt: "2026-10-07T11:20:00+02:00", question: "Tell us about a simulation you built.", requiresMotivationLetter: true },
  { id: 8, title: "Aerodynamicist", slug: "8-aerodynamicist", divisionId: 2, open: true, updatedAt: "2026-10-04T09:40:00+02:00", question: "Which CFD or wind tunnel work have you done?", requiresMotivationLetter: false },
  { id: 2, title: "Flight Simulator Developer", slug: "2-flight-simulator-developer", divisionId: 1, open: false, updatedAt: "2026-09-08T15:00:00+02:00", question: "Which languages do you write simulations in?", requiresMotivationLetter: false },
  { id: 9, title: "Structural Engineer", slug: "9-structural-engineer", divisionId: 4, open: true, updatedAt: "2026-10-02T10:30:00+02:00", question: "Have you used FEM software, and which?", requiresMotivationLetter: false },
  { id: 3, title: "Recovery Systems Engineer", slug: "3-recovery-systems-engineer", divisionId: 6, open: true, updatedAt: "2026-09-09T12:00:00+02:00", question: "Have you designed or packed a parachute before?", requiresMotivationLetter: false },
  { id: 5, title: "Firmware Developer", slug: "5-firmware-developer", divisionId: 10, open: true, updatedAt: "2026-10-09T11:00:00+02:00", question: "Which microcontrollers have you written firmware for?", requiresMotivationLetter: false },
  { id: 7, title: "Safety Officer", slug: "7-safety-officer", divisionId: 13, open: true, updatedAt: "2026-10-06T14:10:00+02:00", question: "Have you worked with safety procedures before?", requiresMotivationLetter: true },
  { id: 10, title: "Graphic Designer", slug: "10-graphic-designer", divisionId: 11, open: false, updatedAt: "2026-08-10T10:00:00+02:00", question: "Share a link to your portfolio.", requiresMotivationLetter: false },
  { id: 4, title: "Trajectory Analyst", slug: "4-trajectory-analyst", divisionId: 1, open: true, updatedAt: "2026-10-05T16:45:00+02:00", question: "Which tools have you used for trajectory work?", requiresMotivationLetter: false },
  { id: 6, title: "CFD Analyst", slug: "6-cfd-analyst", divisionId: 1, open: true, updatedAt: "2026-09-30T09:15:00+02:00", question: "Which CFD or wind tunnel work have you done?", requiresMotivationLetter: false },
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
  { actorId: 9, actor: "Lorenzo De Luca", text: "Lorenzo De Luca opened Firmware Developer", when: "5 hours ago", divisionId: 10 },
  { actorId: 1, actor: "Giulia Rossi", text: "Giulia Rossi turned recruitment on", when: "Yesterday", divisionId: null },
  { actorId: null, actor: "Davide Costa", text: "Davide Costa left the team", when: "2 days ago", divisionId: null },
  { actorId: 8, actor: "Andrea Ferri", text: "Andrea Ferri edited the Cavour page", when: "3 days ago", divisionId: null },
  { actorId: 2, actor: "Marco Bianchi", text: "Marco Bianchi gave Luca Marino edit access to Positions", when: "3 days ago", divisionId: 1 },
  { actorId: 2, actor: "Marco Bianchi", text: "Marco Bianchi opened CFD Analyst", when: "4 days ago", divisionId: 1 },
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
