import {
  checkPhoto,
  isOpenApplication,
  normalizeLinkedin,
  type DeleteAccount,
  type MyAccount,
  type MyProfile,
} from "@/lib/dashboard/self";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { departments, divisions, ownApplications, positions, type DummyPerson } from "./team";

// The viewer's own pages for the test developer (boards 45 and 45b, issue
// #145 with #146 folded in).

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

export function dummyMyProfile(person: DummyPerson): MyProfile {
  const division = divisions.find((d) => d.id === person.divisionId);
  const login = signInOf(person);
  return {
    name: person.name,
    role: division ? `${person.title} · ${division.name}` : person.title,
    teamEmail: login.teamEmail,
    linkedin: person.linkedin,
    photoUrl: null,
    signIn: { provider: "google", email: login.signInEmail },
    leave: "on-team",
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

export function dummyMyAccount(applicant: { name: string; email: string }): MyAccount {
  return {
    name: applicant.name,
    // One application per person and position, so the position names it.
    applications: ownApplications.map((a) => {
      const position = positions.find((p) => p.id === a.positionId)!;
      const division = divisions.find((d) => d.id === position.divisionId)!;
      const department = departments.find((d) => d.id === division.departmentId)!;
      return {
        id: a.positionId,
        title: position.title,
        detail: `${department.name} · sent ${a.sent}`,
        status: a.status,
      };
    }),
    signIn: { provider: "google", email: applicant.email },
  };
}

export function dummyWithdraw(applicant: { name: string; email: string }, applicationId: number): WriteResult<null> {
  const application = dummyMyAccount(applicant).applications.find((a) => a.id === applicationId);
  if (!application) return refused("That application is not yours.");
  return isOpenApplication(application.status) ? written(null) : refused("Only an open application can be withdrawn.");
}

export function dummyDeleteAccount(options: DeleteAccount): WriteResult<null> {
  return typeof options.withdrawOpenApplications === "boolean" ? written(null) : refused("Check the form.");
}
