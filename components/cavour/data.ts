import type { GalleryItem } from "@/components/gallery/items";

// Cavour's facts, every one from design/specs-from-old-site.md. Figures are
// set as the boards set them ("2 167 mm"), with no-break spaces so a figure
// never wraps; only figures go through n(), never running copy. Where the
// specs file gives no value the field is null and the page says so; nothing
// is filled in by guess.

const n = (s: string) => s.replace(/ /g, "\u00A0");

export const keyFacts = [
  { value: "104 mm", label: "DIAMETER" },
  { value: n("2 167 mm"), label: "LENGTH" },
  { value: "8.4 kg", label: "WET MASS" },
  { value: "CTI L1350", label: "MOTOR" },
  { value: "320 m/s", label: "MAX SPEED" },
  { value: n("3 143 m"), label: "BEST APOGEE" },
] as const;

/** Nose to motor, numbered bottom to top as on board 23. */
export const compartments = [
  { num: "05", name: "Nose cone", desc: "Ogive, composite", phone: "Ogive, composite" },
  {
    num: "04",
    name: "Recovery bay",
    desc: "Drogue and main parachutes, tethers, ejection",
    phone: "Drogue + main, tethers, ejection",
  },
  {
    num: "03",
    name: "Payload bay",
    desc: "The mission's scientific payload, up to 4 kg",
    phone: "Scientific payload, up to 4 kg",
  },
  {
    num: "02",
    name: "Avionics bay",
    desc: "Flight computer, sensors, telemetry",
    phone: "Flight computer, sensors, telemetry",
  },
  { num: "01", name: "Motor bay", desc: "COTS solid motor, CTI L1350 or K940", phone: "CTI L1350 or K940" },
] as const;

export const specRows = [
  ["diameter", "DIAMETER"],
  ["length", "LENGTH"],
  ["emptyMass", "EMPTY MASS"],
  ["wetMass", "WET MASS"],
  ["payload", "PAYLOAD"],
  ["motor", "MOTOR"],
  ["thrustToWeight", "LIFTOFF T/W"],
  ["maxThrust", "MAX THRUST"],
  ["maxSpeed", "MAX SPEED"],
  ["targetApogee", "TARGET APOGEE"],
] as const;

type SpecKey = (typeof specRows)[number][0];

export type ConfigId = "100-75-3" | "100-75-4" | "100-54-6";

export type Config = {
  id: ConfigId;
  /** What the configuration was for, under its pill. */
  role: string;
  /** null where the specs file gives no value. */
  specs: Record<SpecKey, string | null>;
};

/** The SA Cup and EuRoC flight configuration: highlighted on desktop, the default tab on phones. */
export const FLIGHT_CONFIG: ConfigId = "100-75-4";

export const configs: readonly Config[] = [
  {
    id: "100-75-3",
    role: n("DESIGN · 3 000 m"),
    specs: {
      diameter: "104 mm",
      length: n("2 167 mm"),
      emptyMass: "4.8 kg",
      wetMass: "8.4 kg",
      payload: "4 kg · scientific",
      motor: "CTI L1350",
      thrustToWeight: "13.7",
      maxThrust: n("1 672.5 N"),
      maxSpeed: "320 m/s",
      targetApogee: n("3 000 m"),
    },
  },
  {
    id: "100-75-4",
    role: "SA CUP + EUROC 2023",
    specs: {
      diameter: "104 mm",
      length: n("2 527 mm"),
      emptyMass: "5.1 kg",
      wetMass: "9.3 kg",
      payload: "540 g",
      motor: "CTI L1350",
      thrustToWeight: "12.9",
      maxThrust: n("1 672.5 N"),
      maxSpeed: "295 m/s",
      targetApogee: n("3 000 m"),
    },
  },
  {
    id: "100-54-6",
    role: "TEST LAUNCH · APR 2023",
    specs: {
      diameter: "104 mm",
      length: null,
      emptyMass: null,
      wetMass: "6.9 kg",
      payload: "None",
      motor: "CTI K940",
      thrustToWeight: "15.3",
      maxThrust: n("1 120.8 N"),
      maxSpeed: "201 m/s",
      targetApogee: n("1 500 m"),
    },
  },
];

export type FlightOutcome = "nominal" | "recovery-failed";

type Stat = { value: string; label: string };

