import { CAVOUR_STAGE_POSTER } from "@/components/landing/cavour-assets";
import { cavourLaunches } from "@/lib/projects";
import { launchLog } from "./launch-log";
import { n, placeholderGallery } from "./text";
import type { ProjectPageRecord, Version } from "./types";

// Cavour (boards 23 and 23m). Every fact from design/specs-from-old-site.md;
// where it gives no value the spec is null and the page shows a dash.

const config3: Version = {
  pill: "CVR 100-75-3",
  tab: "100-75-3",
  role: { text: n("DESIGN · 3 000 m") },
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
};

/** The SA Cup and EuRoC flight configuration. */
const config4: Version = {
  pill: "CVR 100-75-4",
  tab: "100-75-4",
  role: { text: "SA CUP + EUROC 2023", phone: "SA CUP + EUROC 2023 · FLIGHT CONFIGURATION" },
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
};

const config6: Version = {
  pill: "CVR 100-54-6",
  tab: "100-54-6",
  role: { text: "TEST LAUNCH · APR 2023" },
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
};

export const cavour: ProjectPageRecord = {
  description:
    "The Team's first rocket, named after Camillo Benso, Count of Cavour. Three flights in one year, three configurations, two awards.",
  hero: {
    intro: {
      text: "The Team's first rocket, named after Camillo Benso, Count of Cavour. Three flights in one year, three configurations, two awards.",
    },
    status: "FLOWN ×3 · 2023",
    dates: "JUN 2022 – OCT 2023",
    visual: {
      caption: "CVR 100-75-3 · FLIGHT CONFIGURATION",
      still: { src: CAVOUR_STAGE_POSTER, alt: "Cavour in its flight configuration, side-on, nose right" },
    },
    facts: [
      { value: "104 mm", label: { text: "DIAMETER" } },
      { value: n("2 167 mm"), label: { text: "LENGTH" } },
      { value: "8.4 kg", label: { text: "WET MASS" } },
      { value: "CTI L1350", label: { text: "MOTOR" } },
      { value: "320 m/s", label: { text: "MAX SPEED" } },
      { value: n("3 143 m"), label: { text: "BEST APOGEE" } },
    ],
  },
  name: {
    title: "Named after a prime minister.",
    body: {
      text: [
        "Camillo Benso, Count of Cavour, was one of the leading figures of Italian Unification and the main promoter of Italy's industrial and scientific development. He was the first prime minister of Italy. The Team's first project is named after him.",
        "In line with the Team's Mission & Vision, Cavour's design is simple and pragmatic, built to draw the way for future projects. It is the first rocket of the Founding Fathers series.",
      ],
      phone:
        "Camillo Benso, Count of Cavour, led Italian Unification and pushed Italy's industry and science forward. He was Italy's first prime minister. Cavour is the first rocket of the Founding Fathers series.",
    },
  },
  design: {
    title: ["Single stage, solid motor,", "composite airframe."],
    body: {
      text: [
        "Two body tubes and a coupler, four compartments plus the nose cone. The structure is lightweight composite; every internal part is a high-performance 3D-printed carbon-reinforced polymer. Internal diameter 100 mm, variable target altitude.",
      ],
      phone:
        "Two body tubes and a coupler, four compartments plus the nose cone. Lightweight composite structure; every internal part is 3D-printed carbon-reinforced polymer.",
    },
    parts: {
      label: "Compartments, nose to motor",
      caption: "BOTTOM TO TOP",
      items: [
        { name: "Nose cone", desc: "Ogive, composite", phone: "Ogive, composite" },
        {
          name: "Recovery bay",
          desc: "Drogue and main parachutes, tethers, ejection",
          phone: "Drogue + main, tethers, ejection",
        },
        { name: "Payload bay", desc: "The mission's scientific payload, up to 4 kg", phone: "Scientific payload, up to 4 kg" },
        { name: "Avionics bay", desc: "Flight computer, sensors, telemetry", phone: "Flight computer, sensors, telemetry" },
        { name: "Motor bay", desc: "COTS solid motor, CTI L1350 or K940", phone: "CTI L1350 or K940" },
      ],
    },
  },
  versions: {
    title: "One airframe, three configurations.",
    note: {
      text: "Naming: CVR · body diameter (mm) · motor diameter (mm) · motor grains. Highlighted column is the SA Cup flight configuration.",
      phone: "Naming: CVR · body diameter · motor diameter · motor grains.",
    },
    before: [config3],
    highlighted: config4,
    after: [config6],
  },
  launches: launchLog("Three flights. Three countries. One hard landing.", cavourLaunches, {
    "29 Apr 2023": {
      title: "Test launch",
      place: { text: "Bavaria, Germany" },
      version: config6,
      summary: {
        text: `First flight. The site's apogee limit meant a smaller K-class motor, so Cavour stayed under the ceiling on purpose. The main parachute opened early, likely a faulty tether. Landed at ${n("6.9 m/s")}, airframe intact, ready to fly again.`,
        phone: "Under the site's apogee limit on purpose with a K-class motor. Main opened early; landed intact.",
      },
      stats: [
        { value: "9.8 G", label: "BOOST ACCEL", phoneLabel: "BOOST" },
        { value: "6.9 m/s", label: "LANDING" },
      ],
      phoneStat: 0,
    },
    "22 Jun 2023": {
      title: "Spaceport America Cup",
      place: { text: "New Mexico, USA" },
      version: config4,
      summary: {
        text: `Launched from pad B2 at 09:20 local. Apogee landed within ${n("100 m")} of the ${n("3 048 m")} target. The main parachute deployed early again, but the rocket came back reusable. 13th in the 10k ft COTS category, and the first Italian team at the Spaceport America Cup.`,
        phone: `Apogee within ${n("100 m")} of the ${n("3 048 m")} target. 13th in 10k ft COTS at the Team's first competition.`,
      },
      stats: [
        { value: "17.3 G", label: "BOOST ACCEL" },
        { value: "20 / 119", label: "OVERALL RANK", phoneLabel: "OVERALL" },
      ],
      phoneStat: 1,
    },
    "13 Oct 2023": {
      title: "European Rocketry Challenge",
      place: { text: "Santa Margarida, Portugal" },
      version: config4,
      setback: "recovery-failed",
      summary: {
        text: `Third flight in one year, at 14:45 local. Boost and coast were nominal. The recovery system failed and Cavour hit the ground at ${n("75 m/s")}. Still 8th overall of 25 selected teams, and the first PoliTo team at EuRoC.`,
        phone: `Boost and coast nominal; recovery failed, ${n("75 m/s")} impact. Still 8th of 25 teams.`,
      },
      stats: [
        { value: "14 G", label: "BOOST ACCEL" },
        { value: "75 m/s", label: "IMPACT" },
      ],
      phoneStat: 1,
    },
  }),
  gallery: { title: "From the workshop to the pad.", items: placeholderGallery("Cavour") },
  teaser: "The Team's first rocket. Three flights in one year.",
};
