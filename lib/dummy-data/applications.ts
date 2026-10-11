import { romeTime, slotAt, type ApplicationStage, type ApplicationState, type SlotTime } from "@/lib/dashboard/application-flow";
import { DUMMY_NOW, positions } from "./team";

// The applications the test developer's team has received (boards 58 to 58i,
// issue #171, after board 41b of issue #142). The ones the boards name are
// written out with where they stand; the rest of each position's count is
// built from the name lists below, the same every time, so the pages and the
// figures always agree.

export type DummyApplicant = {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly politoId: string;
  readonly year: string;
  readonly degree: string;
  readonly gender: "Female" | "Male" | "Other";
};

export type DummyApplication = {
  readonly id: number;
  readonly positionId: number;
  readonly applicant: DummyApplicant;
  readonly appliedAt: string;
  /** Before any change a test developer makes (./state.ts). */
  readonly state: ApplicationState;
  readonly answer: { readonly question: string; readonly answer: string };
  readonly cvBytes: number;
  readonly letterBytes: number;
};

type Featured = Omit<DummyApplication, "id" | "cvBytes" | "letterBytes"> &
  Partial<Pick<DummyApplication, "cvBytes" | "letterBytes">>;

const slot = (day: number, hour: number, minute: number): SlotTime =>
  slotAt(romeTime(2026, 10, day, hour, minute).toISOString(), 30);

/** Times Marco offered in the week after DUMMY_NOW (board 58c's picks). */
const OFFERED = [slot(13, 18, 0), slot(13, 18, 30), slot(15, 17, 30), slot(16, 18, 0)] as const;

const giulia: DummyApplicant = {
  name: "Giulia Rossi",
  email: "giulia.rossi@gmail.com",
  phone: "+39 351 234 5678",
  politoId: "312456",
  year: "Year 1 Master's",
  degree: "Aerospace Engineering",
  gender: "Female",
};

const simulation = "Tell us about a simulation you built.";

