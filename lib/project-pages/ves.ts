import { vesLaunches } from "@/lib/projects";
import { launchLog } from "./launch-log";
import { n, placeholderGallery } from "./text";
import type { ProjectPageRecord, Version } from "./types";

// VES (boards 24 and 24m). Every fact from design/specs-from-old-site.md
// ("VES"); where it gives no value the spec is null and the page shows a
// dash. No VES render exists yet, so the hero panel is the texture alone.

const test: Version = {
  pill: "VES TEST",
  tab: "Test",
  role: { text: "TEST LAUNCH · 2024" },
  specs: {
    diameter: "134 mm",
    length: null,
    emptyMass: null,
    wetMass: "23.6 kg",
    payload: "None",
    motor: "CTI L2375",
    thrustToWeight: "10.5",
    maxThrust: n("2 798 N"),
    maxSpeed: "180 m/s",
    targetApogee: n("1 700 m"),
  },
};

const markII: Version = {
  pill: "VES MARK II",
  tab: "Mark II",
  role: { text: n("IREC 2025 · 9 000 m"), phone: n("IREC 2025 · 9 000 M TARGET") },
  specs: {
    diameter: "134 mm",
    length: n("3 650 mm"),
    emptyMass: "21.6 kg",
    wetMass: "33.4 kg",
    payload: "2 kg",
    motor: "Aerotech O5500X",
    thrustToWeight: "20.8",
    maxThrust: n("7 552 N"),
    maxSpeed: "626 m/s",
    targetApogee: n("9 000 m"),
  },
};

const markI: Version = {
  pill: "VES MARK I",
  tab: "Mark I",
  role: { text: "EUROC 2024" },
  specs: {
    diameter: "134 mm",
    length: n("3 420 mm"),
    emptyMass: "21.1 kg",
    wetMass: "25.8 kg",
    payload: "1 kg",
    motor: "CTI M1790",
    thrustToWeight: "6.1",
    maxThrust: n("2 022 N"),
    maxSpeed: "259 m/s",
    targetApogee: n("3 000 m"),
  },
};

export const ves: ProjectPageRecord = {
  description:
    "The second rocket of the Founding Fathers series, named after Vittorio Emanuele II, the first King of Italy. Built to fly the Team's own systems.",
  hero: {
    intro: {
      text: "The second rocket of the Founding Fathers series, named after Vittorio Emanuele II, the first King of Italy. Built to fly the Team's own systems.",
      phone: "The second Founding Fathers rocket, named after Vittorio Emanuele II, the first King of Italy.",
    },
    status: "EUROC 2024 · IREC 2025",
    dates: "2023 – 2025",
    visual: { caption: "VES MARK II · IREC 2025 CONFIGURATION" },
    facts: [
      { value: "134 mm", label: { text: "DIAMETER" } },
      { value: n("3 650 mm"), label: { text: "LENGTH" } },
      { value: "33.4 kg", label: { text: "WET MASS" } },
      { value: "AT O5500X", label: { text: "MOTOR" } },
      { value: "Mach 1.8", label: { text: "MAX SPEED" } },
      { value: n("9 000 m"), label: { text: "TARGET APOGEE" } },
    ],
  },
  name: {
    title: "Named after the first King of Italy.",
    body: {
      text: [
        "Vittorio Emanuele II was the first King of a united Italy. VES is the second rocket of the Founding Fathers series, after Cavour.",
        "Where Cavour proved the Team could fly, VES was built to fly the Team's own systems: a student-designed flight computer, ground station, ejection recovery and airbrakes.",
      ],
      phone:
        "Vittorio Emanuele II was the first King of a united Italy. Where Cavour proved the Team could fly, VES was built to fly the Team's own systems.",
    },
  },
  design: {
    title: `Single stage, solid motor, ${n("130 mm")} airframe.`,
    body: {
      text: [
        "A 130 mm internal-diameter airframe around a COTS solid motor. Every system that decides the flight, from deployment to drag, is designed and built by the Team.",
      ],
      phone:
        "A 130 mm airframe around a COTS solid motor. Deployment, drag control and flight computer are all designed by the Team.",
    },
    parts: {
      label: "Compartments, nose to motor",
      caption: "BOTTOM TO TOP",
      items: [
        { name: "Nose cone", desc: "Ogive, composite", phone: "Ogive, composite" },
        { name: "Recovery bay", desc: "SRAD ejection recovery, drogue and main", phone: "SRAD ejection, drogue + main" },
        { name: "Airbrakes bay", desc: "SRAD airbrakes, drag control to apogee", phone: "SRAD airbrakes to apogee" },
        { name: "Avionics bay", desc: "SRAD flight computer, ground-station link", phone: "SRAD flight computer, ground link" },
        {
          name: "Motor bay",
          desc: "COTS solid motor, CTI M1790 or Aerotech O5500X",
          phone: "CTI M1790 or AT O5500X",
        },
      ],
    },
  },
  versions: {
    title: "One airframe, three versions.",
    note: {
      text: "The test version flew at ASK 't Harde, Netherlands, with DARE a month before EuRoC 2024. Highlighted column is Mark II, the IREC 2025 version.",
      phone: "The test version flew at ASK 't Harde, NL, a month before EuRoC 2024.",
    },
    before: [test],
    highlighted: markII,
    after: [markI],
  },
  launches: launchLog("Two campaigns. One flight. One first place.", vesLaunches, {
    "12 Oct 2024": {
      title: "European Rocketry Challenge",
      place: { text: "Santa Margarida, Portugal" },
      version: markI,
      summary: {
        text: "First flight of VES, at 14:19 local. Boost and coast were nominal. The drogue shock cord failed and the main did not fully open, so the rocket split into its two sections; each came down under its own chute and both were recovered. 2nd in the flight category.",
        phone:
          "Nominal boost and coast. The drogue cord failed, the rocket split in two and both halves came down under their own chutes. 6th of 25 teams.",
      },
      stats: [
        { value: "8.5 G", label: "BOOST ACCEL", phoneLabel: "BOOST" },
        { value: "6 / 25", label: "OVERALL RANK", phoneLabel: "OVERALL" },
      ],
      phoneStat: 0,
    },
    "13 Jul 2025": {
      title: "IREC 2025",
      place: { text: "Midland, Texas", phone: "Midland, Texas, USA" },
      version: markII,
      summary: {
        text: "The motor failed on ignition: its forward closure's epoxy gave way, a manufacturer defect, and threw the closure and a propellant grain into the rocket. The lower body tube was damaged. Avionics, recovery, chutes, nose cone and upper tube came back in excellent condition.",
        phone: "The motor failed on ignition, a manufacturer defect. Avionics, recovery and nose cone came back intact.",
      },
      stats: [
        { value: n("9 000 m"), label: "TARGET APOGEE", phoneLabel: "TARGET" },
        { value: n("7 552 N"), label: "MAX THRUST" },
        { value: "16th", label: "TECH REPORT" },
        { value: "140+", label: "TEAMS" },
      ],
      phoneDrops: 1,
    },
  }),
  gallery: { title: "From the workshop to the pad.", items: placeholderGallery("VES") },
  teaser: "Two marks, one Mach 1.8 target. Flew at EuRoC 2024.",
};
