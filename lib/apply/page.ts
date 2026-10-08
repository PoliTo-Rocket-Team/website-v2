import type { HeaderStats } from "@/lib/about/types";
import { openCount, type ApplyListing } from "./positions";

// The /apply page's copy (boards 34, 34b, 34c, 34m and 34bm). The positions
// come from the database and the placeholder roles from placeholder-roles.ts;
// everything else the page says is here.

export const INSTAGRAM_URL = "https://www.instagram.com/politorocketteam";
export const RECRUITMENT_EMAIL = "recruitment@politorocketteam.it";

export const applyPage = {
  description:
    "Join the PoliTo Rocket Team: open positions for Politecnico di Torino students, the roles we recruit for, and answers to common questions.",
  header: {
    eyebrow: "APPLY",
    title: "Join the team",
    intro:
      "We are 150+ students of Politecnico di Torino who design, build and fly rockets. Pick an open position, sign in with your account and send your application. No rocketry experience needed: we learn together.",
  },
  openTitle: "Open positions",
  noneTitle: "Roles we recruit for",
  othersTitle: "Other roles we recruit for",
  othersIntro: "These roles are closed for now. Most of them open at the start of a semester.",
  notice: {
    title: "No positions are open right now",
    body: "Most roles open at the start of a semester. Below are the roles we usually recruit for, so you can see where you would fit.",
  },
  follow: "Follow for updates",
  voluntary: "The work is voluntary: we are a student team, so we do not offer paid positions.",
  closed: "This position is not accepting applications right now.",
  apply: "Apply for this role",
  faqTitle: "Questions",
} as const;

/** The header's four figures: the open count, departments hiring (or all departments when none is), and two fixed facts. */
export function applyStats(listing: ApplyListing): HeaderStats {
  const departments =
    listing.kind === "none"
      ? { value: listing.placeholders.length, label: "DEPARTMENTS" }
      : { value: listing.open.length, label: "DEPARTMENTS HIRING" };
  return [
    { value: String(openCount(listing)), label: { text: "OPEN POSITIONS" } },
    { value: String(departments.value), label: { text: departments.label } },
    { value: "150+", label: { text: "STUDENTS IN THE TEAM" } },
    { value: "0", label: { text: "EXPERIENCE NEEDED" } },
  ];
}

export type Faq = { question: string; answer: readonly [string, ...string[]] };

/** Board 34's eleven questions, with the old site's answers, one string per paragraph. */
export const faqs: readonly Faq[] = [
  {
    question: "How can I join the Team?",
    answer: [
      "If there are open positions, there is the possibility of joining the Team. More details can be found by reading the open positions' descriptions and apply procedures. The main recruitment process is generally held at the beginning of the academic year, but some positions might be open in other time periods too: look out for any updates on our social media and on our website.",
    ],
  },
  {
    question: "Are there any requirements for joining the team?",
    answer: [
      "Candidates must have time to dedicate to our projects, and an intermediate English proficiency level is preferred. We accept all PoliTo students regardless of program and year (undergraduate, graduate and PhD).",
    ],
  },
  {
    question: "Can I join as a first-year student?",
    answer: [
      "Yes, and we encourage you to! Theoretical knowledge and previous experience are appreciated, but they are not everything. Young and motivated students can learn and acquire real experience while working on our projects.",
      "As of Summer 2023, more than half of the Team's members are Bachelor's students, and many of them are first-year students!",
    ],
  },
  {
    question: "Can I join the team as an international student?",
    answer: [
      "Of course! As of Summer 2023, more than 25% of the Team's members are international students. The selection process is the same for international and Italian students. As for any other student, good English knowledge is preferred. Italian language proficiency is not required, but appreciated.",
    ],
  },
  {
    question: "Can I join the Team with a low level English proficiency?",
    answer: [
      "The Team's official language is English, and it is preferred that candidates have at least an intermediate language proficiency. Candidates with advanced English proficiency will have an advantage. Exceptions can be made for candidates with a particular set of skills or with important prior experience.",
    ],
  },
  {
    question: "How much time do I need to put into the team every week?",
    answer: [
      "There is not a rule for how much time you need to put in. There can be weeks where you will not work at all, but there will be days where you will need to work many hours. The Team is young and does not have a large number of members, so it is expected that the members of the Team put a considerable amount of work into our projects.",
      "In general, we expect that students can provide at the very least 6 hours of work for the Team per week. Exceptions can be made for particular positions, such as those which require particular skills or prior experience.",
    ],
  },
  {
    question: "Can I join the Team if I am not an engineering student?",
    answer: [
      "Yes, the Team accepts students coming from all programs offered at Politecnico. There are many positions available in the Team, especially in the Operations subteam, which are suited also for students coming from non-engineering programs.",
    ],
  },
  {
    question: "Do you recruit only aerospace engineering students?",
    answer: [
      "Of course not! Even if as of now the majority of the Team's members come from the aerospace engineering program (around 68% as of Fall 2022), some of the Team's positions are suited for students of the computer science, electronic, mechanical, management, or energy engineering programs, as well as many others.",
      "Furthermore, due to competition, the acceptance rate for aerospace engineering students is probably going to be lower than the one for students coming from other programs. This means that if you do not study aerospace engineering, you might face less competition in your application for certain positions than your aerospace engineering colleagues.",
    ],
  },
  {
    question: "What is the acceptance rate onto the team?",
    answer: [
      "Fall 2022 was the first general recruitment of the Team and we had an acceptance rate of around 15%. As much as we would love to accept every application, the Team can not manage the work of hundreds of members. Do not let this discourage you: we are always looking for motivated and talented young students.",
    ],
  },
  {
    question: "Do you recruit at the beginning of the 2nd semester?",
    answer: [
      "We do not know yet, but it is unlikely. Training new members takes time, and if students join in the winter semester they will start working towards the end of the academic year, which is not ideal.",
      "Students could be recruited at the beginning of the 2nd semester if they possess a particular set of skills or experience which matches the Team's needs.",
    ],
  },
  {
    question: "Can I join the Team if I am not a Politecnico di Torino student, or if I am a high school student?",
    answer: [
      "PoliTo Rocket Team is a student team which gets its resources from the Dept. of Mechanical and Aerospace engineering of Politecnico di Torino. For this reason, we can't accept students outside Politecnico. However, it is possible to cooperate and work together on some particular projects. If you are working on a rocketry-related project and you want to collaborate with us, contact us.",
    ],
  },
];
