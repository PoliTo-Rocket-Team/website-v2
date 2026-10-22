import type { UniversityPage } from "./university-types";

// Boards 30 and 30m. The copy is the team's live page shortened into plain
// English, as the boards show it.

export const university: UniversityPage = {
  description:
    "The PoliTo Rocket Team is a student team of Politecnico di Torino, the first engineering school in Italy.",

  header: {
    eyebrow: "ABOUT · OUR UNIVERSITY",
    title: "Our University",
    intro: "The PoliTo Rocket Team is a student team of Politecnico di Torino, the first engineering school in Italy.",
    stats: [
      { value: "1859", label: { text: "FOUNDED" } },
      { value: "160+", label: { text: "YEARS" } },
      { value: "28%", label: { text: "OF OUR BUDGET" } },
      { value: "1st", label: { text: "ENGINEERING SCHOOL IN ITALY", phone: "ENG. SCHOOL IN ITALY" } },
    ],
  },

  photo: {
    src: "/about/politecnico-entrance.webp",
    alt: "The entrance of Politecnico di Torino, with POLITECNICO in large letters over the portico.",
  },

  politecnico: {
    logo: "/team/polito-logo-white.svg",
    name: "Politecnico di Torino",
    title: "Italy's first engineering school.",
    paragraphs: [
      'Founded in 1859 as the "Scuola di Applicazione per gli Ingegneri" (School of Application for Engineers), Politecnico di Torino has grown over more than 160 years into one of Europe\'s leading technical universities, known for engineering, architecture, design and urban planning.',
      "It works on today's big challenges, such as climate change, an ageing population and new technology, and links education, research and innovation, with hubs that bring together large companies, small businesses and startups.",
      "Politecnico gives its students and researchers the chance to design, build and launch their own experimental rockets, through the PoliTo Rocket Team.",
    ],
  },

  support: {
    eyebrow: "HOW POLITECNICO SUPPORTS US",
    title: "28% of our budget comes from Politecnico.",
    note: "Last academic year Politecnico di Torino covered 28% of the Team's budget. External sponsors covered the rest, and together they let us take on ambitious projects.",
    share: 28,
    universityLabel: "Politecnico di Torino",
    sponsorsLabel: "External sponsors",
    partnersLink: "Meet our partners",
  },
};
