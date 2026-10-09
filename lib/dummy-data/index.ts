import type { Recruitment } from "@/lib/apply/positions";
import { canSwitchRecruitmentAs, switchRecruitment } from "@/lib/apply/recruitment-switch";
import type { NavCounts } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import {
  checklistProgress,
  type ActivityItem,
  type AttentionItem,
  type ChecklistItem,
  type Overview,
  type PersonalOverview,
  type RosterPerson,
  type TeamOverview,
} from "@/lib/dashboard/overview";
import type { DashboardViewer, ViewerKind } from "@/lib/dashboard/viewer";
import {
  activity,
  applicant,
  departments,
  divisions,
  ownApplications,
  people,
  personFor,
  positions,
  recruitment,
  roster,
  type DummyPerson,
  type DummyPosition,
} from "./team";
import type { DummyRecruitmentStore } from "./recruitment";

// The test developer's side of the dashboard data interface: every answer is
// built from the arrays in ./team.ts, with no database, so it works on a
// preview that has no DATABASE_URL.

/** Who a test developer signed in as `kind` is: the dashboard's user card and the navbar show this name. */
export function dummyViewer(kind: ViewerKind): DashboardViewer {
  if (kind === "non-member") {
    return { kind, name: applicant.name, role: "Applicant", session: "test-developer" };
  }
  const person = personFor[kind];
  return { kind, name: person.name, role: person.title, session: "test-developer" };
}

function divisionOf(id: number) {
  return divisions.find((d) => d.id === id)!;
}

function departmentOf(divisionId: number) {
  const division = divisionOf(divisionId);
  return departments.find((d) => d.id === division.departmentId)!;
}

/** The positions a viewer's figures count: the whole team, or the lead's division. */
function positionsFor(kind: ViewerKind): readonly DummyPosition[] {
  if (kind === "operations-lead") return positions;
  if (kind === "division-lead") return positions.filter((p) => p.divisionId === personFor[kind].divisionId);
  return [];
}

function newApplications(list: readonly DummyPosition[]): number {
  return list.reduce((sum, p) => sum + p.newApplications, 0);
}

