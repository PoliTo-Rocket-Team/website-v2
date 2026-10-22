import type { MissionPage } from "./mission-types";

// Boards 29 and 29m. The copy is the team's live page shortened into plain
// English, as the boards show it.

export const mission: MissionPage = {
  description: "Why a team of students at Politecnico di Torino builds rockets, and where we are going next.",

  header: {
    eyebrow: "ABOUT · MISSION & VISION",
    title: "Mission & Vision",
    intro: "Why a team of students at Politecnico di Torino builds rockets, and where we are going next.",
  },

  mission: {
    eyebrow: "OUR MISSION",
    statement:
      "To contribute to Italy's space innovation by studying next-generation space exploration technologies, in a team run by students.",
    points: [
      {
        title: "Learn by building",
        body: "Students complete what they learn in class with real projects, real challenges and solid results.",
      },
      {
        title: "Open to every student",
        body: "Technical and non-technical roles, for every course and every level of experience.",
      },
      {
        title: "Launch our own rockets",
        body: "Politecnico students and researchers design, build and launch their own experimental rockets, and use them for research that is otherwise impossible.",
      },
    ],
  },

  vision: {
    eyebrow: "OUR VISION",
    title: "Represent Italian excellence, around the world.",
    paragraphs: [
      "Space agencies and private companies are planning missions to the Moon and Mars, and space technology is moving fast. Since the start of the space age Italy has had a leading role, and today it has a space industry that covers the whole supply chain, backed by its universities, its research and the Italian Space Agency.",
      "We want every Politecnico student to understand the challenges of space exploration and the systems behind rockets and spacecraft, and to grow, as engineers and as people, in a team of many courses and backgrounds.",
    ],
  },

  path: {
    eyebrow: "THE PATH",
    title: "From our first rocket to a liquid engine.",
    steps: [
      {
        name: "Cavour",
        body: "Our first rocket. It represented Italy and Politecnico at the Spaceport America Cup and the European Rocketry Challenge.",
        href: "/projects/cavour",
      },
      {
        name: "VES",
        body: "Vittorio Emanuele II: the evolution of Cavour's design, carrying the Team to the next competitions.",
        href: "/projects/ves",
      },
      {
        name: "Efesto",
        body: "Our liquid rocket engine, the next step in propulsion.",
        href: "/projects/efesto",
      },
    ],
    linkLabel: "See the project",
  },

  beliefs: {
    eyebrow: "WHAT WE BELIEVE",
    lines: [
      "We are constantly focused on progress.",
      "We believe in the simple, not the complex.",
      "We are engineers: if it works…",
    ],
    credit: "Elena Dilorenzo, 2024",
  },
};
