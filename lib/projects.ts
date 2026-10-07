// The /projects page data (boards 22 and 22m), from design/specs-from-old-site.md.
// One typed place: the page renders it and derives its header counts from it,
// so a new launch changes the flights, countries and awards in one edit.

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

/** A project page that exists. Add a route here when its page ships. */
export type ProjectPage = "/projects/cavour";

type ProjectBase = {
  slug: string;
  /** Its own page, when it has one: the card links there. No page, no link. */
  href?: ProjectPage;
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
  /** The first version is the current one and reads highlighted. */
  versions: readonly string[];
  launches: readonly Launch[];
  /** The phone accordion row, after "LAUNCH LOG · ". */
  logSummary: string;
};

/** An engine in development: work lines and a milestone note in place of a launch log. */
export type Engine = ProjectBase & {
  kind: "engine";
  workLines: readonly WorkLine[];
  milestone: string;
};

export type Project = Vehicle | Engine;

export type ProjectStatus = { kind: "flown"; flights: number } | { kind: "in-development" };

export function flightsOf(project: Project): Flight[] {
  if (project.kind === "engine") return [];
  return project.launches.flatMap((l) => (l.flight ? [l.flight] : []));
}

export function statusOf(project: Project): ProjectStatus {
  return project.kind === "engine"
    ? { kind: "in-development" }
    : { kind: "flown", flights: flightsOf(project).length };
}

// Numbers use a no-break space as the thousands separator, as the boards do,
// so "3 143 m" never wraps inside the number.
const nb = " ";

/**
 * Cavour's three flights, the one source for both /projects and /projects/cavour.
 * Kept literal (`as const`) so the Cavour page can key its own copy by launch
 * date and know that every one of these flew.
 */
export const cavourLaunches = [
  {
    date: "29 Apr 2023",
    where: "Bavaria, Germany · test launch",
    flight: { apogee: `1${nb}331 m`, maxSpeed: "163 m/s", nominal: true, country: "Germany" },
    result: "Nominal. Recovered intact, reusable.",
  },
  {
    date: "22 Jun 2023",
    where: "Spaceport America Cup, New Mexico",
    flight: { apogee: `3${nb}143 m`, maxSpeed: "295 m/s", nominal: true, country: "USA" },
    result: "Nominal. 20th of 119 universities.",
    award: {
      name: "DR. GIL MOORE AWARD FOR INNOVATION",
      citation: "3D-printed multilayered fins for flutter suppression",
    },
  },
  {
    date: "13 Oct 2023",
    where: "EuRoC, Santa Margarida, Portugal",
    flight: { apogee: `2${nb}800 m`, maxSpeed: "266 m/s", nominal: false, country: "Portugal" },
    result: "Boost nominal. Recovery failed, 75 m/s impact.",
    award: { name: "ANACOM BEST TELEMETRY SPECTRAL SIGNATURE AWARD", short: "ANACOM BEST TELEMETRY AWARD" },
  },
] as const satisfies readonly Launch[];

export type CavourLaunch = (typeof cavourLaunches)[number];

