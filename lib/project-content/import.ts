import type { GalleryItem, GalleryPhoto } from "@/components/gallery/items";
import type { ContentItem } from "@/lib/content/versioned";
import type { PhotoSrc } from "@/lib/outreach-types";
import type { GallerySection, LaunchPhoto, Reasons, Version } from "@/lib/project-pages/types";
import type { ProjectRecord, VehicleRecord, EngineRecord } from "./record";
import { revise, type ProjectRevision, type RevisionSet } from "./revision";

// Carrying Cavour, VES and Efesto into the content store (issue #295), each
// published, in the site order Cavour, VES, Efesto. Before the store, each
// project was typed in three places: its page record (lib/project-pages/),
// its /projects entry (lib/projects.ts) and its home card
// (components/landing/projects.tsx). The records below join the three, word
// for word; ./content.test.ts checks they draw what those files drew
// (./before.json). Migration drizzle/0037_projects_audit_and_import.sql
// holds exactly the SQL `projectImportSql` writes, and the dummy data
// (previews) starts from the same items. Every fact is from
// design/specs-from-old-site.md; where it gives no value a spec is null and
// the page shows a dash.

/**
 * Figures are set as the boards set them ("2 167 mm"), with no-break spaces
 * so a figure never wraps. Only figures go through n(), never running copy.
 */
const n = (s: string) => s.replace(/ /g, " ");

/**
 * The /projects entries and their launches set only the thousands apart with
 * a no-break space ("3 143 m"), as lib/projects.ts did.
 */
const nb = " ";

/** Six placeholder slots until the dashboard uploads real photos. */
function placeholderGallery(project: string): readonly [GalleryItem, ...GalleryItem[]] {
  const slot = (i: number) => ({ placeholder: true as const, alt: `Placeholder for ${project} photo ${i}` });
  return [slot(1), slot(2), slot(3), slot(4), slot(5), slot(6)];
}

// Cavour (boards 23 and 23m).

