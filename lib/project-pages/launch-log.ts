import type { Copy, Launch } from "@/lib/projects";
import type { LaunchLog, LogEntry, Stat, Version } from "./types";

// A launch history joins two records: the campaign's facts (date, apogee,
// max speed, award) from lib/projects.ts, the one source /projects also reads
// (issue #72), and the page's own copy for it, keyed by launch date. The
// copy's shape follows the launch: a campaign that flew adds two numbers to
// its apogee and max speed, and one that went wrong must say how; one that
// never left the pad has no flight numbers, so it gives all four itself.

/** A number only the page shows; `phoneLabel` is the phone card's shorter label. */
export type PageStat = Stat & { phoneLabel?: string };

type StoryBase = {
  title: string;
  place: Copy;
  version: Version;
  summary: Copy & { phone: string };
};

type FlownStory = StoryBase & {
  /** The two numbers after apogee and max speed. */
  stats: readonly [PageStat, PageStat];
  /** Which of those two the phone card keeps. */
  phoneStat: 0 | 1;
};

type GroundedStory = StoryBase & {
  stats: readonly [PageStat, PageStat, PageStat, PageStat];
  /** The one the phone card leaves out. */
  phoneDrops: 0 | 1 | 2 | 3;
  setback?: never;
};

/** The copy a launch needs, decided by whether and how it flew. */
export type StoryFor<L extends Launch> = L["flight"] extends null
  ? GroundedStory
  : L["flight"] extends { nominal: true }
    ? FlownStory & { setback?: never }
    : FlownStory & { setback: "recovery-failed" };

type Stories<Ls extends readonly Launch[]> = {
  [D in Ls[number]["date"]]: StoryFor<Extract<Ls[number], { date: D }>>;
};

const phone = (s: PageStat): Stat => ({ value: s.value, label: s.phoneLabel ?? s.label });
const plain = (s: PageStat): Stat => ({ value: s.value, label: s.label });

function motorOf(version: Version): string {
  if (!version.specs.motor) throw new Error(`${version.pill} names no motor`);
  return version.specs.motor;
}

function entry(launch: Launch, story: FlownStory | GroundedStory, setback: "recovery-failed" | undefined): LogEntry {
  const base = {
    date: launch.date,
    title: story.title,
    place: story.place,
    version: story.version.pill,
    motor: motorOf(story.version),
    summary: story.summary,
    award: launch.award,
  };
  if (launch.flight === null) {
    const grounded = story as GroundedStory;
    const [a, b, c, d] = grounded.stats;
    const kept = grounded.stats.filter((_, i) => i !== grounded.phoneDrops).map(phone);
    return {
      ...base,
      outcome: "did-not-fly",
      stats: [plain(a), plain(b), plain(c), plain(d)],
      phoneStats: [kept[0], kept[1], kept[2]],
    };
  }
  const flown = story as FlownStory;
  const apogee = { value: launch.flight.apogee, label: "APOGEE" };
  const maxSpeed = { value: launch.flight.maxSpeed, label: "MAX SPEED" };
  return {
    ...base,
    outcome: setback ?? "nominal",
    stats: [apogee, maxSpeed, plain(flown.stats[0]), plain(flown.stats[1])],
    phoneStats: [apogee, maxSpeed, phone(flown.stats[flown.phoneStat])],
  };
}

/** The launch history: the shared launches, in order, each with the page's copy. */
export function launchLog<const Ls extends readonly [Launch, ...Launch[]]>(
  title: string,
  launches: Ls,
  stories: Stories<Ls>,
): LaunchLog {
  const byDate = stories as Record<string, FlownStory | GroundedStory>;
  const toEntry = (launch: Launch) => {
    const story = byDate[launch.date];
    return entry(launch, story, "setback" in story ? story.setback : undefined);
  };
  const [first, ...rest] = launches;
  return { title, entries: [toEntry(first), ...rest.map(toEntry)] };
}
