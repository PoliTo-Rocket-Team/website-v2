import type { PersonRecord } from "@/lib/dashboard/division-members";
import { boardTitleOf, bySeatOrder, divisionLabel, roleIn, type DepartmentKind, type OrgChart as TeamOrg, type RosterEntry } from "@/lib/dashboard/team";
import {
  applyLayer,
  arcSeatOf,
  ARC_LEADERS,
  NO_TEAM_LAYER,
  type BuiltDepartment,
  type BuiltLeader,
  type DrawnGroup,
  type DrawnTeam,
  type LeadsDrawn,
  type ShownTeam,
  type TeamBuild,
  type TeamPageLayer,
} from "./team-layer";
import { byName, furtherSeatsOf, personOf, titleOf, type TeamPerson } from "./team-person";
import type { DepartmentGroup, FilledTeamPage, GroupMember, Member, TeamPage, UpTo } from "./types";

// The Team page built from the team's roles (issue #282, ADR 0015): who
// leads, every department and every core member come from the roles the
// dashboard sets, so a title saved on the member panel reaches the page once
// the `team-roster` cache is refreshed. The visual layer (./team-layer.ts,
// issue #283) is laid on that build; the header, "In numbers" and, unless
// the layer sets them, the intro text and the group photo stay the
// hand-typed values of ./team.ts. The advisors come from the stored list
// (./advisors.ts, issue #286), laid on by ./team-data.ts. Pure: the database
// (lib/about/team-data.ts) and the seed (db/seed/cases.ts) read the same build.

export type { TeamPerson } from "./team-person";
export { ARC_LEADERS } from "./team-layer";

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
 * Today's grouping, before department groups (issue #325, boards 26, 26e,
 * 26f, 26m): a department's kind on the team record put its head on the
 * "Technical Departments" slides, its leads under them, or on the
 * "Operations" slides, its leads beside them. Since issue #856 the page draws
 * the groups its stored layout names, and this is read only to snapshot
 * today's page into a first layout (./team-layout.ts `snapshot`) and by the
 * roles build that snapshot reads: no other Team page code reads a
 * department's kind.
 */
export const TODAYS_GROUPS: readonly { readonly kind: DepartmentKind; readonly name: string; readonly leadsDrawn: LeadsDrawn }[] = [
  { kind: "technical", name: "Technical Departments", leadsDrawn: "under" },
  { kind: "operations", name: "Operations", leadsDrawn: "beside" },
];

/** Today's group of a department of kind `kind` (`TODAYS_GROUPS`). */
export function todaysGroupOf(kind: DepartmentKind): (typeof TODAYS_GROUPS)[number] {
  return TODAYS_GROUPS.find((g) => g.kind === kind) ?? TODAYS_GROUPS[0];
}

/** `departments` in today's two groups, in that order, each drawing its leads as its kind did (`TODAYS_GROUPS`). */
export function todaysGroupsOf<D extends { readonly kind: DepartmentKind }>(
  departments: readonly D[],
): { readonly name: string; readonly departments: readonly (D & { readonly leadsDrawn: LeadsDrawn })[] }[] {
  return TODAYS_GROUPS.map((group) => ({
    name: group.name,
    departments: departments.filter((d) => d.kind === group.kind).map((d) => ({ ...d, leadsDrawn: group.leadsDrawn })),
  }));
}

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
    // A head reads their head role's stored title; a blank one reads "Head of" the department (./team-layer.ts).
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
    return [{ id: department.id, name: department.name, kind: department.kind, heads, leads }];
  });
}

/**
 * Who the page shows, and where, as the roles alone build it:
 * - who leads: the team leader, then the board seats on the arc;
 * - departments: the head of each open department with a division, with its
 *   division leads;
 * - core members: everyone else with an active role, by name, with their
 *   title. Someone the arc or the carousel has no room for is a core member.
 */
export function teamBuildOf(roles: TeamRoles): TeamBuild {
  const leaderPerson = roles.people.filter((p) => p.placement.role === "team-leader").sort(byName)[0];
  const arc = arcOf(roles.people);
  const departments = departmentsOf(roles);
  const carousel = carouselOf(todaysGroupsOf(departments)).flatMap((slide) =>
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

/** The page the roles build with the layer laid on, as drawn: its departments in today's two groups (`TODAYS_GROUPS`). */
export function todaysDrawnTeam(shown: ShownTeam): DrawnTeam {
  return { ...shown, groups: todaysGroupsOf(shown.departments) };
}

/** `page` with the layer's intro text, figures and group photo, where it sets them. */
export function withLayerText<P extends TeamPage>(page: P, layer: Pick<TeamPageLayer, "intro" | "figures" | "groupPhoto">): P {
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
export function drawnTeamPage(build: Pick<TeamBuild, "core">, shown: DrawnTeam, base: TeamPage): TeamPage {
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

/**
 * The Team page as `shown` lays it out (`drawnTeamPage`), or null when a
 * section the page always draws is empty (`emptySectionOf`): the editor's
 * working layer, which may not empty one.
 */
export function teamPageOf(build: Pick<TeamBuild, "core">, shown: DrawnTeam, base: TeamPage): FilledTeamPage | null {
  const laid = filledOrEmpty(drawnTeamPage(build, shown, base));
  return "page" in laid ? laid.page : null;
}

/** The first section the page always draws that `page` leaves empty: no team leader, no one on the arc, no department head, no one left for core members; null when none is. */
export function emptySectionOf(page: TeamPage): TeamPageSection | null {
  const laid = filledOrEmpty(page);
  return "empty" in laid ? laid.empty : null;
}

/**
 * The Team page built from the roles with `layer` laid on (none by default),
 * onto `base` for everything else; null when the roles cannot fill a section
 * the page always draws (`teamPageOf`).
 */
export function teamPageFromRoles(roles: TeamRoles, base: TeamPage, layer: TeamPageLayer = NO_TEAM_LAYER): FilledTeamPage | null {
  const build = teamBuildOf(roles);
  return teamPageOf(build, todaysDrawnTeam(applyLayer(build, layer)), base);
}