const cavourConfig3: Version = {
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
const cavourConfig4: Version = {
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

const cavourConfig6: Version = {
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

/**
 * A record as migration 0037 imported it: it also carried `teaser`, the line
 * of the next-project card the pages drew then, a key retired since (issue
 * #377, `RETIRED_KEYS`). The import keeps it, as 0037 holds it;
 * `importedRecords` leaves it out.
 */
type Imported<R extends ProjectRecord> = R & { readonly teaser: string };

const cavour: Imported<VehicleRecord> = {
  kind: "vehicle",
  slug: "cavour",
  name: "Cavour",
  texture: "/textures/project-cavour.webp",
  listing: {
    years: "2022 – 2023",
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
    logSummary: "3 FLIGHTS",
  },
  card: {
    year: { text: "2023" },
    // "FLOWN ×3", counted off the launch history below.
    status: { count: "flights" },
    statusTone: "dark",
    desc: { text: "Our first rocket. First Italian team at Spaceport America Cup." },
    specs: [
      { label: { text: "APOGEE" }, value: { text: "3 143 m" } },
      { label: { text: "MOTOR" }, value: { text: "Solid · L", phone: "Solid L" } },
      { label: { text: "SPEED" }, value: { text: "295 m/s" } },
    ],
    rocket: "cavour",
  },
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
      rocket: { own: { model: "cavour", alt: "Cavour in its flight configuration, side-on, nose right" } },
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
  nameStory: {
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
    before: [cavourConfig3],
    highlighted: cavourConfig4,
    after: [cavourConfig6],
  },
  launches: {
    title: "Three flights. Three countries. One hard landing.",
    entries: [
      {
        date: "29 Apr 2023",
        where: "Bavaria, Germany · test launch",
        result: "Nominal. Recovered intact, reusable.",
        title: "Test launch",
        place: { text: "Bavaria, Germany" },
        version: cavourConfig6.pill,
        motor: "CTI K940",
        summary: {
          text: `First flight. The site's apogee limit meant a smaller K-class motor, so Cavour stayed under the ceiling on purpose. The main parachute opened early, likely a faulty tether. Landed at ${n("6.9 m/s")}, airframe intact, ready to fly again.`,
          phone: "Under the site's apogee limit on purpose with a K-class motor. Main opened early; landed intact.",
        },
        outcome: "nominal",
        flight: { apogee: `1${nb}331 m`, maxSpeed: "163 m/s", country: "Germany" },
        stats: [
          { value: "9.8 G", label: "BOOST ACCEL", phoneLabel: "BOOST" },
          { value: "6.9 m/s", label: "LANDING" },
        ],
        phoneStat: 0,
      },
      {
        date: "22 Jun 2023",
        where: "Spaceport America Cup, New Mexico",
        result: "Nominal. 20th of 119 universities.",
        award: {
          name: "DR. GIL MOORE AWARD FOR INNOVATION",
          citation: "3D-printed multilayered fins for flutter suppression",
        },
        title: "Spaceport America Cup",
        place: { text: "New Mexico, USA" },
        version: cavourConfig4.pill,
        motor: "CTI L1350",
        summary: {
          text: `Launched from pad B2 at 09:20 local. Apogee landed within ${n("100 m")} of the ${n("3 048 m")} target. The main parachute deployed early again, but the rocket came back reusable. 13th in the 10k ft COTS category, and the first Italian team at the Spaceport America Cup.`,
          phone: `Apogee within ${n("100 m")} of the ${n("3 048 m")} target. 13th in 10k ft COTS at the Team's first competition.`,
        },
        outcome: "nominal",
        flight: { apogee: `3${nb}143 m`, maxSpeed: "295 m/s", country: "USA" },
        stats: [
          { value: "17.3 G", label: "BOOST ACCEL" },
          { value: "20 / 119", label: "OVERALL RANK", phoneLabel: "OVERALL" },
        ],
        phoneStat: 1,
      },
      {
        date: "13 Oct 2023",
        where: "EuRoC, Santa Margarida, Portugal",
        result: "Boost nominal. Recovery failed, 75 m/s impact.",
        award: { name: "ANACOM BEST TELEMETRY SPECTRAL SIGNATURE AWARD", short: "ANACOM BEST TELEMETRY AWARD" },
        title: "European Rocketry Challenge",
        place: { text: "Santa Margarida, Portugal" },
        version: cavourConfig4.pill,
        motor: "CTI L1350",
        summary: {
          text: `Third flight in one year, at 14:45 local. Boost and coast were nominal. The recovery system failed and Cavour hit the ground at ${n("75 m/s")}. Still 8th overall of 25 selected teams, and the first PoliTo team at EuRoC.`,
          phone: `Boost and coast nominal; recovery failed, ${n("75 m/s")} impact. Still 8th of 25 teams.`,
        },
        outcome: "recovery-failed",
        flight: { apogee: `2${nb}800 m`, maxSpeed: "266 m/s", country: "Portugal" },
        stats: [
          { value: "14 G", label: "BOOST ACCEL" },
          { value: "75 m/s", label: "IMPACT" },
        ],
        phoneStat: 1,
      },
    ],
  },
  gallery: { title: "From the workshop to the pad.", items: placeholderGallery("Cavour") },
  teaser: "The Team's first rocket. Three flights in one year.",
};

// VES (boards 24 and 24m). No VES render exists yet, so the hero panel is the texture alone.

const vesTest: Version = {
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

const vesMarkII: Version = {
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

const vesMarkI: Version = {
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

const ves: Imported<VehicleRecord> = {
  kind: "vehicle",
  slug: "ves",
  name: "VES",
  texture: "/textures/project-ves.webp",
  listing: {
    years: "2023 – 2025",
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
    logSummary: "2 CAMPAIGNS",
  },
  card: {
    year: { text: "2024–25", phone: "24–25" },
    status: "FLOWN · MK I",
    statusTone: "dark",
    desc: {
      text: "130 mm, all-SRAD systems. Mark I flew EuRoC 2024; Mark II won Design & Build at IREC 2025.",
      phone: "130 mm, all-SRAD systems. Mark II won Design & Build at IREC 2025.",
    },
    specs: [
      { label: { text: "APOGEE" }, value: { text: "3 160 m" } },
      { label: { text: "MOTOR" }, value: { text: "M · O" } },
      { label: { text: "VERSIONS", phone: "MARKS" }, value: { text: "Mk I · II", phone: "Mk I–II" } },
    ],
    rocket: "cavour",
  },
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
  nameStory: {
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
    before: [vesTest],
    highlighted: vesMarkII,
    after: [vesMarkI],
  },
  launches: {
    title: "Two campaigns. One flight. One first place.",
    entries: [
      {
        date: "12 Oct 2024",
        where: "EuRoC, Santa Margarida, Portugal · Mark I",
        result: "Nominal flight. Split on descent, both halves recovered. 6th of 25 teams.",
        title: "European Rocketry Challenge",
        place: { text: "Santa Margarida, Portugal" },
        version: vesMarkI.pill,
        motor: "CTI M1790",
        summary: {
          text: "First flight of VES, at 14:19 local. Boost and coast were nominal. The drogue shock cord failed and the main did not fully open, so the rocket split into its two sections; each came down under its own chute and both were recovered. 2nd in the flight category.",
          phone:
            "Nominal boost and coast. The drogue cord failed, the rocket split in two and both halves came down under their own chutes. 6th of 25 teams.",
        },
        outcome: "nominal",
        flight: { apogee: `3${nb}160 m`, maxSpeed: "259 m/s", country: "Portugal" },
        stats: [
          { value: "8.5 G", label: "BOOST ACCEL", phoneLabel: "BOOST" },
          { value: "6 / 25", label: "OVERALL RANK", phoneLabel: "OVERALL" },
        ],
        phoneStat: 0,
      },
      {
        date: "13 Jul 2025",
        where: "IREC, Midland, Texas · Mark II",
        result:
          "Did not fly. COTS motor failed on ignition (manufacturer defect). Avionics, recovery and nose cone recovered intact.",
        award: {
          name: "1ST PLACE · DESIGN & BUILD QUALITY",
          short: "1ST PLACE DESIGN & BUILD QUALITY",
          citation: "of 140+ universities",
        },
        title: "IREC 2025",
        place: { text: "Midland, Texas", phone: "Midland, Texas, USA" },
        version: vesMarkII.pill,
        motor: "Aerotech O5500X",
        summary: {
          text: "The motor failed on ignition: its forward closure's epoxy gave way, a manufacturer defect, and threw the closure and a propellant grain into the rocket. The lower body tube was damaged. Avionics, recovery, chutes, nose cone and upper tube came back in excellent condition.",
          phone: "The motor failed on ignition, a manufacturer defect. Avionics, recovery and nose cone came back intact.",
        },
        outcome: "did-not-fly",
        stats: [
          { value: n("9 000 m"), label: "TARGET APOGEE", phoneLabel: "TARGET" },
          { value: n("7 552 N"), label: "MAX THRUST" },
          { value: "16th", label: "TECH REPORT" },
          { value: "140+", label: "TEAMS" },
        ],
        phoneDrops: 1,
      },
    ],
  },
  gallery: { title: "From the workshop to the pad.", items: placeholderGallery("VES") },
  teaser: "Two marks, one Mach 1.8 target. Flew at EuRoC 2024.",
};

// Efesto (boards 25 and 25m): an engine in development, so no hero visual,
// no versions, no launch history and no gallery yet.

const efesto: Imported<EngineRecord> = {
  kind: "engine",
  slug: "efesto",
  name: "Efesto",
  texture: "/textures/project-efesto.webp",
  listing: {
    years: "2023 – NOW",
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
    workLines: [
      { code: "TCA", name: "Thrust Chamber Assembly" },
      { code: "EC", name: "Engine Cycle · RocketForge tool" },
      { code: "LSA", name: "Liquid System Architecture" },
      { code: "TB", name: "Test Bench" },
      { code: "ECS", name: "Engine Control Strategy" },
    ],
    milestone: "INJECTOR HEAD PRESENTED · 26TH ESA PAC SYMPOSIUM, LUZERN · MAY 2024",
  },
  card: {
    year: { text: "2023–" },
    status: "IN DESIGN",
    statusTone: "light",
    desc: { text: "The first Italian pressure-fed liquid rocket engine. N₂O and ethanol, printed in copper." },
    specs: [
      { label: { text: "THRUST" }, value: { text: "5 kN" } },
      { label: { text: "FUEL" }, value: { text: "N₂O · EtOH", phone: "Ethanol" } },
      { label: { text: "COOLING" }, value: { text: "Regen." } },
    ],
    infoTint: 0.82,
    rocket: "cavour",
  },
  description:
    "Not a rocket yet: the liquid engine for the Team's first bi-liquid vehicle, and the first pressure-fed liquid engine built in Italy.",
  hero: {
    intro: {
      text: "Not a rocket yet: the liquid engine for the Team's first bi-liquid vehicle, and the first pressure-fed liquid engine built in Italy.",
      phone: "Not a rocket yet: Italy's first pressure-fed liquid engine, for the Team's first bi-liquid vehicle.",
    },
    status: "IN DEVELOPMENT",
    dates: "2023 – NOW",
    facts: [
      { value: "N₂O", label: { text: "OXIDIZER" } },
      { value: "Ethanol", label: { text: "FUEL" } },
      { value: "5 kN", label: { text: "TARGET THRUST", phone: "THRUST" } },
      { value: "Pressure-fed", label: { text: "CYCLE" } },
      { value: "Regenerative", label: { text: "COOLING" } },
      { value: "Cu MMC", label: { text: "CHAMBER" } },
    ],
  },
  nameStory: {
    title: "Named after the god of the forge.",
    body: {
      text: [
        "Efesto is the Italian name of Hephaestus, the Greek god of fire and the forge. The engine is forged too: printed as one assembly in copper.",
        "After two solid-motor rockets, Efesto is the Team's step to liquid propulsion: nitrous oxide and ethanol, fed by pressure, cooled by its own fuel.",
      ],
      phone:
        "Efesto is the Italian name of Hephaestus, god of fire and the forge. The engine is forged too: printed as one copper assembly.",
    },
  },
  design: {
    title: "One engine, five work lines.",
    body: {
      text: [
        "A regeneratively cooled chamber with a copper metal-matrix wall, developed with Politecnico's labs and printed as one assembly. The injector head was presented at the 26th ESA PAC Symposium in Luzern, May 2024.",
      ],
      phone:
        "A regeneratively cooled copper chamber, printed as one assembly. Injector head shown at the 26th ESA PAC Symposium, May 2024.",
    },
    parts: {
      label: "Work lines",
      caption: "WORK LINES",
      items: [
        { name: "Engine control", desc: "ECS · Engine Control Strategy", phone: "ECS · control strategy" },
        { name: "Test bench", desc: "TB · Hot-fire test stand", phone: "TB · hot-fire stand" },
        { name: "Liquid system", desc: "LSA · Tanks, feed lines and valves", phone: "LSA · tanks, feed, valves" },
        { name: "Engine cycle", desc: "EC · Cycle design, RocketForge tool", phone: "EC · RocketForge tool" },
        { name: "Thrust chamber", desc: "TCA · Printed Cu chamber and injector", phone: "TCA · printed Cu chamber" },
      ],
    },
  },
  plan: {
    title: "From a printed chamber to a flying engine.",
    intro: {
      text: "Efesto is built in steps, and each one is tested before the next begins.",
      phone: "Built in steps, each tested before the next begins.",
    },
    done: [
      {
        date: "2023",
        title: "Project starts",
        text: {
          text: "Five work lines set up around one goal: a liquid engine designed and built by students.",
          phone: "Five work lines around one goal: a student-built liquid engine.",
        },
      },
      {
        date: "MAY 2024",
        title: "Injector head presented",
        text: {
          text: "Shown at the 26th ESA PAC Symposium in Luzern.",
          phone: "26th ESA PAC Symposium, Luzern.",
        },
      },
    ],
    now: {
      date: "2025 – 26",
      title: "Chamber and feed system",
      text: {
        text: "Printing the copper chamber; building tanks, feed lines and valves.",
        phone: "Printing the copper chamber; tanks, feed lines, valves.",
      },
    },
    next: [
      {
        title: "Hot fire on the bench",
        text: {
          text: "First firings on the Team's own test stand, toward the 5 kN target.",
          phone: "First firings toward the 5 kN target.",
        },
      },
    ],
    later: [
      {
        title: "First bi-liquid rocket",
        text: {
          text: "Efesto becomes the engine of the Team's first liquid-fuelled vehicle.",
          phone: "Efesto powers the Team's first liquid-fuelled vehicle.",
        },
      },
    ],
  },
  reasons: {
    eyebrow: "WHY LIQUID",
    title: "Why the Team is building its own engine.",
    items: [
      {
        title: "Control",
        text: "A liquid engine can be throttled and shut down on command. A solid motor burns until it is empty.",
      },
      {
        title: "Testing",
        text: "The same engine can fire again and again on the bench, so every test teaches something.",
      },
      {
        title: "Know-how",
        text: "Designing the engine, not buying it, keeps the hardest part of a rocket inside the Team.",
      },
    ],
  },
  teaser: "Italy's first pressure-fed liquid engine, printed in copper.",
};

/**
 * The three projects as migration 0037 carried them into the store, in site
 * order. Frozen: a later change to their content is a revision below.
 */
export const firstImport: readonly Imported<ProjectRecord>[] = [cavour, ves, efesto];

/**
 * VES draws its own rocket, Mark I, on its home card and its page (issue
 * #361), not Cavour's. The page's caption names the mark it draws, and the
 * key facts under it are Mark I's, from `vesMarkI` (target apogee, as Mark
 * II's fact gives its target). Migration drizzle/0040_ves_mark_one_rocket.sql
 * holds its `revisionSql`.
 */
export const vesMarkOneRocket: ProjectRevision = {
  slug: "ves",
  sets: [
    { path: ["card", "rocket"], value: "ves" },
    { path: ["hero", "visual", "caption"], value: "VES MARK I · EUROC 2024 CONFIGURATION" },
    {
      path: ["hero", "visual", "rocket"],
      value: { own: { model: "ves", alt: "VES Mark I in its EuRoC 2024 livery, side-on, nose right" } },
    },
    {
      path: ["hero", "facts"],
      value: [
        { value: vesMarkI.specs.diameter, label: { text: "DIAMETER" } },
        { value: vesMarkI.specs.length, label: { text: "LENGTH" } },
        { value: vesMarkI.specs.wetMass, label: { text: "WET MASS" } },
        { value: vesMarkI.specs.motor, label: { text: "MOTOR" } },
        { value: vesMarkI.specs.maxSpeed, label: { text: "MAX SPEED" } },
        { value: vesMarkI.specs.targetApogee, label: { text: "TARGET APOGEE" } },
      ],
    },
  ],
};

/** A photo of the site in public/project-photos/<slug>/: its file name there, without ".webp", and what it shows. */
type SitePhoto = { readonly file: string; readonly alt: string };

type CaptionedSitePhoto = SitePhoto & { readonly caption: string };

const sitePhotoSrc = (slug: string, file: string): PhotoSrc => `/project-photos/${slug}/${file}.webp`;

/** One launch card's photos, one or two, set on the launch at this place in the history. */
const launchPhotos = (slug: string, index: number, photos: readonly [SitePhoto] | readonly [SitePhoto, SitePhoto]): RevisionSet => ({
  path: ["launches", "entries", String(index), "photos"],
  value: photos.map(({ file, alt }): LaunchPhoto => ({ src: sitePhotoSrc(slug, file), alt })),
});

/** The gallery's photos, in carousel order, in place of its placeholders. */
const galleryPhotos = (slug: string, photos: readonly [CaptionedSitePhoto, ...CaptionedSitePhoto[]]): RevisionSet => ({
  path: ["gallery", "items"],
  value: photos.map(({ file, alt, caption }): GalleryPhoto => ({ src: sitePhotoSrc(slug, file), alt, caption })),
});

/**
 * Cavour's launch cards and gallery show the Team's own photos, the ones the
 * current public site shows for each campaign (issue #371), in place of the
 * texture and the placeholders. Each file is in public/project-photos/cavour/.
 * Migration drizzle/0041_current_site_photos.sql holds its `revisionSql`.
 */
export const cavourSitePhotos: ProjectRevision = {
  slug: "cavour",
  sets: [
    launchPhotos("cavour", 0, [
      { file: "test-launch-liftoff", alt: "Cavour climbing on its smoke trail above the launch field in Bavaria" },
      { file: "test-launch-landed", alt: "Cavour lying intact in a green field at sunset after its first flight" },
    ]),
    launchPhotos("cavour", 1, [
      { file: "sa-cup-liftoff", alt: "Cavour leaving the rail in a cloud of desert dust at Spaceport America" },
      { file: "sa-cup-pad", alt: "Cavour on launch pad B2 in the New Mexico desert" },
    ]),
    launchPhotos("cavour", 2, [
      { file: "euroc-2023-liftoff", alt: "Cavour lifting off at Santa Margarida, Portugal" },
      { file: "euroc-2023-to-the-pad", alt: "Team members carrying Cavour past the tents at EuRoC 2023" },
    ]),
    galleryPhotos("cavour", [
      { file: "sa-cup-team", alt: "The Team holding Cavour up on a pickup truck in the desert", caption: "Spaceport America Cup 2023, New Mexico" },
      { file: "sa-cup-expo", alt: "Cavour and its poster on the Team's table at the competition expo", caption: "Spaceport America Cup 2023, New Mexico" },
      { file: "sa-cup-flag", alt: "The Team with the Italian flag at the Spaceport America Cup", caption: "Spaceport America Cup 2023, New Mexico" },
      { file: "euroc-2023-team", alt: "The Team seated together in the competition hall", caption: "EuRoC 2023, Portugal" },
      { file: "euroc-2023-tent", alt: "Team members working on Cavour in the Team's tent", caption: "EuRoC 2023, Portugal" },
      { file: "test-launch-rail", alt: "Cavour leaving the rail at sunset on its first flight", caption: "Test launch 2023, Bavaria" },
    ]),
  ],
};

/**
 * VES's launch cards and gallery, the same way: the photos the current public
 * site shows for EuRoC 2024 and IREC 2025, in public/project-photos/ves/.
 * Migration drizzle/0041_current_site_photos.sql holds its `revisionSql`.
 */
export const vesSitePhotos: ProjectRevision = {
  slug: "ves",
  sets: [
    launchPhotos("ves", 0, [
      { file: "euroc-2024-liftoff", alt: "VES Mark I lifting off at Santa Margarida, Portugal" },
      { file: "euroc-2024-to-the-pad", alt: "Team members carrying VES Mark I to the pad at EuRoC 2024" },
    ]),
    launchPhotos("ves", 1, [
      { file: "irec-2025-pad", alt: "Team members readying VES Mark II on the launch rail in Texas" },
      { file: "irec-2025-award", alt: "The Team on stage with VES Mark II and the Italian flag at IREC 2025" },
    ]),
    galleryPhotos("ves", [
      { file: "euroc-2024-team", alt: "The Team on the competition stage with VES Mark I and the Italian flag", caption: "EuRoC 2024, Portugal" },
      { file: "euroc-2024-booth", alt: "Team members showing VES Mark I at the Team's stand", caption: "EuRoC 2024, Portugal" },
      { file: "euroc-2024-stand", alt: "The Team at its stand beside VES Mark I", caption: "EuRoC 2024, Portugal" },
      { file: "irec-2025-expo", alt: "VES Mark II and its poster at the competition expo", caption: "IREC 2025, Texas" },
      { file: "irec-2025-dusk", alt: "Team members riding out at dusk with VES Mark II in a pickup truck", caption: "IREC 2025, Texas" },
      { file: "irec-2025-banner", alt: "VES Mark II held up beside the Team's banner", caption: "IREC 2025, Texas" },
    ]),
  ],
};

/**
 * VES's rocket is orange, so its orange streak texture hid it. Its card, its
 * /projects panel and its page sit on the same streak image in grey instead
 * (issue #386); the orange file stays in public/textures/. Migration
 * drizzle/0042_ves_grey_texture.sql holds its `revisionSql`.
 */
export const vesGreyTexture: ProjectRevision = {
  slug: "ves",
  sets: [{ path: ["texture"], value: "/textures/project-ves-grey.webp" }],
};

/**
 * Efesto is an engine that has not flown, so its home card and its page draw
 * its engine, drawn in outline (issue #382), not Cavour. The import gave its
 * page no panel, so the revision sets the whole panel. Migration
 * drizzle/0043_efesto_engine_model.sql holds its `revisionSql`.
 */
export const efestoEngineModel: ProjectRevision = {
  slug: "efesto",
  sets: [
    { path: ["card", "rocket"], value: "efesto" },
    {
      path: ["hero", "visual"],
      value: {
        caption: "EFESTO · 5 KN LIQUID ENGINE",
        rocket: {
          own: {
            model: "efesto",
            alt: "Efesto drawn in outline, side-on: injector head on the right, then the combustion chamber and the nozzle, with a feed line along the chamber",
          },
        },
      },
    },
  ],
};

/**
 * Efesto's page shows the current public site's content (issue #449): its two
 * images, in public/project-photos/efesto/, as a gallery, and its five key
 * characteristics in place of the Why section the import wrote. The import
 * gave Efesto no gallery, so the revision sets the whole section, title and
 * photos. Migration drizzle/0046_efesto_site_content.sql holds its
 * `revisionSql`.
 */
export const efestoSiteContent: ProjectRevision = {
  slug: "efesto",
  sets: [
    {
      path: ["gallery"],
      value: {
        title: "Designed in-house.",
        items: [
          {
            src: sitePhotoSrc("efesto", "injector-head"),
            alt: "A cutaway of the Efesto injector head, where it joins the combustion chamber",
            caption: "Efesto injector head",
          },
          {
            src: sitePhotoSrc("efesto", "rocketforge"),
            alt: "The RocketForge main screen, with fields for chamber pressure, oxidizer, fuel and mixture ratio",
            caption: "RocketForge, the Team's engine design tool",
          },
        ],
      } satisfies GallerySection,
    },
    {
      path: ["reasons"],
      value: {
        eyebrow: "CHARACTERISTICS",
        title: "What sets Efesto apart.",
        items: [
          {
            title: "Reusability",
            text: "Efesto is a regenerative liquid engine. It is meant as a small, reusable propulsion system for the first stage of a micro launcher.",
          },
          {
            title: "New materials",
            text: "Copper alloys keep the chamber walls cool, and high-strength steel or nickel alloys keep them stiff. With Politecnico's R&D partnership, the chamber uses new copper-based metal matrix composites.",
          },
          {
            title: "New technologies",
            text: "The whole engine assembly is to be made by additive manufacturing. This opens new shapes and a lighter engine.",
          },
          {
            title: "Static fire qualification",
            text: "Efesto is designed to fire on a new test bench. Qualification tests there will check it meets the mission's targets.",
          },
          {
            title: "Simplicity",
            text: "A regenerative pressure-fed cycle gives strong results with a simpler design than electric-pump-fed or open cycles.",
          },
        ],
      } satisfies Reasons,
    },
  ],
};

/** The revisions made since the import, in migration order. */
export const projectRevisions: readonly ProjectRevision[] = [
  vesMarkOneRocket,
  cavourSitePhotos,
  vesSitePhotos,
  vesGreyTexture,
  efestoEngineModel,
  efestoSiteContent,
];

/** The three projects as the code reads them once every migration ran: the import, revised, with its retired key left out. */
export const importedRecords: readonly ProjectRecord[] = firstImport.map(({ teaser: _retired, ...record }) =>
  projectRevisions.reduce(revise, record),
);

/** The records as stored items: ids and site order from 1, each published with no draft. */
export function importedProjects(records: readonly ProjectRecord[] = importedRecords): ContentItem<ProjectRecord>[] {
  return records.map((record, i) => ({
    id: i + 1,
    siteOrder: i + 1,
    version: { state: "published", published: record, draft: null },
  }));
}

/** A SQL string literal, its quotes doubled. */
function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * One statement per project: its row in `projects` at its site order, and its
 * published version in `project_versions`, written in one go so the version
 * finds its project's new id.
 */
export function projectImportSql(records: readonly ProjectRecord[] = firstImport): string {
  return records
    .map((record, i) =>
      [
        `WITH "project" AS (INSERT INTO "projects" ("site_order") VALUES (${i + 1}) RETURNING "id")`,
        `INSERT INTO "project_versions" ("project_id", "version", "content")`,
        `SELECT "id", 'published', ${literal(JSON.stringify(record))}::jsonb FROM "project";`,
      ].join("\n"),
    )
    .join("\n--> statement-breakpoint\n");
}
