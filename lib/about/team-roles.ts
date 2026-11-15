import type { PersonRecord } from "@/lib/dashboard/division-members";
import {
  BOARD_FLAGS,
  boardFlagOf,
  boardTitleOf,
  bySeatOrder,
  divisionLabel,
  roleIn,
  type BoardFlag,
  type BoardRole,
  type OrgChart as TeamOrg,
  type RosterEntry,
} from "@/lib/dashboard/team";
import { ARC_LEADERS, type DrawnGroup, type DrawnTeam, type LeadsDrawn, type TeamPageLayer } from "./team-layer";
import { byName, furtherSeatsOf, personOf, titleOf, type TeamPerson } from "./team-person";
import type { DepartmentGroup, FilledTeamPage, GroupMember, Member, TeamPage, UpTo } from "./types";

// The Team page's places as the team's roles hold them (issue #282, ADR
// 0015): who leads, every department and every core member, as the roles the
// dashboard sets build them. Since ADR 0019 the page draws its stored layout
// of page seats (./team-layout.ts), and this build is read only where a
// layout is built from the team record (`recordLayout`: the seed, a database
// with nothing saved, and Reset to team). The carousel and the drawn page
// below are shared with the layout. The header, "In numbers" and, unless the
// layer sets them, the intro text and the group photo stay the hand-typed
// values of ./team.ts. The advisors come from the stored list
// (./advisors.ts, issue #286), laid on by ./team-data.ts. Pure: the database
// (lib/about/team-data.ts) and the seed (db/seed/cases.ts) read the same build.

export type { TeamPerson } from "./team-person";
export { ARC_LEADERS } from "./team-layer";

/**
 * The seat an arc spot names: a flagged seat by its flag ("project-manager"),
 * any other team-level seat by its role row ("role-27"). Never its title.
 */
export type ArcSeat = BoardFlag | `role-${number}`;

/** The arc key of a team-level seat (`ArcSeat`). */
export function arcSeatOf(seat: BoardRole): ArcSeat {
  return boardFlagOf(seat.fullAccess) ?? `role-${seat.roleId}`;
}

/** A place on the arc the roles fill: a team-level seat, and which of its holders by name (0 is the first). */
export type ArcSpot = `arc:${ArcSeat}:${number}`;
/** A head block: a department by id, and which of its heads by name. */
export type HeadSpot = `head:${number}:${number}`;
/** A division lead row: a division by id, and which of its leads by name. */
export type LeadSpot = `lead:${number}:${number}`;
export type Spot = ArcSpot | HeadSpot | LeadSpot;

const isIdText = (value: string) => /^[1-9]\d{0,9}$/.test(value);

/** Whether `value` names a spot of the roles build. */
export function isSpot(value: unknown): value is Spot {
  if (typeof value !== "string") return false;
  const [kind, a, b, ...rest] = value.split(":");
  if (rest.length > 0 || b === undefined || !/^(0|[1-9]\d{0,5})$/.test(b)) return false;
  if (kind === "arc") return (BOARD_FLAGS as readonly string[]).includes(a) || (a.startsWith("role-") && isIdText(a.slice("role-".length)));
  return (kind === "head" || kind === "lead") && isIdText(a);
}

export type BuiltLeader = { readonly spot: ArcSpot; readonly person: TeamPerson; readonly role: string };
/** `title` is the title their role carries; without one the page reads "Head of" the department. */
export type BuiltHead = { readonly spot: HeadSpot; readonly person: TeamPerson; readonly title: string | undefined };
export type BuiltLead = { readonly spot: LeadSpot; readonly person: TeamPerson; readonly division: string };
/** An open department with a head: its heads by name, and the leads of its divisions in division order. */
export type BuiltDepartment = {
  readonly id: number;
  readonly name: string;
  readonly heads: readonly BuiltHead[];
  readonly leads: readonly BuiltLead[];
};

/** The places the roles fill, each with its spot. */
export type TeamBuild = {
  /** Everyone with an active role. */
  readonly people: readonly TeamPerson[];
  readonly leader: { readonly person: TeamPerson; readonly role: string } | null;
  /** The board seats in reading order, every holder, before the cap of eight. */
  readonly arc: readonly BuiltLeader[];
  readonly departments: readonly BuiltDepartment[];
  /** Everyone the build's places leave out, by name. */
  readonly core: readonly Member[];
};

