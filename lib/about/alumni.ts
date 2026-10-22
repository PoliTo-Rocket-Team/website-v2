import type { AlumniCopy } from "./alumni-types";

// The Alumni page's copy. Who it lists comes from the team record: the
// roles, the imported early years and the dashboard's fixes
// (./alumni-record.ts, issue #257).

export const alumni: AlumniCopy = {
  description:
    "Everyone who has built PoliTo Rocket Team, one academic year at a time, from its founders in 2021–22.",

  header: {
    eyebrow: "ABOUT · ALUMNI",
    title: "Alumni",
    intro: "The people who built the Team, academic year by academic year, from the first one, 2021–22.",
  },

  founders: {
    eyebrow: "WHERE IT STARTED",
    title: "The founders.",
  },

  years: {
    eyebrow: "ACADEMIC YEARS",
    title: "Year by year.",
  },
};
