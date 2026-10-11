import { DEGREE_PROGRAMMES, STUDY_PROGRAMMES } from "@/lib/apply/application-form";
import type { MemberDetails } from "@/lib/dashboard/details";
import { homeDivisionOf, membershipsIn, roleIn } from "@/lib/dashboard/team";
import { signIns } from "./self";
import { people, type DummyPerson } from "./team";

// The dummy team's private details for the Members page (issue #231, boards
// 61f and 61g): contact, studies and the NDA, made up from each person's row
// in ./team.ts so the page reads the same on every request. Gender is left
// empty: the rows say nothing about it, and a guess from a name would be wrong.

function nameParts(name: string): { first: string; last: string } {
  const [first = "", ...rest] = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ");
  return { first, last: rest.join("") };
}

/** The Google account they sign in with: the one My profile shows, else a made-up Gmail address. */
export function dummySignInEmail(person: DummyPerson): string {
  const known = signIns.find((s) => s.personId === person.id);
  if (known) return known.signInEmail;
  if (!person.email.endsWith("@politorocketteam.it")) return person.email;
  const { first, last } = nameParts(person.name);
  return `${first}.${last}@gmail.com`;
}

const PROGRAMMES: Readonly<Record<string, (typeof DEGREE_PROGRAMMES)[number]>> = {
  "Aerospace Eng.": "Aerospace Engineering",
  "Mechanical Eng.": "Mechanical Engineering",
  Physics: "Physics Engineering",
  "Mathematical Eng.": "Mathematical Engineering",
  "Computer Eng.": "Computer Engineering",
  "Electronic Eng.": "Electronic Engineering",
  "Energy Eng.": "Energy Engineering",
};

/** "MSc · year 2" reads "Year 2 Master's". */
function levelOf(study: string): (typeof STUDY_PROGRAMMES)[number] | "" {
  const match = /^(BSc|MSc) · year (\d)$/.exec(study);
  if (!match) return "";
  const level = `Year ${match[2]} ${match[1] === "BSc" ? "Bachelor's" : "Master's"}`;
  return STUDY_PROGRAMMES.find((s) => s === level) ?? "";
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function dummyMemberDetails(person: DummyPerson): MemberDetails {
  const { first, last } = nameParts(person.name);
  const id = person.id;
  const teamEmail = signIns.find((s) => s.personId === id)?.teamEmail ?? person.email;
  return {
    prtEmail: teamEmail.endsWith("@politorocketteam.it") ? teamEmail : "",
    phone: `+39 3${40 + (id % 10)} ${100 + ((id * 37) % 900)} ${pad(1000 + ((id * 271) % 9000), 4)}`,
    discord: `${first}.${last.slice(0, 1)}`,
    linkedin: `linkedin.com/in/${first}-${last}`,
    politoId: String(300000 + ((id * 1373) % 60000)),
    programme: PROGRAMMES[person.program] ?? "",
    level: levelOf(person.study),
    country: id % 6 === 0 ? "Spain" : "Italy",
    birthDate: `${1999 + (id % 6)}-${pad(1 + (id % 12), 2)}-${pad(1 + ((id * 7) % 28), 2)}`,
    gender: "",
  };
}

/**
 * The day they signed the team's one NDA (ADR 0014), the October they
 * joined, and who confirmed it: the lead of their home division, or the team
 * leader for a lead, a head or a seat.
 */
export function dummyNda(person: DummyPerson): { signedOn: string; confirmedBy: string | null } {
  const home = homeDivisionOf(person.placement);
  const lead =
    home === null || roleIn(membershipsIn(person.placement), home) === "lead"
      ? undefined
      : people.find((p) => p.id !== person.id && roleIn(membershipsIn(p.placement), home) === "lead");
  const leader = people.find((p) => p.placement.role === "team-leader");
  const by = lead ?? (leader?.id === person.id ? undefined : leader);
  return { signedOn: `${person.since.slice(0, 4)}-10-15`, confirmedBy: by?.name ?? null };
}
