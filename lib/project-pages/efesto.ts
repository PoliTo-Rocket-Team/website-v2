import type { ProjectPageRecord } from "./types";

// Efesto (boards 25 and 25m): an engine in development, so no hero visual,
// no versions, no launch history and no gallery yet. Facts from
// design/specs-from-old-site.md ("Efesto").

export const efesto: ProjectPageRecord = {
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
  name: {
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
