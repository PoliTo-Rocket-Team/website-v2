import { randomUUID } from "node:crypto";
import type { Applicant } from "@/app/actions/get-applicant";
import type { ApplyPosition } from "@/db/types";
import type { ApplyData } from "@/lib/apply/data";
import { formDefaults } from "@/lib/apply/application-form";
import { isPublic, type Recruitment } from "@/lib/apply/positions";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import {
  applicant as nonMember,
  departments,
  divisions,
  ownApplications,
  personFor,
  positions,
  recruitment,
  type DummyPosition,
} from "./team";

// The dummy side of the apply data interface (issue #150): the positions of
// ./team.ts with the text the public pages show, the test developer as the
// applicant, and sent applications kept in memory. It reads no database and
// writes no file, so it works on a preview with neither.

type PositionText = {
  readonly description: string;
  readonly required: readonly string[];
  readonly desirable: readonly string[];
  readonly questions: readonly string[];
  readonly motivationLetter: boolean;
  readonly createdAt: string;
};

/** What the public pages show for each position in ./team.ts, by id. */
export const positionText = {
  1: {
    description:
      "You work with the other divisions to design the geometry of the new rocket, and run the first simulations to check the mission goals are met. After launch, you compare the flight computer data with the simulations.",
    required: ["Basic MATLAB and Python", "Basic body and flight dynamics"],
    desirable: ["The RocketPy library", "Basic aerodynamics"],
    questions: ["Which simulation tool have you used most, and for what?"],
    motivationLetter: true,
    createdAt: "2026-09-28T09:00:00Z",
  },
  7: {
    description:
      "You own the technical safety of the rocket, from fixes on paper to the final word on the pad. You run the hazard analyses that find failure points before they reach the launch site.",
    required: ["Seeing safety as a systems problem, not paperwork"],
    desirable: ["Risk or hazard analysis"],
    questions: [],
    motivationLetter: true,
    createdAt: "2026-09-28T09:00:00Z",
  },
  3: {
    description:
      "You design the parachutes and the system that opens them, and test them on the ground before every flight. You work with the structures team on where each part sits in the rocket.",
    required: ["Basic mechanics", "CAD, such as SolidWorks"],
    desirable: ["Textiles or sewing", "Basic fluid dynamics"],
    questions: ["Tell us about something you built with your hands."],
    motivationLetter: false,
    createdAt: "2026-09-29T09:00:00Z",
  },
  4: {
    description:
      "You predict where the rocket goes and where it lands, for every launch site and every wind. Your numbers set the launch angle and the recovery area.",
    required: ["Basic MATLAB or Python", "Basic flight mechanics"],
    desirable: ["Monte Carlo methods"],
    questions: [],
    motivationLetter: false,
    createdAt: "2026-09-30T09:00:00Z",
  },
  5: {
    description:
      "You write the software that runs on the flight computer: sensor reading, data logging and the flight logic. You test it on the bench with the hardware engineers.",
    required: ["C or C++", "Basic electronics"],
    desirable: ["Microcontrollers such as STM32", "Git"],
    questions: ["Which microcontroller have you programmed, and what did it do?"],
    motivationLetter: true,
    createdAt: "2026-10-02T09:00:00Z",
  },
  6: {
    description:
      "You study how the air flows around the rocket with CFD, and work out the forces on it in flight. Your results shape the nose cone and the fins.",
    required: ["Basic fluid dynamics", "The wish to learn"],
    desirable: ["CFD software", "Meshing software"],
    questions: [],
    motivationLetter: false,
    createdAt: "2026-10-05T09:00:00Z",
  },
  2: {
    description:
      "You improve the team's flight simulators. You model rocket systems such as engines, sensors and controls, and look for efficient ways to run them.",
    required: ["MATLAB", "Simulink", "Python"],
    desirable: ["Flight mechanics", "A lower-level programming language"],
    questions: [],
    motivationLetter: false,
    createdAt: "2026-06-01T09:00:00Z",
  },
} as const satisfies Readonly<Record<DummyPosition["id"], PositionText>>;

/** The short codes a position's code is built from (`AER-MSA-001`). */
const departmentCode = { 1: "OPS", 2: "AER", 3: "REC", 4: "ELE", 5: "STR" } as const satisfies Readonly<
  Record<(typeof departments)[number]["id"], string>
