// The shapes the /projects page draws (boards 22 and 22m). The entries
// themselves are read off the projects' stored records
// (lib/project-content/record.ts, issue #295), and the header counts are
// derived from their launches.

import { rocketModelOf, type OwnEngineModel, type OwnRocketModel, type RocketModel } from "@/lib/rocket-model";

/** Text with an optional shorter phone version (board 22m). */
export type Copy = { text: string; phone?: string };

export type Spec = { label: Copy; value: Copy };

/** A flight that left the pad. Its result reads nominal or as a setback. */
export type Flight = {
  apogee: string;
  maxSpeed: string;
  nominal: boolean;
  /** Where it flew, for the header's country count. */
  country: string;
};

/** An award won at a campaign. `short` is board 22's label where the full name is too long for the log. */
export type Award = { name: string; short?: string; citation?: string };

/** One campaign on the launch log. `flight` is null when the vehicle never left the pad. */
export type Launch = {
  date: string;
  where: string;
  flight: Flight | null;
  result: string;
  award?: Award;
};

export type WorkLine = { code: string; name: string };

/**
 * A project's page. Every published project has one, served by the one
 * dynamic route app/projects/[slug] (issue #301).
 */
export type ProjectPage = `/projects/${string}`;

type ProjectBase = {
  slug: string;
  /** Its own page: the card links there. */
  href: ProjectPage;
  index: string;
  years: string;
  name: string;
  description: Copy;
  /** Six specs, laid out 3 x 2. */
  specs: readonly [Spec, Spec, Spec, Spec, Spec, Spec];
  texture: string;
};

/** A rocket: it has versions and a launch log, and its status counts its flights. */
export type Vehicle = ProjectBase & {
  kind: "vehicle";
  /** The rocket its panel draws, the one its home card draws; with none, the placeholder (issue #381). */
  rocket?: OwnRocketModel;
  /** The first version is the current one and reads highlighted. */
  versions: readonly string[];
  launches: readonly Launch[];
  /** The phone accordion row, after "LAUNCH LOG · ". */
  logSummary: string;
};

/** An engine in development: work lines and a milestone note in place of a launch log. */
export type Engine = ProjectBase & {
  kind: "engine";
  /** The engine its panel draws (issue #382); with none, the panel is the texture only. */
  engine?: OwnEngineModel;
  workLines: readonly WorkLine[];
  milestone: string;
};

export type Project = Vehicle | Engine;

/**
 * A /projects pill: a rocket that has flown counts its flights; one that has
 * not reads IN DESIGN, as its Home card does (Owner decision on #522); an
 * engine is in development.
 */
export type ProjectStatus = { kind: "flown"; flights: number } | { kind: "in-design" } | { kind: "in-development" };

export function flightsOf(project: Project): Flight[] {
  if (project.kind === "engine") return [];
  return project.launches.flatMap((l) => (l.flight ? [l.flight] : []));
}

export function statusOf(project: Project): ProjectStatus {
  if (project.kind === "engine") return { kind: "in-development" };
  const flights = flightsOf(project).length;
  return flights === 0 ? { kind: "in-design" } : { kind: "flown", flights };
}

/**
 * The model a /projects panel draws (issue #381): a rocket draws its own
 * model, or the placeholder when it has none. An engine never draws a rocket:
 * it draws its own engine model (issue #382), and with none its panel is the
 * texture only.
 */
export function panelRocketOf(project: Project): RocketModel | null {
  return project.kind === "vehicle" ? rocketModelOf(project.rocket) : (project.engine ?? null);
}

export type Stat = { value: string; label: string };

/**
 * The header's three counts, from the published launch logs: every flight,
 * the countries they flew in and the awards won. A launch added and
 * published changes them with no code change (issue #295).
 */
export function launchCounts(all: readonly Project[]): readonly [Stat, Stat, Stat] {
  const flights = all.flatMap(flightsOf);
  const countries = new Set(flights.map((f) => f.country));
  const awards = all.flatMap((p) => (p.kind === "vehicle" ? p.launches : [])).filter((l) => l.award);
  return [
    { value: String(flights.length), label: "FLIGHTS" },
    { value: String(countries.size), label: "COUNTRIES" },
    { value: String(awards.length), label: "AWARDS" },
  ];
}