/** The people boards 58 to 58i name, newest first, each where the boards show them. */
const featured: readonly Featured[] = [
  {
    positionId: 1,
    applicant: giulia,
    appliedAt: "2026-10-09T14:32:00+02:00",
    cvBytes: 412 * 1024,
    letterBytes: 96 * 1024,
    state: { stage: "interview", offered: OFFERED, booked: { slot: OFFERED[2], at: "2026-10-09T15:10:00+02:00" } },
    answer: {
      question: simulation,
      answer:
        "For my bachelor's thesis I wrote a 3-DOF trajectory simulator in Python and checked it against OpenRocket on two of our past flights. The apogee matched within 4%.",
    },
  },
  {
    positionId: 1,
    applicant: { name: "Luca Marino", email: "luca.marino@gmail.com", phone: "+39 347 118 2290", politoId: "318902", year: "Year 3 Bachelor's", degree: "Mechanical Engineering", gender: "Male" },
    appliedAt: "2026-10-09T10:05:00+02:00",
    state: { stage: "new" },
    answer: { question: simulation, answer: "A heat transfer model of a nozzle wall for a course project, in MATLAB." },
  },
  {
    positionId: 4,
    applicant: { name: "Aylin Fidan", email: "aylin.fidan@gmail.com", phone: "+39 320 554 7710", politoId: "321447", year: "Year 1 Master's", degree: "Computer Engineering", gender: "Female" },
    appliedAt: "2026-10-08T18:40:00+02:00",
    state: { stage: "in-review" },
    answer: { question: "Which tools have you used for trajectory work?", answer: "RocketPy and a little GMAT, both for a course on mission design." },
  },
  {
    positionId: 1,
    applicant: { name: "Pietro Ricci", email: "pietro.ricci@gmail.com", phone: "+39 333 902 1184", politoId: "309551", year: "Year 2 Bachelor's", degree: "Aerospace Engineering", gender: "Male" },
    appliedAt: "2026-10-08T09:12:00+02:00",
    state: { stage: "in-review" },
    answer: { question: simulation, answer: "A small orbit propagator in C++ that I compare with SGP4." },
  },
  {
    positionId: 1,
    applicant: { name: "Sofia Neri", email: "sofia.neri@gmail.com", phone: "+39 349 660 3021", politoId: "315230", year: "Year 3 Bachelor's", degree: "Physics", gender: "Female" },
    appliedAt: "2026-10-07T16:20:00+02:00",
    state: { stage: "interview", offered: OFFERED, booked: null },
    answer: { question: simulation, answer: "Monte Carlo runs of particle showers for a lab course." },
  },
  {
    positionId: 4,
    applicant: { name: "Mehmet Han", email: "mehmet.han@gmail.com", phone: "+39 328 447 9013", politoId: "322019", year: "Year 2 Master's", degree: "Electronic Engineering", gender: "Male" },
    appliedAt: "2026-10-06T11:45:00+02:00",
    state: { stage: "in-review" },
    answer: { question: "Which tools have you used for trajectory work?", answer: "Simulink, for a guidance loop in my bachelor's thesis." },
  },
  {
    positionId: 1,
    applicant: { name: "Elena Costa", email: "elena.costa@gmail.com", phone: "+39 340 215 6678", politoId: "317764", year: "Year 2 Master's", degree: "Aerospace Engineering", gender: "Female" },
    appliedAt: "2026-10-05T13:30:00+02:00",
    state: { stage: "interview", offered: OFFERED, booked: { slot: OFFERED[3], at: "2026-10-08T12:00:00+02:00" } },
    answer: { question: simulation, answer: "OpenFOAM runs on a wing section for the aerodynamics course project." },
  },
  // Giulia's other applications (board 58's Other applications): outside Marco's division.
  {
    positionId: 7,
    applicant: giulia,
    appliedAt: "2026-10-08T20:15:00+02:00",
    cvBytes: 412 * 1024,
    letterBytes: 96 * 1024,
    state: { stage: "in-review" },
    answer: {
      question: "Have you worked with safety procedures before?",
      answer: "Yes. In my second year I helped run the chemistry lab's waste log and checked fume hoods before each session.",
    },
  },
  {
    positionId: 10,
    applicant: giulia,
    appliedAt: "2026-09-30T11:00:00+02:00",
    cvBytes: 412 * 1024,
    state: { stage: "interview", offered: [OFFERED[0]], booked: null },
    answer: { question: "Share a link to your portfolio.", answer: "behance.net/giuliarossi" },
  },
];

/**
 * Applications from people already on the team (board 58h2, issue #229),
 * numbered after every other one so no id above changes. Matteo Greco is in
 * Design & Manufacturing and Optimization and Analysis (./team.ts); accepted
 * for Mission Analysis, he joins it with no NDA wait and keeps both.
 */
const fromTheTeam: readonly Featured[] = [
  {
    positionId: 1,
    applicant: {
      name: "Matteo Greco",
      email: "m.greco@politorocketteam.it",
      phone: "+39 347 552 0193",
      politoId: "301874",
      year: "Year 1 Master's",
      degree: "Aerospace Engineering",
      gender: "Male",
    },
    appliedAt: "2026-10-01T18:20:00+02:00",
    state: { stage: "accepted", acceptedAt: "2026-10-08T11:00:00+02:00", ndaArrived: false },
    answer: { question: simulation, answer: "A load case model of our last airframe in Abaqus, for the Design & Manufacturing division." },
  },
];

/** How many more applications each position holds, by stage, beyond the featured ones. */
const counts: Readonly<Record<number, Readonly<Partial<Record<ApplicationStage, number>>>>> = {
  1: { new: 7, "in-review": 1, accepted: 1, rejected: 2 },
  4: { new: 3, accepted: 1, rejected: 1 },
  5: { new: 2 },
  6: { "in-review": 2, accepted: 1, rejected: 2 },
  7: { new: 4, "in-review": 1, accepted: 1, rejected: 2 },
  8: { new: 1, "in-review": 1, accepted: 1, rejected: 2 },
  9: { "in-review": 1, rejected: 2 },
  10: { accepted: 3, rejected: 18 },
};