>;
/** A division's code, and its name as the public pages print it (they add "Division" themselves). */
const divisionLabel = {
  1: { code: "OPS", name: "Operations" },
  2: { code: "SFT", name: "Safety" },
  3: { code: "MSA", name: "Mission Analysis" },
  4: { code: "RSY", name: "Recovery Systems" },
  5: { code: "AVS", name: "Avionics Software" },
  6: { code: "MFG", name: "Manufacturing" },
} as const satisfies Readonly<Record<(typeof divisions)[number]["id"], { code: string; name: string }>>;

function applyPosition(p: DummyPosition): ApplyPosition {
  const division = divisions.find((d) => d.id === p.divisionId)!;
  const department = departments.find((d) => d.id === division.departmentId)!;
  const text: PositionText = positionText[p.id as keyof typeof positionText];
  return {
    id: p.id,
    status: p.open,
    division_id: division.id,
    title: p.title,
    description: text.description,
    required_skills: [...text.required],
    desirable_skills: [...text.desirable],
    custom_questions: [...text.questions],
    created_at: text.createdAt,
    requires_motivation_letter: text.motivationLetter,
    is_deleted: false,
    div_name: divisionLabel[division.id].name,
    div_code: divisionLabel[division.id].code,
    dept_id: department.id,
    dept_name: department.name,
    dept_code: departmentCode[department.id],
  };
}

const dummyRecruitment: Recruitment = { isOpen: recruitment.open };

/**
 * How many positions /apply shows as open, from its `open` query value: a
 * whole number from 0 up, capped at the open positions there are. Anything
 * else (no value, text, a negative) shows them all.
 */
export function dummyOpenLimit(selector: string | null): number | null {
  if (selector === null || !/^[0-9]+$/.test(selector)) return null;
  return Number(selector);
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

/** The applicant each test developer viewer signs in as. */
function applicantFor(viewer: ViewerKind): Applicant {
  const person = viewer === "non-member" ? nonMember : { ...splitName(personFor[viewer].name), email: personFor[viewer].email };
  return {
    id: `test-developer:${viewer}`,
    email: person.email,
    defaults: formDefaults({
      firstName: person.firstName,
      lastName: person.lastName,
      politoId: null,
      phone: null,
      dateOfBirth: null,
      studyProgramme: null,
      degreeProgramme: null,
      gender: null,
      origin: null,
      referral: null,
    }),
  };
}

/** Applications sent in dummy mode: held in this server's memory, never written anywhere. */
export class SentApplications {
  private readonly sent = new Map<string, Set<number>>();

  has(userId: string, positionId: number): boolean {
    return this.sent.get(userId)?.has(positionId) ?? false;
  }

  /** Records one; false when this user already sent one for the position. */
  add(userId: string, positionId: number): boolean {
    const mine = this.sent.get(userId) ?? new Set<number>();
    if (mine.has(positionId)) return false;
    mine.add(positionId);
    this.sent.set(userId, mine);
    return true;
  }
}

const sentInThisServer = new SentApplications();

/**
 * The apply pages as a test developer sees them: signed in as `viewer` (null
 * is signed out), with `/apply` limited by its `open` selector.
 */
export function dummyApplyData(
  viewer: ViewerKind | null,
  openSelector: string | null,
  sent: SentApplications = sentInThisServer,
): ApplyData {
  const all = positions.map(applyPosition);
  const limit = dummyOpenLimit(openSelector);
  const alreadySent = (userId: string, positionId: number) =>
    sent.has(userId, positionId) ||
    (userId === applicantFor("non-member").id && ownApplications.some((a) => a.positionId === positionId));

  return {
    publicPositions: async () => {
      const open = all.filter((p) => isPublic(p, dummyRecruitment));
      return limit === null ? open : open.slice(0, limit);
    },
    position: async (id) => {
      const position = all.find((p) => p.id === id);
      return position === undefined ? null : { position, recruitment: dummyRecruitment };
    },
    applicant: async () => (viewer === null ? null : applicantFor(viewer)),
    hasApplied: async (userId, positionId) => alreadySent(userId, positionId),
    store: {
      putPdf: async () => {},
      deletePdf: async () => {},
      save: async ({ userId, positionId }) =>
        !alreadySent(userId, positionId) && sent.add(userId, positionId) ? "saved" : "already-applied",
      newFileName: randomUUID,
    },
  };
}
