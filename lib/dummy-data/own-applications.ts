import { NO_DETAILS, type YourDetails } from "@/lib/dashboard/details";
import type { InterviewSlot } from "@/lib/dashboard/my-applications";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import type { OwnApplicationsStart, OwnChanges } from "./own";
import { applicant, personFor } from "./team";

// The test developer's own applications and details (boards 50 to 55,
// issue #169). The applicant has one application at each step, so a review
// sees the received, in review, interview and accepted cards together; the
// member has one in review and the one they joined with (board 53); each lead
// has one at its interview, to another division (issue #183). What a test
// developer changes on top (./own.ts) is laid over these.

/** Where a dummy application stands before any change. */
export type DummyOwnStatus =
  | { readonly kind: "received" }
  | { readonly kind: "in-review" }
  | { readonly kind: "interview"; readonly slots: readonly InterviewSlot[] }
  | { readonly kind: "accepted" }
  | { readonly kind: "not-selected" }
  | { readonly kind: "joined"; readonly since: string }
  /** Withdrawn before the test developer signed in (the withdrawn start). */
  | { readonly kind: "withdrawn" };

export type DummyOwnApplication = {
  readonly id: number;
  readonly viewer: ViewerKind;
  readonly positionId: number;
  readonly sent: string;
  readonly status: DummyOwnStatus;
  readonly files: readonly { readonly name: string; readonly bytes: number }[];
  readonly answer: string;
};

const CV = { name: "CV.pdf", bytes: 312 * 1024 };
const LETTER = { name: "Motivation letter.pdf", bytes: 188 * 1024 };

/** Board 50c's times: Tue 14 Oct 18:00 and 18:30, Thu 16 Oct 17:30, Fri 17 Oct 18:00, half an hour each. */
const offered: readonly InterviewSlot[] = [
  { id: 1, start: "2026-10-14T18:00:00+02:00", end: "2026-10-14T18:30:00+02:00" },
  { id: 2, start: "2026-10-14T18:30:00+02:00", end: "2026-10-14T19:00:00+02:00" },
  { id: 3, start: "2026-10-16T17:30:00+02:00", end: "2026-10-16T18:00:00+02:00" },
  { id: 4, start: "2026-10-17T18:00:00+02:00", end: "2026-10-17T18:30:00+02:00" },
];

/** Newest first. */
export const ownApplications = [
  {
    id: 101,
    viewer: "non-member",
    positionId: 1,
    sent: "2026-10-09T14:32:00+02:00",
    status: { kind: "interview", slots: offered },
    files: [CV, LETTER],
    answer: "Yes. I kept the safety log for my university's chemistry lab for a year.",
  },
  {
    id: 102,
    viewer: "non-member",
    positionId: 8,
    sent: "2026-10-06T10:15:00+02:00",
    status: { kind: "in-review" },
    files: [CV],
    answer: "OpenFOAM runs on a wing section for my aerodynamics course project.",
  },
  {
    id: 103,
    viewer: "non-member",
    positionId: 7,
    sent: "2026-10-02T09:40:00+02:00",
    status: { kind: "received" },
    files: [CV, LETTER],
    answer: "I wrote the risk assessment for my bachelor's thesis lab work.",
  },
  {
    id: 104,
    viewer: "non-member",
    positionId: 9,
    sent: "2026-09-18T17:05:00+02:00",
    status: { kind: "accepted" },
    files: [CV],
    answer: "Abaqus for my thesis, and some ANSYS in a course.",
  },
  {
    id: 105,
    viewer: "non-member",
    positionId: 10,
    sent: "2026-03-03T12:00:00+01:00",
    status: { kind: "not-selected" },
    files: [CV],
    answer: "behance.net/chiaralombardi",
  },
  {
    id: 201,
    viewer: "member",
    positionId: 4,
    sent: "2026-10-06T11:20:00+02:00",
    status: { kind: "in-review" },
    files: [CV],
    answer: "RocketPy and a MATLAB six degrees of freedom model from a course.",
  },
  {
    id: 202,
    viewer: "member",
    positionId: 1,
    sent: "2025-09-28T18:30:00+02:00",
    status: { kind: "joined", since: personFor.member.since },
    files: [CV, LETTER],
    answer: "Only in the workshop course, where we followed the machine shop checklist.",
  },
  {
    id: 301,
    viewer: "division-lead",
    positionId: 5,
    sent: "2026-10-08T19:10:00+02:00",
    status: { kind: "interview", slots: offered },
    files: [CV],
    answer: "STM32 boards for our flight computer, in C with FreeRTOS.",
  },
  {
    id: 401,
    viewer: "operations-lead",
    positionId: 3,
    sent: "2026-10-07T08:50:00+02:00",
    status: { kind: "interview", slots: offered },
    files: [CV, LETTER],
    answer: "Yes, I packed the drogue for our last two launches.",
  },
] as const satisfies readonly DummyOwnApplication[];

/** Still being decided at the start: received, in review or at its interview. */
function isOpenStatus(status: DummyOwnStatus): boolean {
  return status.kind === "received" || status.kind === "in-review" || status.kind === "interview";
}

/**
 * A test developer's applications as `viewer`, from `start`. The withdrawn
 * start is the sample set's open applications, each already withdrawn: the
 * viewer has applied, and nothing they sent is still open (issue #227).
 */
export function ownApplicationsOf(viewer: ViewerKind, start: OwnApplicationsStart): readonly DummyOwnApplication[] {
  const sample: readonly DummyOwnApplication[] = ownApplications.filter((a) => a.viewer === viewer);
  switch (start) {
    case "sample":
      return sample;
    case "none":
      return [];
    case "withdrawn":
      return sample.filter((a) => isOpenStatus(a.status)).map((a) => ({ ...a, status: { kind: "withdrawn" } }));
  }
}

/** Withdrawn, at the start or by the test developer. A withdrawn application does not stop them applying again. */
export function isWithdrawn(application: DummyOwnApplication, changes: OwnChanges): boolean {
  return application.status.kind === "withdrawn" || changes.withdrawn.includes(application.id);
}

/** Still being decided, so it can be withdrawn: received, in review or at its interview. */
export function isOpenOwn(application: DummyOwnApplication, changes: OwnChanges): boolean {
  return !isWithdrawn(application, changes) && isOpenStatus(application.status);
}

/** The details each viewer starts with, before they save any. */
const startingDetails: Readonly<Record<ViewerKind, YourDetails>> = {
  "non-member": {
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    phone: "+39 333 123 4567",
    politoId: "312456",
    programme: "Aerospace Engineering",
    level: "Year 1 Master's",
    country: "Italy",
    birthDate: "2003-03-14",
    linkedin: "linkedin.com/in/chiaralombardi",
  },
  member: {
    firstName: "Elif",
    lastName: "Kaya",
    phone: "+39 347 555 0192",
    politoId: "305118",
    programme: "Aerospace Engineering",
    level: "Year 3 Bachelor's",
    country: "Türkiye",
    birthDate: "2004-07-02",
    linkedin: "linkedin.com/in/elifkaya",
  },
  "division-lead": { ...NO_DETAILS, firstName: "Marco", lastName: "Bianchi" },
  "operations-lead": { ...NO_DETAILS, firstName: "Giulia", lastName: "Rossi" },
};

/** The viewer's details: as saved, else as they start. */
export function dummyDetails(viewer: ViewerKind, changes: OwnChanges): YourDetails {
  return changes.details[viewer] ?? startingDetails[viewer];
}