/** The open departments and divisions, in display order, and everyone with an active role. */
export type TeamRoles = { readonly org: TeamOrg; readonly people: readonly TeamPerson[] };

/** The roster with the contact each member record holds, joined by member id. */
export function teamPeopleOf(roster: readonly RosterEntry[], records: readonly PersonRecord[]): TeamPerson[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return roster.map((entry) => {
    const record = byId.get(entry.id);
    return {
      id: entry.id,
      name: entry.name,
      placement: entry.placement,
      furtherSeats: furtherSeatsOf(entry.placement, record?.beyondDivisions ?? []),
      pageTitle: entry.pageTitle,
      photo: record?.photoUrl ?? null,
      linkedin: record?.details.linkedin ?? null,
      teamEmail: record?.details.prtEmail ?? null,
    };
  });
}

/** A slide holds up to ten members, the carousel up to five slides. */
export const SLIDE_MEMBERS = 10;
export const SLIDES = 5;

/**
 * One place on a carousel slide: a head with the division leads drawn under
 * them, or a division lead drawn at a head's level, as Operations draws its
 * divisions (board 26).
 */
export type CarouselPlace<H, L> = { readonly kind: "head"; readonly head: H; readonly leads: readonly L[] } | { readonly kind: "division"; readonly lead: L };

/** One carousel slide, before it is drawn: the name of the group it shows and its places, at most ten. */
export type CarouselSlide<H, L> = { readonly name: string; readonly places: readonly CarouselPlace<H, L>[] };

/** A department block as the carousel reads it: how it draws its leads, its heads and its leads. */
type CarouselDepartment<H, L> = { readonly leadsDrawn: LeadsDrawn; readonly heads: readonly H[]; readonly leads: readonly L[] };

/** A department group as the carousel reads it: its name and its blocks in order (issue #856). */
export type CarouselGroup<H, L> = { readonly name: string; readonly departments: readonly CarouselDepartment<H, L>[] };

/**
 * A department's places: each head over their division leads, or each head
 * with the leads beside them. Leads come with a head, so a department whose
 * heads are all hidden shows no one, however it draws its leads.
 */
function placesOf<H, L>(department: CarouselDepartment<H, L>): CarouselPlace<H, L>[] {
  if (department.heads.length === 0) return [];
  if (department.leadsDrawn === "under") return department.heads.map((head) => ({ kind: "head", head, leads: department.leads }));
  return [
    ...department.heads.map((head): CarouselPlace<H, L> => ({ kind: "head", head, leads: [] })),
    ...department.leads.map((lead): CarouselPlace<H, L> => ({ kind: "division", lead })),
  ];
}

/**
 * The departments carousel (ADR 0015, amended by issues #325 and #856): the
 * department groups in their order, each named as stored, each block's places
 * in block order. A group fills slides of up to ten places, and a group that
 * draws no one fills none; the carousel keeps at most five slides.
 */
export function carouselOf<H, L>(groups: readonly CarouselGroup<H, L>[]): CarouselSlide<H, L>[] {
  return groups
    .flatMap((group) => {
      const places = group.departments.flatMap((d) => placesOf(d));
      const slides: CarouselSlide<H, L>[] = [];
      for (let i = 0; i < places.length; i += SLIDE_MEMBERS) slides.push({ name: group.name, places: places.slice(i, i + SLIDE_MEMBERS) });
      return slides;
    })
    .slice(0, SLIDES);
}

/** The first `n` items as an `UpTo`, or null for an empty list. */
function upTo<T, N extends number>(list: readonly T[], n: N): UpTo<T, N> | null {
  return list.length === 0 ? null : (list.slice(0, n) as unknown as UpTo<T, N>);
}

/**
 * The team-level seats, in the order the Team tree draws them (`bySeatOrder`),
 * each by its stored title; two people flagged as one seat by name.
 */