function sinceMonday(list: readonly DummyPosition[]): string {
  return `+${list.reduce((sum, p) => sum + p.newSinceMonday, 0)} since Monday`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function attentionFor(kind: ViewerKind): AttentionItem[] {
  const scoped = positionsFor(kind);
  const fresh = scoped
    .filter((p) => p.newApplications > 0)
    .map((p): AttentionItem => ({
      kind: "applications",
      title: `${plural(p.newApplications, "new application", "new applications")} for ${p.title}`,
      detail: `${departmentOf(p.divisionId).name} · ${divisionOf(p.divisionId).name}`,
      action: { label: "Review", href: `/dashboard/applications?position=${p.slug}` },
    }));
  const quiet = scoped
    .filter((p) => p.open && (p.daysSinceLastApplication ?? 0) >= 30)
    .map((p): AttentionItem => ({
      kind: "quiet-position",
      title: `${p.title} has had no applications in ${p.daysSinceLastApplication} days`,
      detail: `${departmentOf(p.divisionId).name} · consider editing or closing it`,
      action: { label: "Open", href: `/dashboard/positions?position=${p.slug}` },
    }));
  const unplaced = kind === "operations-lead" ? people.filter((p) => p.divisionId === null) : [];
  const unassigned: AttentionItem[] =
    unplaced.length === 0
      ? []
      : [
          {
            kind: "unassigned",
            title: `${plural(unplaced.length, "new member has", "new members have")} no division yet`,
            detail: `Added to the ${roster.season} roster`,
            action: { label: "Assign", href: "/dashboard/members" },
          },
        ];
  return [...fresh, ...quiet, ...unassigned];
}

function activityFor(kind: Exclude<ViewerKind, "non-member" | "member">): ActivityItem[] {
  const me = personFor[kind];
  const events =
    kind === "operations-lead" ? activity : activity.filter((a) => a.divisionId === me.divisionId);
  return events.slice(0, 5).map((a) => ({
    actor: a.actor,
    text: a.text,
    when: a.when,
    self: a.actorId === me.id,
  }));
}

function teamOverview(kind: "operations-lead" | "division-lead", { isOpen }: Recruitment): TeamOverview {
  const scoped = positionsFor(kind);
  const open = scoped.filter((p) => p.open);
  const recruitmentStat = {
    label: "Recruitment",
    value: isOpen ? "Open" : "Closed",
    detail: isOpen ? `Public on the site since ${recruitment.since}` : "Positions are hidden on the site",
    live: isOpen,
  };

  if (kind === "operations-lead") {
    const openDepartments = new Set(open.map((p) => departmentOf(p.divisionId).id));
    return {
      shape: "team",
      stats: [
        { label: "New applications", value: String(newApplications(scoped)), detail: sinceMonday(scoped) },
        { label: "Open positions", value: String(open.length), detail: `In ${openDepartments.size} departments` },
        recruitmentStat,
        { label: "Team members", value: String(roster.members), detail: `${roster.season} roster` },
      ],
      attention: attentionFor(kind),
      activity: activityFor(kind),
    };
  }

  const division = divisionOf(personFor[kind].divisionId);
  const members = people.filter((p) => p.divisionId === division.id);
  return {
    shape: "team",
    stats: [
      { label: "New applications", value: String(newApplications(scoped)), detail: sinceMonday(scoped) },
      { label: "Open positions", value: String(open.length), detail: division.name },
      recruitmentStat,
      { label: "Division members", value: String(members.length), detail: `${roster.season} roster` },
    ],
    attention: attentionFor(kind),
    activity: activityFor(kind),
  };
}

function sinceLine(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const month = date.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `In the team since ${month} ${date.getUTCFullYear()}`;
}

/** The lead first, then up to two others, then the viewer (board 40m). */
function rosterPreview(me: DummyPerson): RosterPerson[] {
  const division = people.filter((p) => p.divisionId === me.divisionId);
  const lead = division.filter((p) => p.role === "division-lead");
  const others = division.filter((p) => p.role !== "division-lead" && p.id !== me.id).slice(0, 2);
  return [...lead, ...others, me].map((p) => ({
    name: p.name,
    role: p.id === me.id ? "You" : p.role === "division-lead" ? "Division lead" : "Member",
    lead: p.role === "division-lead",
    self: p.id === me.id,
  }));
}

function memberOverview(): PersonalOverview {
  const me = personFor.member;
  const division = divisionOf(me.divisionId);
  const department = departmentOf(me.divisionId);
  const items: ChecklistItem[] = [
    { label: "Name and division", detail: "Set by your division lead", done: true, action: null },
    { label: "Email", detail: me.email, done: true, action: null },
    {
      label: "Photo",
      detail: "A clear, square photo of your face",
      done: me.hasPhoto,
      action: me.hasPhoto ? null : { label: "Upload", href: "/dashboard/profile" },
    },
    {
      label: "LinkedIn",
      detail: "Optional, shown as an icon on your card",
      done: me.linkedin !== null,
      action: me.linkedin !== null ? null : { label: "Add", href: "/dashboard/profile" },
    },
  ];
  const size = people.filter((p) => p.divisionId === me.divisionId).length;
  return {
    shape: "personal",
    person: {
      name: me.name,
      line: `${me.title} · ${division.name} · ${department.name}`,
      since: sinceLine(me.since),
      edit: { label: "Edit profile", href: "/dashboard/profile" },
    },
    checklist: {
      title: "Your page on the site",
      detail: `This is how you appear on The Team page. ${checklistProgress(items)}`,
      items,
    },
    roster: {
      title: division.name,
      detail: `${department.name} · ${size} people`,
      people: rosterPreview(me),
    },
    applications: null,
    hint: "Need to work on recruitment or site content? Ask your division lead or the admin team for access.",
  };
}

function applicantOverview(): PersonalOverview {
  return {
    shape: "personal",
    person: { name: applicant.name, line: `Applicant · ${applicant.email}`, since: null, edit: null },
    checklist: null,
    roster: null,
    applications: ownApplications.map((a) => {
      const position = positions.find((p) => p.id === a.positionId)!;
      return {
        title: position.title,
        detail: `${departmentOf(position.divisionId).name} · sent ${a.sent}`,
        status: a.status,
      };
    }),
    hint: null,
  };
}

function overviewFor(kind: ViewerKind, current: Recruitment): Overview {
  switch (kind) {
    case "operations-lead":
    case "division-lead":
      return teamOverview(kind, current);
    case "member":
      return memberOverview();
    case "non-member":
      return applicantOverview();
  }
}

function navCountsFor(kind: ViewerKind): NavCounts {
  const fresh = newApplications(positionsFor(kind));
  return fresh > 0 ? { applications: fresh } : {};
}

/**
 * The dashboard as the test developer sees it, looking as `kind`, with the
 * recruitment switch read from and kept in `recruitment` (./recruitment.ts).
 */
export function dummyDashboardData(kind: ViewerKind, recruitment: DummyRecruitmentStore): DashboardData {
  const canSwitch = canSwitchRecruitmentAs(kind);
  return {
    viewer: dummyViewer(kind),
    navCounts: async () => navCountsFor(kind),
    overview: async () => overviewFor(kind, recruitment.current),
    recruitment: async () => ({ recruitment: recruitment.current, canSwitch }),
    // Nothing is cached in dummy mode: /apply reads the cookie on each request.
    setRecruitment: (next) =>
      switchRecruitment(next, { maySwitch: async () => canSwitch, save: recruitment.save, refresh: () => {} }),
  };
}
