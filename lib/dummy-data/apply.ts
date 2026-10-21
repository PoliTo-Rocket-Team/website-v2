import { randomUUID } from "node:crypto";
import type { Applicant } from "@/app/actions/get-applicant";
import type { ApplyPosition } from "@/db/types";
import type { ApplyData } from "@/lib/apply/data";
import { isPublic, type Recruitment } from "@/lib/apply/positions";
import { applyFormDefaults } from "@/lib/dashboard/details";
import type { PositionContent } from "@/lib/dashboard/new-position";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { publicFaqs } from "@/lib/faq/faq";
import { dummyFaqSeed } from "./faqs";
import { NO_OWN_CHANGES, type OwnApplicationsStart, type OwnChanges } from "./own";
import { dummyDetails, isWithdrawn, ownApplicationsOf } from "./own-applications";
import { EMPTY_DUMMY_STATE, type DummyNewPosition, type DummyState } from "./state";
import {
  applicant as nonMember,
  departments,
  divisions,
  DUMMY_NOW,
  formerMember,
  personFor,
  positions,
  type DummyPosition,
} from "./team";
import { DEFAULT_DUMMY_RECRUITMENT } from "./recruitment";

// The dummy side of the apply data interface (issue #150): the positions of
// ./team.ts with the text the public pages show, as the test developer left
// them on the dashboard (./state.ts, issue #463), the test developer as the
// applicant, and sent applications kept in memory. It reads no database and
// writes no file, so it works on a preview with neither.

type PositionText = {
  readonly description: string;
  readonly required: readonly string[];
  readonly desirable: readonly string[];
  readonly createdAt: string;
};

/**
 * What the public pages show for each position in ./team.ts, by id. The
 * question the form asks and whether it wants a motivation letter are the
 * position's own (./team.ts), so the dashboard's answers match the form.
 */
export const positionText = {
  1: {
    description:
      "You work with the other divisions to design the geometry of the new rocket, and run the first simulations to check the mission goals are met. After launch, you compare the flight computer data with the simulations.",
    required: ["Basic MATLAB and Python", "Basic body and flight dynamics"],
    desirable: ["The RocketPy library", "Basic aerodynamics"],
    createdAt: "2026-09-28T09:00:00Z",
  },
  7: {
    description:
      "You own the technical safety of the rocket, from fixes on paper to the final word on the pad. You run the hazard analyses that find failure points before they reach the launch site.",
    required: ["Seeing safety as a systems problem, not paperwork"],
    desirable: ["Risk or hazard analysis"],
    createdAt: "2026-09-28T09:00:00Z",
  },
  3: {
    description:
      "You design the parachutes and the system that opens them, and test them on the ground before every flight. You work with the structures team on where each part sits in the rocket.",
    required: ["Basic mechanics", "CAD, such as SolidWorks"],
    desirable: ["Textiles or sewing", "Basic fluid dynamics"],
    createdAt: "2026-09-29T09:00:00Z",
  },
  4: {
    description:
      "You predict where the rocket goes and where it lands, for every launch site and every wind. Your numbers set the launch angle and the recovery area.",
    required: ["Basic MATLAB or Python", "Basic flight mechanics"],
    desirable: ["Monte Carlo methods"],
    createdAt: "2026-09-30T09:00:00Z",
  },
  5: {
    description:
      "You write the software that runs on the flight computer: sensor reading, data logging and the flight logic. You test it on the bench with the hardware engineers.",
    required: ["C or C++", "Basic electronics"],
    desirable: ["Microcontrollers such as STM32", "Git"],
    createdAt: "2026-10-02T09:00:00Z",
  },
  6: {
    description:
      "You study how the air flows around the rocket with CFD, and work out the forces on it in flight. Your results shape the nose cone and the fins.",
    required: ["Basic fluid dynamics", "The wish to learn"],
    desirable: ["CFD software", "Meshing software"],
    createdAt: "2026-10-05T09:00:00Z",
  },
  2: {
    description:
      "You improve the team's flight simulators. You model rocket systems such as engines, sensors and controls, and look for efficient ways to run them.",
    required: ["MATLAB", "Simulink", "Python"],
    desirable: ["Flight mechanics", "A lower-level programming language"],
    createdAt: "2026-06-01T09:00:00Z",
  },
  8: {
    description:
      "You run the aerodynamic analysis of the rocket in flight, from CFD to wind tunnel tests, and look for the shape that flies best.",
    required: ["Basic fluid dynamics", "The wish to learn"],
    desirable: ["CFD software", "Wind tunnel testing"],
    createdAt: "2026-09-28T09:00:00Z",
  },
  9: {
    description:
      "You size the rocket's structure and check it holds in flight with FEM analysis, working with the teams that build it.",
    required: ["Basic structural mechanics", "The wish to learn"],
    desirable: ["FEM software", "Composite materials"],
    createdAt: "2026-09-25T09:00:00Z",
  },
  10: {
    description:
      "You film and edit the team's videos: launch recaps, interviews and short clips for social posts.",
    required: ["A portfolio of your work"],
    desirable: ["DaVinci Resolve", "Adobe Premiere Pro"],
    createdAt: "2026-06-01T09:00:00Z",
  },
} as const satisfies Readonly<Record<(typeof positions)[number]["id"], PositionText>>;

