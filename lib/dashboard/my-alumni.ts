import type { Alumnus, AlumnusKey } from "@/lib/about/alumni-record";
import { alumnusRow, yearTab } from "./alumni";
import {
  applicantApplicationsOf,
  nextStepOf,
  type ApplicantApplications,
  type NextStep,
  type OverviewPerson,
  type OverviewViewer,
} from "./applicant-overview";
import type { MyApplications } from "./my-applications";
import type { Link } from "./overview";

// An alumnus's own pages (boards 56 and 56b, issue #317): someone off the
// team whom the Alumni record knows. The Overview says where they were and
// whether the Alumni page lists them; My alumni sets that, sets the photo the
// Alumni page shows, and lists their roles by academic year, read-only. The
// roles come from the team record (lib/about/alumni-record.ts); a wrong role
// is the team leader's to fix on the Alumni page. Types and rules only; both
// data sides build `MyAlumni` from the viewer's `Alumnus`.

/**
 * How the public Alumni page treats them: listed; not listed because they
 * asked to be removed, at leave time (#257) or with My alumni's switch; or
 * not listed because an editor hid them on board 78.
 */
export type AlumniListing = "listed" | "removed" | "hidden";

/** One academic year of the role history (board 56b), newest first. */
export type RoleHistoryRow = {
  /** "2024 – 25" */
  readonly year: string;
  /** The record's title that year: "Division Lead". */
  readonly role: string;
  /** The division, else the department or group. */
  readonly unit: string;
};

export type MyAlumni = {
  readonly key: AlumnusKey;
  /** The name the Alumni page prints. */
  readonly name: string;
  readonly photo: string | null;
  /** They asked to be left off the page: at leave time (#257) or with My alumni's switch. */
  readonly askedOff: boolean;
  /** An editor switched them to Hidden on board 78. */
  readonly hiddenByTeam: boolean;
  /** The record's title in their latest year: "Division Lead". */
  readonly lastRole: string;
  /** The unit of that role: "Mission Analysis Division". */
  readonly lastUnit: string;
  /** "2022 – 2025": the first academic year's start to the last one's end. */
  readonly years: string;
  readonly history: readonly RoleHistoryRow[];
};

export function myAlumniOf(alumnus: Alumnus): MyAlumni {
  const row = alumnusRow(alumnus);
  const newestFirst = [...alumnus.lines].reverse();
  return {
    key: alumnus.key,
    name: alumnus.name,
    photo: alumnus.photo,
    askedOff: alumnus.removed,
    hiddenByTeam: !alumnus.shown,
    lastRole: row.lastRole,
    lastUnit: row.lastUnit,
    years: `${row.from} – ${row.to}`,
    history: newestFirst.map((line) => ({ year: yearTab(line.year).replace("–", " – "), role: line.title, unit: line.unit })),
  };
}

/** How the public page treats them: their own request first, then an editor's Hidden. */
export function listingOf(me: Pick<MyAlumni, "askedOff" | "hiddenByTeam">): AlumniListing {
  return me.askedOff ? "removed" : me.hiddenByTeam ? "hidden" : "listed";
}

/** Whether My alumni's switch reads on: they did not ask to be left off. An editor's Hidden is not theirs to undo. */
export function showsMe(me: MyAlumni): boolean {
  return !me.askedOff;
}

/** Them as the switch leaves them, before the write answers. */
export function withShowsMe(me: MyAlumni, on: boolean): MyAlumni {
  return { ...me, askedOff: !on };
}

/** "Division Lead, Mission Analysis Division · 2022 – 2025": how the Alumni page places them. */
export function shownAsLine(me: MyAlumni): string {
  return `${me.lastRole}, ${me.lastUnit} · ${me.years}`;
}

/** The line under My alumni's switch (board 56b): how the page shows them, or why it does not. */
export function switchDetail(me: MyAlumni): string {
  switch (listingOf(me)) {
    case "listed":
      return `Shown as: ${me.name} · ${shownAsLine(me)}`;
    case "removed":
      return "Not shown. Turn this on to appear on the Alumni page again.";
    case "hidden":
      return "The team hid your entry. Ask the team leader if this is wrong.";
  }
}

/** The line under the name on their Overview (board 56). */
export function formerMemberLine(me: MyAlumni): string {
  return `Former member · ${me.lastUnit} · ${me.years}`;
}

/** The card on their Overview (board 56): what the Alumni page does with them, and the way to My alumni. */
export type AlumniCard = {
  readonly title: string;
  readonly detail: string;
  readonly link: Link;
};

export const MY_ALUMNI_LINK: Link = { label: "Open My alumni", href: "/dashboard/my-alumni" };

export function alumniCardOf(me: MyAlumni): AlumniCard {
  switch (listingOf(me)) {
    case "listed":
      return { title: "You are on the Alumni page", detail: `Shown as ${shownAsLine(me)}`, link: MY_ALUMNI_LINK };
    case "removed":
      return { title: "You are not on the Alumni page", detail: "You chose not to be shown. You can change this in My alumni.", link: MY_ALUMNI_LINK };
    case "hidden":
      return { title: "You are not on the Alumni page", detail: "The team hid your entry. Ask the team leader if this is wrong.", link: MY_ALUMNI_LINK };
  }
}

/**
 * An alumnus's Overview (board 56): who they were on the team and the Alumni
 * card. While one of their applications is shown (`isShownAt`,
 * ./my-applications.ts) it lists them as an applicant's Overview does, and
 * what waits on them; with none shown the board has nothing under the card.
 */
export type AlumniOverview = {
  readonly shape: "alumni";
  readonly person: OverviewPerson;
  readonly card: AlumniCard;
  readonly nextStep: NextStep | null;
  readonly applications: Extract<ApplicantApplications, { kind: "rows" }> | null;
};

/** Their circle shows their stored photo, the one the sidebar shows (issue #656). */
export function alumniOverview(viewer: OverviewViewer, me: MyAlumni, mine: MyApplications): AlumniOverview {
  const applications = applicantApplicationsOf(mine);
  return {
    shape: "alumni",
    person: { name: viewer.name, photoUrl: viewer.photoUrl, line: formerMemberLine(me) },
    card: alumniCardOf(me),
    nextStep: nextStepOf(mine.active),
    applications: applications.kind === "rows" ? applications : null,
  };
}

/** My alumni's footnote under the role history (board 56b). */
export const ROLE_HISTORY_NOTE =
  "From the team's records, by academic year. If something is wrong, ask the team leader to fix it on the Alumni page.";
