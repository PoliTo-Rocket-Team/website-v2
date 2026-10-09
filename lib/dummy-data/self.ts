import { positionCode } from "@/lib/apply/positions";
import { parseDetails, firstDetailError, type YourDetails } from "@/lib/dashboard/details";
import {
  canWithdraw,
  pickableSlot,
  type ActiveApplication,
  type ActiveStage,
  type InterviewSlot,
  type MyApplications,
  type PastApplication,
} from "@/lib/dashboard/my-applications";
import { fileSize } from "@/lib/dashboard/recruitment";
import {
  checkPhoto,
  normalizeLinkedin,
  type DeleteAccount,
  type LeaveState,
  type MyAccount,
  type MyProfile,
} from "@/lib/dashboard/self";
import { divisionIdOf } from "@/lib/dashboard/team";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { dummyApplyPosition } from "./apply";
import { dummyDetails, isOpenOwn, ownApplicationsOf, type DummyOwnApplication } from "./own-applications";
import type { OwnChanges } from "./own";
import { departments, divisions, people, positions, type DummyPerson } from "./team";

// The viewer's own pages for the test developer (boards 50 to 55, issue
// #169): built from ./own-applications.ts and ./team.ts, with what the test
// developer changed (./own.ts) laid over them. Writes answer what the page
// shows next; the caller (./index.ts) saves the changed cookie.

export type DummySignIn = {
  readonly personId: number;
  /** The Google account they sign in with. */
  readonly signInEmail: string;
  /** The team address shown on the site. */
  readonly teamEmail: string;
};

/** Sign-in and team addresses for the people the test developer can be. */
export const signIns = [
  { personId: 1, signInEmail: "giulia.rossi@gmail.com", teamEmail: "g.rossi@politorocketteam.it" },
  { personId: 2, signInEmail: "marco.bianchi@gmail.com", teamEmail: "m.bianchi@politorocketteam.it" },
  { personId: 5, signInEmail: "elif.kaya@gmail.com", teamEmail: "elif.kaya@politorocketteam.it" },
] as const satisfies readonly DummySignIn[];

function signInOf(person: DummyPerson): DummySignIn {
  return signIns.find((s) => s.personId === person.id) ?? { personId: person.id, signInEmail: person.email, teamEmail: person.email };
}

export function dummyMyProfile(kind: ViewerKind, person: DummyPerson, changes: OwnChanges, leave: LeaveState): MyProfile {
  const division = divisions.find((d) => d.id === divisionIdOf(person.placement));
  const login = signInOf(person);
  const details = dummyDetails(kind, changes);
  return {
    name: person.name,
    role: division ? `${person.title} · ${division.name}` : person.title,
    teamEmail: login.teamEmail,
    linkedin: details.linkedin === "" ? person.linkedin : details.linkedin,
    photoUrl: null,
    signIn: { provider: "google", email: login.signInEmail },
    leave,
    details,
  };
}

export function dummySaveLinkedin(text: string): WriteResult<string | null> {
  const checked = normalizeLinkedin(text);
  return checked.ok ? written(checked.value) : refused(checked.error);
}

export function dummySetPhoto(photo: Upload | null): WriteResult<null> {
  if (photo === null) return written(null);
  const error = checkPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
  return error === null ? written(null) : refused(error);
}

/** The details the edit form sent, checked as the database side checks them. */
export function dummySaveDetails(input: unknown): WriteResult<YourDetails> {
  const parsed = parseDetails(input);
  return parsed.ok ? written(parsed.value) : refused(firstDetailError(parsed.errors));
}

export function dummyMyAccount(applicant: { name: string; email: string }, changes: OwnChanges): MyAccount {
  return {
    name: applicant.name,
    signIn: { provider: "google", email: applicant.email },
    details: dummyDetails("non-member", changes),
    openApplications: ownApplicationsOf("non-member").filter((a) => isOpenOwn(a, changes)).length,
  };
}

export function dummyDeleteAccount(options: DeleteAccount): WriteResult<null> {
  return typeof options.withdrawOpenApplications === "boolean" ? written(null) : refused("Check the form.");
}