const FIRST = ["Matteo", "Alessia", "Davide", "Francesca", "Lorenzo", "Martina", "Simone", "Beatrice", "Riccardo", "Irene", "Gabriele", "Noemi", "Federico", "Camilla", "Emre", "Yasmin", "Nicolò", "Anna", "Hugo", "Ilaria", "Omar"];
const GENDER = ["Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male"] as const;
const LAST = ["Greco", "Romano", "Gallo", "Fontana", "Moretti", "Barbieri", "Lombardo", "Rinaldi", "Caruso", "Ferrara", "Testa", "Villa", "Martini", "Leone", "Longo", "Gentile", "Serra", "Vitale", "Pellegrini", "Sanna"];
const YEARS = ["Year 1 Bachelor's", "Year 2 Bachelor's", "Year 3 Bachelor's", "Year 1 Master's", "Year 2 Master's"];
const DEGREES = ["Aerospace Engineering", "Mechanical Engineering", "Computer Engineering", "Electronic Engineering", "Physics Engineering", "Design"];
const ANSWERS = [
  "Yes, through a university course project.",
  "A little, and I want to learn more with the team.",
  "Yes, in a summer internship last year.",
];

const HOUR_MS = 60 * 60 * 1000;
const STAGE_ORDER = ["new", "in-review", "accepted", "rejected"] as const satisfies readonly ApplicationStage[];

/** Where a generated application stands: decided ones were decided a week after they came in. */
function generatedState(stage: (typeof STAGE_ORDER)[number], appliedAt: number): ApplicationState {
  switch (stage) {
    case "accepted":
      return { stage, acceptedAt: new Date(appliedAt + 7 * 24 * HOUR_MS).toISOString(), ndaArrived: false };
    default:
      return { stage };
  }
}

function built(): DummyApplication[] {
  const now = new Date(DUMMY_NOW).getTime();
  const list: DummyApplication[] = featured.map((f, i) => ({
    id: i + 1,
    cvBytes: 180_000,
    letterBytes: 60_000,
    ...f,
  }));
  let id = list.length + 1;
  let person = 0;
  for (const position of positions) {
    const extra = counts[position.id] ?? {};
    const stages = STAGE_ORDER.flatMap((stage) => Array.from({ length: extra[stage] ?? 0 }, () => stage));
    stages.forEach((stage, i) => {
      const n = person++;
      const first = FIRST[n % FIRST.length];
      const last = LAST[(n * 7) % LAST.length];
      const applicant: DummyApplicant = {
        name: `${first} ${last}`,
        email: `${first.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${last.toLowerCase()}@gmail.com`,
        phone: `+39 3${String(20 + (n % 30))} ${String(100 + ((n * 37) % 900))} ${String(1000 + ((n * 211) % 9000))}`,
        politoId: String(300000 + ((n * 7919) % 30000)),
        year: YEARS[n % YEARS.length],
        degree: DEGREES[(n * 5) % DEGREES.length],
        gender: GENDER[n % GENDER.length],
      };
      // New ones came in over the last few days, the rest earlier.
      const hoursAgo = stage === "new" ? 30 + i * 19 : 24 * (5 + i * 2) + (n % 9);
      const appliedAt = now - hoursAgo * HOUR_MS;
      list.push({
        id: id++,
        positionId: position.id,
        applicant,
        appliedAt: new Date(appliedAt).toISOString(),
        state: generatedState(stage, appliedAt),
        answer: { question: position.question, answer: ANSWERS[n % ANSWERS.length] },
        cvBytes: 180_000 + ((n * 15_731) % 300_000),
        letterBytes: 60_000 + ((n * 4_099) % 60_000),
      });
    });
  }
  for (const f of fromTheTeam) list.push({ id: id++, cvBytes: 180_000, letterBytes: 60_000, ...f });
  return list;
}

/** Every application the dummy team has received. */
export const applications: readonly DummyApplication[] = built();