export const projects: readonly Project[] = [
  {
    kind: "vehicle",
    slug: "cavour",
    href: "/projects/cavour",
    index: "01",
    years: "2022 – 2023",
    name: "Cavour",
    description: {
      text: "The Team's first rocket, named after Camillo Benso, Count of Cavour. Single stage, solid COTS motor, 100 mm internal diameter, composite airframe with 3D-printed carbon-reinforced internals. Modular enough to fly three configurations in one year.",
      phone:
        "The Team's first rocket. Single stage, solid motor, composite airframe. Three configurations in one year.",
    },
    versions: ["CVR 100-75-3", "CVR 100-75-4", "CVR 100-54-6"],
    specs: [
      { label: { text: "DIAMETER" }, value: { text: "104 mm" } },
      { label: { text: "LENGTH" }, value: { text: `2${nb}167 mm` } },
      { label: { text: "WET MASS" }, value: { text: "8.4 kg" } },
      { label: { text: "MOTOR" }, value: { text: "CTI L1350" } },
      { label: { text: "MAX SPEED" }, value: { text: "320 m/s" } },
      { label: { text: "TARGET APOGEE", phone: "APOGEE" }, value: { text: `3${nb}000 m` } },
    ],
    texture: "/textures/project-cavour.webp",
    logSummary: "3 FLIGHTS",
    launches: cavourLaunches,
  },
  {
    kind: "vehicle",
    slug: "ves",
    index: "02",
    years: "2023 – 2025",
    name: "VES",
    description: {
      text: "Vittorio Emanuele II. The second rocket of the Founding Fathers series, 130 mm internal diameter, built to fly student-designed systems: flight computer, ground station, ejection recovery and airbrakes. Mark I flew EuRoC 2024. Mark II was built supersonic for IREC 2025.",
      phone:
        "Second Founding Fathers rocket, built to fly student-designed avionics, recovery and airbrakes.",
    },
    versions: ["VES Mark II", "VES Mark I", "Test version"],
    specs: [
      { label: { text: "DIAMETER" }, value: { text: "134 mm" } },
      { label: { text: "LENGTH" }, value: { text: `3${nb}650 mm` } },
      { label: { text: "WET MASS" }, value: { text: "33.4 kg" } },
      { label: { text: "MOTOR" }, value: { text: "Aerotech O5500X", phone: "AT O5500X" } },
      { label: { text: "MAX SPEED" }, value: { text: "626 m/s · Mach 1.8", phone: "Mach 1.8" } },
      { label: { text: "TARGET APOGEE", phone: "APOGEE" }, value: { text: `9${nb}000 m` } },
    ],
    texture: "/textures/project-ves.webp",
    logSummary: "2 CAMPAIGNS",
    launches: [
      {
        date: "12 Oct 2024",
        where: "EuRoC, Santa Margarida, Portugal · Mark I",
        flight: { apogee: `3${nb}160 m`, maxSpeed: "259 m/s", nominal: true, country: "Portugal" },
        result: "Nominal flight. Split on descent, both halves recovered. 6th of 25 teams.",
      },
      {
        date: "13 Jul 2025",
        where: "IREC, Midland, Texas · Mark II",
        flight: null,
        result:
          "Did not fly. COTS motor failed on ignition (manufacturer defect). Avionics, recovery and nose cone recovered intact.",
        award: { name: "1ST PLACE DESIGN & BUILD QUALITY" },
      },
    ],
  },
  {
    kind: "engine",
    slug: "efesto",
    index: "03",
    years: "2023 – NOW",
    name: "Efesto",
    description: {
      text: "Not a rocket: a liquid rocket engine, and the first pressure-fed one built in Italy. Regeneratively cooled, printed as one assembly, with a copper metal-matrix chamber developed with Politecnico's labs. It is the propulsion for the Team's first bi-liquid vehicle.",
      phone: "Not a rocket: Italy's first pressure-fed liquid engine, printed in copper.",
    },
    specs: [
      { label: { text: "OXIDIZER" }, value: { text: "Nitrous oxide (N₂O)", phone: "N₂O" } },
      { label: { text: "FUEL" }, value: { text: "Ethanol" } },
      { label: { text: "TARGET THRUST", phone: "THRUST" }, value: { text: "5 kN" } },
      { label: { text: "CYCLE" }, value: { text: "Pressure-fed" } },
      { label: { text: "COOLING" }, value: { text: "Regenerative" } },
      { label: { text: "CHAMBER" }, value: { text: "Cu metal-matrix, printed", phone: "Cu MMC, printed" } },
    ],
    texture: "/textures/project-efesto.webp",
    workLines: [
      { code: "TCA", name: "Thrust Chamber Assembly" },
      { code: "EC", name: "Engine Cycle · RocketForge tool" },
      { code: "LSA", name: "Liquid System Architecture" },
      { code: "TB", name: "Test Bench" },
      { code: "ECS", name: "Engine Control Strategy" },
    ],
    milestone: "INJECTOR HEAD PRESENTED · 26TH ESA PAC SYMPOSIUM, LUZERN · MAY 2024",
  },
];

export type Stat = { value: string; label: string };

/**
 * The header's five figures. Flights, countries and awards are counted from
 * the launch logs; the two targets are VES Mark II's apogee and Efesto's thrust.
 */
export function headerStats(all: readonly Project[] = projects): readonly Stat[] {
  const flights = all.flatMap(flightsOf);
  const countries = new Set(flights.map((f) => f.country));
  const awards = all.flatMap((p) => (p.kind === "vehicle" ? p.launches : [])).filter((l) => l.award);
  return [
    { value: String(flights.length), label: "FLIGHTS" },
    { value: String(countries.size), label: "COUNTRIES" },
    { value: String(awards.length), label: "AWARDS" },
    { value: `9${nb}000 m`, label: "TARGET APOGEE" },
    { value: "5 kN", label: "ENGINE TARGET" },
  ];
}