export type Flight = {
  num: string;
  date: string;
  title: string;
  place: string;
  config: ConfigId;
  motor: string;
  outcome: FlightOutcome;
  summary: string;
  /** Board 23m's shorter card copy. */
  phoneSummary: string;
  award?: { name: string; citation?: string };
  stats: readonly [Stat, Stat, Stat, Stat];
  /** Board 23m's card keeps three numbers, with shorter labels. */
  phoneStats: readonly [Stat, Stat, Stat];
};

export const flights: readonly Flight[] = [
  {
    num: "01",
    date: "29 Apr 2023",
    title: "Test launch",
    place: "Bavaria, Germany",
    config: "100-54-6",
    motor: "CTI K940",
    outcome: "nominal",
    summary:
      `First flight. The site's apogee limit meant a smaller K-class motor, so Cavour stayed under the ceiling on purpose. The main parachute opened early, likely a faulty tether. Landed at ${n("6.9 m/s")}, airframe intact, ready to fly again.`,
    phoneSummary:
      "Under the site's apogee limit on purpose with a K-class motor. Main opened early; landed intact.",
    stats: [
      { value: n("1 331 m"), label: "APOGEE" },
      { value: "163 m/s", label: "MAX SPEED" },
      { value: "9.8 G", label: "BOOST ACCEL" },
      { value: "6.9 m/s", label: "LANDING" },
    ],
    phoneStats: [
      { value: n("1 331 m"), label: "APOGEE" },
      { value: "163 m/s", label: "MAX SPEED" },
      { value: "9.8 G", label: "BOOST" },
    ],
  },
  {
    num: "02",
    date: "22 Jun 2023",
    title: "Spaceport America Cup",
    place: "New Mexico, USA",
    config: "100-75-4",
    motor: "CTI L1350",
    outcome: "nominal",
    summary: `Launched from pad B2 at 09:20 local. Apogee landed within ${n("100 m")} of the ${n("3 048 m")} target. The main parachute deployed early again, but the rocket came back reusable. 13th in the 10k ft COTS category, and the first Italian team at the Spaceport America Cup.`,
    phoneSummary: `Apogee within ${n("100 m")} of the ${n("3 048 m")} target. 13th in 10k ft COTS at the Team's first competition.`,
    award: {
      name: "DR. GIL MOORE AWARD FOR INNOVATION",
      citation: "3D-printed multilayered fins for flutter suppression",
    },
    stats: [
      { value: n("3 143 m"), label: "APOGEE" },
      { value: "295 m/s", label: "MAX SPEED" },
      { value: "17.3 G", label: "BOOST ACCEL" },
      { value: "20 / 119", label: "OVERALL RANK" },
    ],
    phoneStats: [
      { value: n("3 143 m"), label: "APOGEE" },
      { value: "295 m/s", label: "MAX SPEED" },
      { value: "20 / 119", label: "OVERALL" },
    ],
  },
  {
    num: "03",
    date: "13 Oct 2023",
    title: "European Rocketry Challenge",
    place: "Santa Margarida, Portugal",
    config: "100-75-4",
    motor: "CTI L1350",
    outcome: "recovery-failed",
    summary:
      `Third flight in one year, at 14:45 local. Boost and coast were nominal. The recovery system failed and Cavour hit the ground at ${n("75 m/s")}. Still 8th overall of 25 selected teams, and the first PoliTo team at EuRoC.`,
    phoneSummary: `Boost and coast nominal; recovery failed, ${n("75 m/s")} impact. Still 8th of 25 teams.`,
    award: {
      name: "ANACOM BEST TELEMETRY SPECTRAL SIGNATURE AWARD",
    },
    stats: [
      { value: n("2 800 m"), label: "APOGEE" },
      { value: "266 m/s", label: "MAX SPEED" },
      { value: "14 G", label: "BOOST ACCEL" },
      { value: "75 m/s", label: "IMPACT" },
    ],
    phoneStats: [
      { value: n("2 800 m"), label: "APOGEE" },
      { value: "266 m/s", label: "MAX SPEED" },
      { value: "75 m/s", label: "IMPACT" },
    ],
  },
];

/**
 * 05 Gallery. Placeholders until the dashboard uploads real photos; a photo
 * then takes a slot as `{ src, alt, caption? }`. An empty list leaves the
 * section out.
 */
export const galleryItems: readonly GalleryItem[] = Array.from({ length: 6 }, (_, i) => ({
  placeholder: true,
  alt: `Placeholder for Cavour photo ${i + 1}`,
}));