/** The short codes a position's code is built from (`AER-MSA-001`). */
export const departmentCode = { 1: "AER", 2: "STR", 3: "RCV", 4: "CAS", 5: "ELT", 6: "OPS" } as const satisfies Readonly<
  Record<(typeof departments)[number]["id"], string>
>;
/** A division's code, and its name as the public pages print it (they add "Division" themselves). */
export const divisionLabel = {
  1: { code: "MSA", name: "Mission Analysis" },
  2: { code: "AOA", name: "Optimization and Analysis" },
  3: { code: "DAM", name: "Design & Manufacturing" },
  4: { code: "SAN", name: "Structures Analysis" },
  5: { code: "PRC", name: "Parachutes" },
  6: { code: "RES", name: "Recovery Systems" },
  7: { code: "FCS", name: "Flight Control Systems" },
  8: { code: "SYE", name: "Systems Engineering" },
  9: { code: "HDW", name: "Hardware" },
  10: { code: "SWD", name: "Avionics Software" },
  11: { code: "CMS", name: "Communications" },
  12: { code: "LGS", name: "Logistics" },
  13: { code: "SFT", name: "Safety" },
  14: { code: "SPN", name: "Sponsorship" },
} as const satisfies Readonly<Record<(typeof divisions)[number]["id"], { code: string; name: string }>>;

/**
 * What a role in the arrays says before any edit: the public pages' text
 * and the role's own question and letter setting. Null for a role the test
 * developer posted: what they wrote is in the state cookie (./state.ts).
 */
export function baseContent(p: DummyPosition): PositionContent | null {
  const text: PositionText | undefined = positionText[p.id as keyof typeof positionText];
  if (!text) return null;
  return {
    title: p.title,
    description: text.description,
    required: [...text.required],
    desirable: [...text.desirable],
    questions: p.question ? [p.question] : [],
    motivationLetter: p.requiresMotivationLetter,
  };
}

/** A role the test developer posted, as the arrays hold a position. */
function postedPosition(p: DummyNewPosition): DummyPosition {
  return {
    id: p.id,
    title: p.title,
    slug: String(p.id),
    divisionId: p.divisionId,
    open: p.open,
    updatedAt: p.createdAt,
    question: "",
    requiresMotivationLetter: p.motivationLetter,
  };
}

/** The positions as the test developer left them, and what each role says. */
export type StatedPositions = {
  readonly positions: readonly DummyPosition[];
  readonly content: ReadonlyMap<number, PositionContent>;
};

/**
 * The positions of ./team.ts with the test developer's changes laid over
 * them (./state.ts): the roles they posted, what they wrote in a role, and
 * which roles they opened or closed. The dashboard and the apply pages both
 * read the positions from here, so /apply lists what the dashboard shows.
 */
export function statedPositions(state: DummyState): StatedPositions {
  const all: DummyPosition[] = [...positions, ...state.newPositions.map(postedPosition)];
  const edits = new Map(state.positionEdits.map((e) => [e.id, e.content]));
  const content = new Map<number, PositionContent>();
  for (const p of all) {
    const said = edits.get(p.id) ?? baseContent(p);
    if (said) content.set(p.id, said);
  }
  return {
    positions: all.map((p) => {
      const edit = edits.get(p.id);
      const edited = edit
        ? { title: edit.title, requiresMotivationLetter: edit.motivationLetter, question: edit.questions[0] ?? "", updatedAt: DUMMY_NOW }
        : {};
      return { ...p, ...edited, open: state.positionOpen[p.id] ?? p.open };
    }),
    content,
  };
}

