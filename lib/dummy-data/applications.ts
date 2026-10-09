import type { ApplicationStage } from "@/lib/dashboard/recruitment";
import { DUMMY_NOW, positions } from "./team";

// The applications the test developer's team has received (board 41b, issue
// #142). The ones board 41b names are written out; the rest of each position's
// count is built from the name lists below, the same every time, so the pages
// and the figures always agree.

export type DummyApplicant = {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly politoId: string;
  readonly year: string;
  readonly degree: string;
};

export type DummyApplication = {
  readonly id: number;
  readonly positionId: number;
  readonly applicant: DummyApplicant;
  readonly appliedAt: string;
  /** Before any change a test developer makes (./state.ts). */
  readonly stage: ApplicationStage;
  readonly answer: { readonly question: string; readonly answer: string };
  readonly cvBytes: number;
  readonly letterBytes: number;
};

type Featured = Omit<DummyApplication, "id" | "stage" | "cvBytes" | "letterBytes"> &
  Partial<Pick<DummyApplication, "cvBytes" | "letterBytes">>;

/** Board 41b's list, newest first. All of them are new. */
const featured: readonly Featured[] = [
  {
    positionId: 1,
    applicant: { name: "Giulia Rossi", email: "giulia.rossi@gmail.com", phone: "+39 351 234 5678", politoId: "312456", year: "Year 1 Master's", degree: "Aerospace Engineering" },
    appliedAt: "2026-10-09T14:32:00+02:00",
    cvBytes: 412 * 1024,
    letterBytes: 96 * 1024,
    answer: {
      question: "Have you worked with safety procedures before?",
      answer: "Yes. In my second year I helped run the chemistry lab's waste log and checked fume hoods before each session.",
    },
  },
  {
    positionId: 1,
    applicant: { name: "Luca Marino", email: "luca.marino@gmail.com", phone: "+39 347 118 2290", politoId: "318902", year: "Year 3 Bachelor's", degree: "Aerospace Engineering" },
    appliedAt: "2026-10-09T10:05:00+02:00",
    answer: { question: "Have you worked with safety procedures before?", answer: "Only in the workshop course, where we followed the machine shop checklist." },
  },
  {
    positionId: 2,
    applicant: { name: "Aylin Fidan", email: "aylin.fidan@gmail.com", phone: "+39 320 554 7710", politoId: "321447", year: "Year 2 Master's", degree: "Chemical Engineering" },
    appliedAt: "2026-10-08T18:40:00+02:00",
    answer: { question: "Have you worked with safety procedures before?", answer: "I wrote the risk assessment for my bachelor's thesis lab work." },
  },
  {
    positionId: 5,
    applicant: { name: "Pietro Ricci", email: "pietro.ricci@gmail.com", phone: "+39 333 902 1184", politoId: "309551", year: "Year 2 Bachelor's", degree: "Computer Engineering" },
    appliedAt: "2026-10-08T09:12:00+02:00",
    answer: { question: "Which microcontrollers have you written firmware for?", answer: "STM32 and ESP32, mostly sensor logging over SPI." },
  },
  {
    positionId: 1,
    applicant: { name: "Sofia Neri", email: "sofia.neri@gmail.com", phone: "+39 349 660 3021", politoId: "315230", year: "Year 1 Master's", degree: "Aerospace Engineering" },
    appliedAt: "2026-10-07T16:20:00+02:00",
    answer: { question: "Have you worked with safety procedures before?", answer: "Not formally, but I am happy to learn the team's procedures." },
  },
  {
    positionId: 2,
    applicant: { name: "Mehmet Han", email: "mehmet.han@gmail.com", phone: "+39 328 447 9013", politoId: "322019", year: "Year 3 Bachelor's", degree: "Mechanical Engineering" },
    appliedAt: "2026-10-06T11:45:00+02:00",
    answer: { question: "Have you worked with safety procedures before?", answer: "I was a safety steward at my high school robotics club for two years." },
  },
  {
    positionId: 8,
    applicant: { name: "Elena Costa", email: "elena.costa@gmail.com", phone: "+39 340 215 6678", politoId: "317764", year: "Year 2 Master's", degree: "Aerospace Engineering" },
    appliedAt: "2026-10-05T13:30:00+02:00",
    answer: { question: "Which CFD or wind tunnel work have you done?", answer: "OpenFOAM runs on a wing section for the aerodynamics course project." },
  },
];

/** How many applications each position holds, by stage. Featured ones count as new. */
const counts: Readonly<Record<number, Readonly<Record<ApplicationStage, number>>>> = {
  1: { new: 8, "in-review": 3, accepted: 1, rejected: 2 },
  2: { new: 4, "in-review": 2, accepted: 1, rejected: 2 },
  3: { new: 0, "in-review": 0, accepted: 0, rejected: 0 },
  4: { new: 3, "in-review": 1, accepted: 1, rejected: 1 },
  5: { new: 2, "in-review": 0, accepted: 0, rejected: 0 },
  6: { new: 0, "in-review": 2, accepted: 1, rejected: 2 },
  7: { new: 0, "in-review": 0, accepted: 0, rejected: 0 },
  8: { new: 1, "in-review": 1, accepted: 1, rejected: 2 },
  9: { new: 0, "in-review": 1, accepted: 0, rejected: 2 },
  10: { new: 0, "in-review": 0, accepted: 3, rejected: 18 },
};

const FIRST = ["Matteo", "Alessia", "Davide", "Francesca", "Lorenzo", "Martina", "Simone", "Beatrice", "Riccardo", "Irene", "Gabriele", "Noemi", "Federico", "Camilla", "Emre", "Yasmin", "Nicolò", "Anna", "Hugo", "Ilaria", "Omar"];
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

function generated(): DummyApplication[] {
  const now = new Date(DUMMY_NOW).getTime();
  const list: DummyApplication[] = [];
  let id = 1;
  let person = 0;
  for (const position of positions) {
    const own = featured.filter((f) => f.positionId === position.id);
    const stages = STAGE_ORDER.flatMap((stage) => Array.from({ length: counts[position.id][stage] }, () => stage));
    stages.forEach((stage, i) => {
      const pinned = stage === "new" ? own[i] : undefined;
      const n = person++;
      const first = FIRST[n % FIRST.length];
      const last = LAST[(n * 7) % LAST.length];
      const applicant: DummyApplicant = pinned?.applicant ?? {
        name: `${first} ${last}`,
        email: `${first.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${last.toLowerCase()}@gmail.com`,
        phone: `+39 3${String(20 + (n % 30))} ${String(100 + ((n * 37) % 900))} ${String(1000 + ((n * 211) % 9000))}`,
        politoId: String(300000 + ((n * 7919) % 30000)),
        year: YEARS[n % YEARS.length],
        degree: DEGREES[(n * 5) % DEGREES.length],
      };
      // New ones came in over the last few days, the rest earlier.
      const hoursAgo = stage === "new" ? 30 + i * 19 : 24 * (5 + i * 2) + (n % 9);
      list.push({
        id: id++,
        positionId: position.id,
        applicant,
        appliedAt: pinned?.appliedAt ?? new Date(now - hoursAgo * HOUR_MS).toISOString(),
        stage,
        answer: pinned?.answer ?? { question: position.question, answer: ANSWERS[n % ANSWERS.length] },
        cvBytes: pinned?.cvBytes ?? 180_000 + ((n * 15_731) % 300_000),
        letterBytes: pinned?.letterBytes ?? 60_000 + ((n * 4_099) % 60_000),
      });
    });
  }
  return list;
}

/** Every application the dummy team has received. */
export const applications: readonly DummyApplication[] = generated();