function arcOf(people: readonly TeamPerson[]): BuiltLeader[] {
  const seated = people
    .flatMap((p) => (p.placement.role === "board" ? [{ seat: p.placement.seat, arc: arcSeatOf(p.placement.seat), person: p }] : []))
    .sort((a, b) => (a.arc === b.arc ? byName(a.person, b.person) : bySeatOrder(a.seat, b.seat)));
  return seated.map(({ seat, arc, person }, i): BuiltLeader => {
    const n = seated.slice(0, i).filter((s) => s.arc === arc).length;
    return { spot: `arc:${arc}:${n}`, person, role: boardTitleOf(seat) };
  });
}

/**
 * Each open department with a head and an open division: its heads by name,
 * and the leads of its divisions in division order, co-leads by name. A
 * department with no division (R&D, Owner decision of 2026-10-24 on #627) has
 * no block on the carousel: the dashboard draws it as a department, while
 * this page shows its head as a core member, where the editor can place them
 * on the arc, as before it was a department.
 */
function departmentsOf(roles: TeamRoles): BuiltDepartment[] {
  return roles.org.departments.flatMap((department): BuiltDepartment[] => {
    if (!roles.org.divisions.some((d) => d.departmentId === department.id)) return [];
    // A head reads their head role's stored title; a blank one reads "Head of" the department.
    const heads = roles.people
      .flatMap((p) => (p.placement.role === "head" && p.placement.departmentId === department.id ? [{ person: p, title: p.placement.title.trim() }] : []))
      .sort((a, b) => byName(a.person, b.person))
      .map(({ person, title }, n) => ({ spot: `head:${department.id}:${n}` as const, person, title: title === "" ? undefined : title }));
    if (heads.length === 0) return [];
    const leads = roles.org.divisions
      .filter((d) => d.departmentId === department.id)
      .flatMap((division) =>
        roles.people
          .filter((p) => roleIn(p.placement.memberships, division.id) === "lead")
          .sort(byName)
          .map((p, n) => ({ spot: `lead:${division.id}:${n}` as const, person: p, division: divisionLabel(division.name) })),
      );
    return [{ id: department.id, name: department.name, heads, leads }];
  });
}

/**
 * Who the page shows, and where, as the roles alone build it:
 * - who leads: the team leader, then the board seats on the arc;
 * - departments: the head of each open department with a division, with its
 *   division leads;
 * - core members: everyone else with an active role, by name, with their
 *   title. Someone the arc, or the carousel with every department in one
 *   group and its leads under its heads, has no room for is a core member.
 */
export function teamBuildOf(roles: TeamRoles): TeamBuild {
  const leaderPerson = roles.people.filter((p) => p.placement.role === "team-leader").sort(byName)[0];
  const arc = arcOf(roles.people);
  const departments = departmentsOf(roles);
  const oneGroup = [{ name: "", departments: departments.map((d) => ({ ...d, leadsDrawn: "under" as const })) }];
  const carousel = carouselOf(oneGroup).flatMap((slide) =>
    slide.places.flatMap((place) => (place.kind === "head" ? [place.head.person, ...place.leads.map((l) => l.person)] : [place.lead.person])),
  );
  const shown = new Set([leaderPerson, ...arc.slice(0, ARC_LEADERS).map((l) => l.person), ...carousel].flatMap((p) => p?.id ?? []));
  return {
    people: roles.people,
    leader: leaderPerson === undefined ? null : { person: leaderPerson, role: titleOf(leaderPerson) ?? "Team Leader" },
    arc,
    departments,
    core: coreMembersOf(roles.people, shown),
  };
}

/** The core members: everyone in `people` whose id `shown` does not hold, by name, with their title. */
export function coreMembersOf(people: readonly TeamPerson[], shown: ReadonlySet<number>): Member[] {
  return people
    .filter((p) => !shown.has(p.id))
    .sort(byName)
    .map((p): Member => {
      const { photo, linkedin } = personOf(p);
      const role = titleOf(p);
      return {
        name: p.name,
        ...(photo !== undefined && { photo }),
        ...(role !== undefined && { role }),
        ...(linkedin !== undefined && { linkedin }),
      };
    });
}