/**
 * A dummy position as the apply pages read one, saying `content`. A posted
 * role whose text the cookie no longer holds keeps its title and letter
 * setting, and says nothing more.
 */
export function dummyApplyPosition(p: DummyPosition, content: PositionContent | null = baseContent(p)): ApplyPosition {
  const division = divisions.find((d) => d.id === p.divisionId)!;
  const department = departments.find((d) => d.id === division.departmentId)!;
  const text: PositionText | undefined = positionText[p.id as keyof typeof positionText];
  return {
    id: p.id,
    status: p.open,
    division_id: division.id,
    title: p.title,
    description: content?.description ?? "",
    required_skills: [...(content?.required ?? [])],
    desirable_skills: [...(content?.desirable ?? [])],
    custom_questions: [...(content?.questions ?? [])],
    created_at: text?.createdAt ?? p.updatedAt,
    requires_motivation_letter: p.requiresMotivationLetter,
    is_deleted: false,
    div_name: divisionLabel[division.id].name,
    div_code: divisionLabel[division.id].code,
    dept_id: department.id,
    dept_name: department.name,
    dept_code: departmentCode[department.id],
  };
}

/**
 * How many positions /apply shows as open, from its `open` query value: a
 * whole number from 0 up, capped at the open positions there are. Anything
 * else (no value, text, a negative) shows them all.
 */
export function dummyOpenLimit(selector: string | null): number | null {
  if (selector === null || !/^[0-9]+$/.test(selector)) return null;
  return Number(selector);
}

/**
 * The applicant each test developer viewer signs in as. The form starts from
 * their "Your details" as saved on My account or My profile (issue #169).
 */
function applicantFor(viewer: TestViewer, own: OwnChanges): Applicant {
  return {
    id: `test-developer:${viewer}`,
    email: viewer === "non-member" ? nonMember.email : viewer === "alumni" ? formerMember.email : personFor[viewer].email,
    defaults: applyFormDefaults(dummyDetails(viewer, own)),
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
 * is signed out), with `/apply` limited by its `open` selector, the
 * recruitment switch as this browser left it (./recruitment.ts), and their
 * own changes (./own.ts): saved details and withdrawn applications, over
 * the own applications `ownStart` names. The positions are the ones the
 * dashboard shows, with the roles posted, edited, opened and closed in
 * `dashboard` (./state.ts, issue #463).
 */
export function dummyApplyData(
  viewer: TestViewer | null,
  openSelector: string | null,
  recruitment: Recruitment = DEFAULT_DUMMY_RECRUITMENT,
  sent: SentApplications = sentInThisServer,
  own: OwnChanges = NO_OWN_CHANGES,
  ownStart: OwnApplicationsStart = "sample",
  dashboard: DummyState = EMPTY_DUMMY_STATE,
): ApplyData {
  const stated = statedPositions(dashboard);
  // A cookie is browser data: a posted role naming no division of the arrays is left out.
  const all = stated.positions
    .filter((p) => divisions.some((d) => d.id === p.divisionId))
    .map((p) => dummyApplyPosition(p, stated.content.get(p.id) ?? null));
  const limit = dummyOpenLimit(openSelector);
  // A withdrawn application does not count: the person can apply again.
  const liveOwn = (userId: string, positionId: number) =>
    viewer !== null &&
    userId === applicantFor(viewer, own).id &&
    ownApplicationsOf(viewer, ownStart).some((a) => a.positionId === positionId && !isWithdrawn(a, own));
  const alreadySent = (userId: string, positionId: number) => sent.has(userId, positionId) || liveOwn(userId, positionId);

  const position = async (id: number) => {
    const found = all.find((p) => p.id === id);
    return found === undefined ? null : { position: found, recruitment };
  };

  return {
    publicPositions: async () => {
      const open = all.filter((p) => isPublic(p, recruitment));
      return limit === null ? open : open.slice(0, limit);
    },
    // The dummy questions' published versions; a test developer's edits stay on their dashboard.
    faqs: async () => publicFaqs(dummyFaqSeed()),
    // Memory has nothing to cache: the page and the submit read the same.
    position,
    shownPosition: position,
    applicant: async () => (viewer === null ? null : applicantFor(viewer, own)),
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