// My applications ---------------------------------------------------------

function placeOf(positionId: number) {
  const position = positions.find((p) => p.id === positionId)!;
  const division = divisions.find((d) => d.id === position.divisionId)!;
  const department = departments.find((d) => d.id === division.departmentId)!;
  return { position, division, department };
}

/** The lead of a division, who offers its interview times. */
function leadOf(divisionId: number): string {
  return people.find((p) => p.placement.role === "division-lead" && p.placement.divisionId === divisionId)?.name ?? "Your lead";
}

function activeStage(application: DummyOwnApplication, changes: OwnChanges): ActiveStage | null {
  const status = application.status;
  switch (status.kind) {
    case "received":
    case "in-review":
    case "accepted":
      return { kind: status.kind };
    case "interview": {
      const chosenId = changes.slots[application.id];
      const division = placeOf(application.positionId).division;
      return {
        kind: "interview",
        interview: {
          lead: leadOf(division.id),
          slots: status.slots,
          chosen: status.slots.find((s) => s.id === chosenId) ?? null,
        },
      };
    }
    case "not-selected":
    case "joined":
      return null;
  }
}

function activeOf(application: DummyOwnApplication, stage: ActiveStage): ActiveApplication {
  const { position, division, department } = placeOf(application.positionId);
  return {
    id: application.id,
    code: positionCode(dummyApplyPosition(position)),
    title: position.title,
    department: department.name,
    division: division.name,
    sent: application.sent,
    stage,
    files: application.files.map((f) => ({ name: f.name, size: fileSize(f.bytes) })),
    answers: [{ question: position.question, answer: application.answer }],
  };
}

function pastOf(application: DummyOwnApplication, withdrawn: boolean): PastApplication {
  const { position, division, department } = placeOf(application.positionId);
  const status = application.status;
  return {
    id: application.id,
    title: position.title,
    department: department.name,
    division: division.name,
    sent: application.sent,
    outcome: withdrawn
      ? { kind: "withdrawn" }
      : status.kind === "joined"
        ? { kind: "joined", since: status.since }
        : { kind: "not-selected" },
  };
}

/** Boards 50 and 53 for a test developer looking as `kind`; null for the leads, who have no own applications. */
export function dummyMyApplications(kind: ViewerKind, me: { firstName: string; email: string }, changes: OwnChanges): MyApplications | null {
  const own = ownApplicationsOf(kind);
  if (own.length === 0) return null;
  const active: ActiveApplication[] = [];
  const past: PastApplication[] = [];
  for (const application of own) {
    const withdrawn = changes.withdrawn.includes(application.id);
    const stage = withdrawn ? null : activeStage(application, changes);
    if (stage === null) past.push(pastOf(application, withdrawn));
    else active.push(activeOf(application, stage));
  }
  return { firstName: me.firstName, email: me.email, active, past };
}

/** Withdraw: the changes with this application withdrawn, or why it cannot be. */
export function dummyWithdraw(mine: MyApplications | null, changes: OwnChanges, applicationId: number): WriteResult<OwnChanges> {
  const application = mine?.active.find((a) => a.id === applicationId);
  if (!application) return refused("That application is not yours, or it is already over.");
  if (!canWithdraw(application.stage)) return refused("An accepted application cannot be withdrawn.");
  return written({ ...changes, withdrawn: [...changes.withdrawn, applicationId] });
}

/** Pick a time: the changes with this slot chosen, and the slot; or why it cannot be. */
export function dummyChooseSlot(
  mine: MyApplications | null,
  changes: OwnChanges,
  applicationId: number,
  slotId: number,
): WriteResult<{ changes: OwnChanges; slot: InterviewSlot }> {
  const pick = pickableSlot(mine?.active.find((a) => a.id === applicationId), slotId);
  if (!pick.ok) return refused(pick.error);
  return written({ changes: { ...changes, slots: { ...changes.slots, [applicationId]: slotId } }, slot: pick.slot });
}