/** The shown department groups as carousel slides, each named by its group. */
function slidesOf(groups: readonly DrawnGroup[]): DepartmentGroup[] {
  return carouselOf(groups).map((slide) => ({
    name: slide.name,
    members: upTo(
      slide.places.map((place): GroupMember =>
        place.kind === "head"
          ? { ...place.head.shown, leads: place.leads.map((l) => l.shown) }
          : { ...place.lead.shown, kind: "division" },
      ),
      SLIDE_MEMBERS,
    )!,
  }));
}

/**
 * Where each member of the carousel comes from, in the order the slides draw
 * them: a head's `at` (its page seat's id, in the editor), or null for a
 * division lead drawn at a head's level, which the editor reaches through its
 * head.
 */
export function carouselSpotsOf<A>(groups: readonly CarouselGroup<{ readonly at: A }, unknown>[]): (A | null)[] {
  return carouselOf(groups).flatMap((slide) => slide.places.map((place) => (place.kind === "head" ? place.head.at : null)));
}

/** `page` with the layer's intro text, figures and group photo, where it sets them. */
export function withLayerText<P extends TeamPage>(page: P, layer: TeamPageLayer): P {
  return {
    ...page,
    header: {
      ...page.header,
      ...(layer.intro !== null && { intro: layer.intro }),
      ...(layer.figures !== undefined && { stats: layer.figures }),
    },
    coreMembers: layer.groupPhoto === null ? page.coreMembers : { ...page.coreMembers, groupPhoto: layer.groupPhoto },
  };
}

/** The most department heads the carousel shows: five slides of ten. */
export const HEADS_SHOWN_MAX = SLIDES * SLIDE_MEMBERS;

/** A section the page always draws: the team leader, the arc of leaders, the departments area, the core members. */
export type TeamPageSection = "leader" | "arc" | "departments" | "core";

/**
 * The Team page as `shown` lays it out, with the core members of `build`,
 * onto `base` (the hand-typed ./team.ts) for everything else. A section
 * `shown` fills no one in is drawn empty, never filled from `base` (ADR 0019
 * Decision 9): the stored layout's page reads it so (./team-layout.ts).
 */
export function drawnTeamPage(build: { readonly core: readonly Member[] }, shown: DrawnTeam, base: TeamPage): TeamPage {
  const page: TeamPage = {
    ...base,
    orgChart: { ...base.orgChart, leader: shown.leader, leaders: upTo(shown.leaders.map((l) => l.shown), ARC_LEADERS) ?? [] },
    departments: { ...base.departments, groups: upTo(slidesOf(shown.groups), SLIDES) ?? [] },
    coreMembers: { ...base.coreMembers, members: build.core },
  };
  return withLayerText(page, shown);
}

/** `page` as one that fills every section the page always draws, or the first section it leaves empty. */
function filledOrEmpty(page: TeamPage): { readonly page: FilledTeamPage } | { readonly empty: TeamPageSection } {
  const { leader, leaders } = page.orgChart;
  const { groups } = page.departments;
  const [firstCore, ...restCore] = page.coreMembers.members;
  if (leader === null) return { empty: "leader" };
  if (leaders.length === 0) return { empty: "arc" };
  if (groups.length === 0) return { empty: "departments" };
  if (firstCore === undefined) return { empty: "core" };
  return {
    page: {
      ...page,
      orgChart: { ...page.orgChart, leader, leaders },
      departments: { ...page.departments, groups },
      coreMembers: { ...page.coreMembers, members: [firstCore, ...restCore] },
    },
  };
}

/** `page` as one that fills every section the page always draws, or null when it leaves one empty (`emptySectionOf`). */
export function filledTeamPage(page: TeamPage): FilledTeamPage | null {
  const laid = filledOrEmpty(page);
  return "page" in laid ? laid.page : null;
}

/** The first section the page always draws that `page` leaves empty: no team leader, no one on the arc, no department head, no one left for core members; null when none is. */
export function emptySectionOf(page: TeamPage): TeamPageSection | null {
  const laid = filledOrEmpty(page);
  return "empty" in laid ? laid.empty : null;
}
