import type { HeaderStats } from "./about/types";
import type { NonEmpty } from "./about/alumni-types";
import {
  CHANNEL_NAMES,
  type BodyBlock,
  type ChannelName,
  type Channel,
  type IsoDate,
  type OutreachContent,
  type OutreachCopy,
  type OutreachPost,
  type OutreachTag,
  type PostView,
} from "./outreach-types";

// Boards 32/32m (the Outreach page) and 33/33m (a post page). The posts are
// the team's live Outreach page: each body is the live post's own text, and
// the title, summary and lead say the same in fewer words, as the boards do.
// Each post has one photo and one channel today, the "See more" link on the
// live page. The summit, the posts and the tags below are the record the
// import carries into the database (lib/outreach-import.ts, issue #287). The
// pages read the published ones from there (lib/outreach-public.ts), and this
// record only where there is no database or no outreach tables yet.

export const outreachCopy: OutreachCopy = {
  description:
    "We share rocketry beyond our workshop: a student summit we started, talks at congresses, school fairs and workshops, and runs for a good cause.",

  header: {
    eyebrow: "OUTREACH",
    title: "Outreach",
    intro:
      "We share rocketry beyond our workshop: a student summit we started, talks at congresses, school fairs and workshops, and runs for a good cause.",
  },

  postsTitle: "Where we’ve been",
};

/** The record's tags, in the order the editor lists them. Award is the one the header counts. */
const recordTags: NonEmpty<OutreachTag> = [
  { name: "Award", award: true },
  { name: "Charity run", award: false },
  { name: "Congress", award: false },
  { name: "Expo", award: false },
  { name: "Fair", award: false },
  { name: "Hackathon", award: false },
  { name: "School", award: false },
  { name: "Summit", award: false },
  { name: "Talk", award: false },
  { name: "Visit", award: false },
];

export const outreachRecord: OutreachContent & { readonly posts: NonEmpty<OutreachPost> } = {
  tags: recordTags,

  feature: {
    eyebrow: "STARTED BY US · 2023",
    title: "IRESS, the Italian Rocket Engineering Student Summit",
    story: {
      text: "In May 2023 we brought rocket teams from Italy's main universities together for the first time, in the Aula Magna of Politecnico di Torino, with speakers from ArianeSpace and Avio. The summit now moves city every year: Padova in 2024, Rome in 2025.",
      phone:
        "In May 2023 we brought rocket teams from Italy's main universities together for the first time, in the Aula Magna of Politecnico di Torino. The summit now moves city every year.",
    },
    photo: {
      src: "/outreach/iress-2023-torino.webp",
      alt: "Students from Italy's rocket teams in the Aula Magna of Politecnico di Torino, under the IRESS screen.",
    },
    editions: [
      { year: 2023, place: "Torino" },
      { year: 2024, place: "Padova" },
      { year: 2025, place: "Rome" },
    ],
  },

  posts: [
    {
      title: "Wings for Life, Aosta",
      date: "2025-05-04",
      place: "Aosta, Italy",
      tags: ["Charity run"],
      summary: {
        text: "About thirty of us ran the first Aosta edition of the Wings for Life World Run, invited by Red Bull, and raised about €800 for spinal cord research.",
        phone: "About thirty of us ran the first Aosta edition of the Wings for Life World Run and raised about €800 for spinal cord research.",
      },
      lead: "About thirty of us ran the first Aosta edition of the Wings for Life World Run, invited by Red Bull, for spinal cord research.",
      body: [
        {
          kind: "paragraph",
          text: "On May 4th 2025, the team had the pleasure to join the first-ever Aosta edition of the Wings for Life World Run, invited by Red Bull. Around thirty of us ran ‘for those who can’t’, supporting research into spinal cord injuries through this global solidarity run. Our participation fees helped raise around €800 for the cause.",
        },
      ],
      photos: [
        {
          src: "/outreach/wings-for-life-aosta.webp",
          alt: "About thirty team members in running gear at the Wings for Life World Run in Aosta.",
        },
      ],
      channels: {
        linkedin: {
          url: "https://www.linkedin.com/posts/politorocketteam_aosta-supportingresearch-invitation-activity-7328733962451816450-CyiE",
          caption: "On May 4th 2025, the team had the pleasure to join the first-ever Aosta edition of the Wings for Life World Run…",
        },
      },
    },
    {
      title: "IRESS, 3rd edition",
      date: "2025-04-28",
      place: "Rome, Italy",
      tags: ["Summit"],
      summary: { text: "In Rome, hosted by SASA. Sophia High Tech joined our talk with a lecture on additive manufacturing." },
      lead: "The summit we started went to Rome for its third edition, hosted by SASA, and our talk brought in Sophia High Tech.",
      body: [
        {
          kind: "paragraph",
          text: "This year again, a delegation from the PoliTo Rocket Team took part in the annual IRESS conference, now in its third edition, this time hosted in Rome by SASA (Sapienza Aerospace Student Association). Rocketry teams from different Italian universities participated, each presented a short presentation on SRAD innovations. During the Polito Rocket team’s talk, Sophia High Tech also took part with a lecture on the use of additive manufacturing. It was an exceptional opportunity to catch up with all the teams, socialize and keep the rocketry community together, which is getting bigger year after year. A special thanks to SASA for organizing this amazing event.",
        },
      ],
      photos: [
        {
          src: "/outreach/iress-2025-rome.webp",
          alt: "Students from Italy's rocket teams on stage under a fresco at IRESS 2025 in Rome.",
        },
      ],
      channels: {
        linkedin: {
          url: "https://www.linkedin.com/feed/update/urn:li:activity:7327728741634203648/",
          caption: "This year again, a delegation from the PoliTo Rocket Team took part in the annual IRESS conference, now in its third edition…",
        },
      },
    },
    {
      title: "Cassini Hackathon",
      date: "2024-11-22",
      tags: ["Hackathon"],
      summary: {
        text: "We sponsored the 8th CASSINI Hackathon on defence and security, with Fondazione E. Amaldi and EUSPA.",
        phone: "We sponsored the 8th CASSINI Hackathon on defence and security.",
      },
      lead: "We sponsored the 8th CASSINI Hackathon, “Defence and Security”, with Fondazione E. Amaldi and EUSPA.",
      body: [
        {
          kind: "paragraph",
          text: "The team proudly participated in the 8th CASSINI Hackathon ‘Defence and Security’, sponsored in collaboration with Fondazione E. Amaldi and EUSPA. This event fostered innovation in space technologies, challenging participants to tackle geospatial intelligence, drone security operations, and space maneuver simulations. Acting as a sponsor, the team was able to connect with students and graduates, mentors and experts, creating a dynamic ecosystem for groundbreaking ideas. The hackathon highlighted the power of collaboration to drive innovation in Europe’s defence and security sectors.",
        },
      ],
      photos: [
        {
          src: "/outreach/cassini-hackathon.webp",
          alt: "Five team members at a panel table with microphones during the CASSINI Hackathon.",
        },
      ],
      channels: {
        linkedin: {
          url: "https://www.linkedin.com/posts/fondazione-e-amaldi_defis-euspace-europeanleagueofeconomycooperation-activity-7269678120851382273-jt43",
          caption: "The team proudly participated in the 8th CASSINI Hackathon ‘Defence and Security’, sponsored in collaboration with Fondazione E. Amaldi…",
          account: "Fondazione E. Amaldi",
        },
      },
    },
    {
      title: "IAC 2024, Milan",
      date: "2024-10-14",
      place: "Milan, Italy",
      tags: ["Congress", "Award"],
      summary: {
        text: "At the largest IAC ever we showed Cavour and presented two papers, winning the Geography, Generation, Gender award.",
        phone: "At the largest IAC ever we showed Cavour, presented two papers and won an award.",
      },
      lead: "We showed Cavour and our rocket parts at the 75th International Astronautical Congress, the largest IAC in history, and came home with an award.",
      body: [
        {
          kind: "paragraph",
          text: "The team attended the 75th International Aeronautical Congress in Milan, showcasing our rocket components and the Cavour rocket at the largest IAC in history. During the event, we participated in the Student Team Challenge, presenting a paper on the sustainable design of our liquid rocket engine Efesto, earning the Geography, Generation, Gender award for our commitment to inclusivity. Additionally, we presented a paper on the innovative structure of Cavour’s fins, highlighting our dedication to engineering excellence and innovation.",
        },
        { kind: "highlight", label: "AWARD", text: "Geography, Generation, Gender award · Student Team Challenge" },
      ],
      photos: [
        {
          src: "/outreach/iac-2024-milan.webp",
          alt: "Team members on stage at IAC 2024 under a screen reading Geography, Generation, Gender award.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/DCJ3SWOCRaU/",
          caption: "The team attended the 75th International Aeronautical Congress in Milan, showcasing our rocket components and the Cavour rocket…",
        },
      },
    },
    {
      title: "PLD Space award",
      date: "2024-07-11",
      place: "Padova, Italy",
      tags: ["Summit", "Award"],
      summary: { text: "We won the PLD Space Program Management Challenge at IRESS 2024." },
      lead: "We won the PLD Space Program Management Challenge at IRESS 2024, against Italy's best university rocketry teams.",
      body: [
        {
          kind: "paragraph",
          text: "Competing among Italy’s finest university rocketry teams, we proudly demonstrated exceptional dedication, skills, and teamwork to win the PLD Space Program Management Challenge at IRESS 2024. This prestigious competition tested the management and leadership capabilities through the evaluation of innovative rocket launcher projects. A heartfelt thank you to PLD Space and all collaborators for this incredible opportunity, which marks a significant milestone in our journey toward excellence in space exploration and innovation.",
        },
        { kind: "highlight", label: "AWARD", text: "PLD Space Program Management Challenge · IRESS 2024" },
      ],
      photos: [
        {
          src: "/outreach/pld-space-award.webp",
          alt: "A graphic reading Program Management Challenge Winners 2024 over a photo of the team.",
        },
      ],
      channels: {
        linkedin: {
          url: "https://www.linkedin.com/posts/pld-space_spacetalent-activity-7216740388290629632-WDmu",
          caption: "Competing among Italy’s finest university rocketry teams, we proudly demonstrated exceptional dedication, skills, and teamwork…",
          account: "PLD Space",
        },
      },
    },
    {
      title: "FormNext, Frankfurt",
      date: "2024-05-19",
      place: "Frankfurt, Germany",
      tags: ["Expo"],
      summary: {
        text: "Our design and additive manufacturing division visited the world’s leading 3D-printing expo; Cavour’s fins drew a lot of interest.",
      },
      lead: "Our Design & Additive Manufacturing Division went to FormNext, the world’s leading expo for industrial 3D printing.",
      body: [
        {
          kind: "paragraph",
          text: "The Design & Additive Manufacturing Division recently attended FormNext Expo in Frankfurt, Germany, the world’s leading event for additive manufacturing and industrial 3D printing. The exhibition showcased cutting-edge advancements and fostered collaboration among industry leaders and innovators. Our team engaged with experts, gaining valuable insights into emerging technologies. Particular attention was drawn to the innovative design of Cavour’s fins assembly, which sparked significant interest and highlighted our commitment to excellence in aerospace engineering.",
        },
      ],
      photos: [
        {
          src: "/outreach/formnext-frankfurt.webp",
          alt: "An audience in a hall at FormNext watching a talk on topology optimisation.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/CzgVPXVtBLq/",
          caption: "The Design & Additive Manufacturing Division recently attended FormNext Expo in Frankfurt, Germany…",
        },
      },
    },
    {
      title: "IRESS, 2nd edition",
      date: "2024-05-07",
      place: "Padova, Italy",
      tags: ["Summit"],
      summary: { text: "In Padova, organised by Team Thrust: the summit we started now runs on its own." },
      lead: "The summit we started in 2023 went to Padova for its second edition, organised by Team Thrust.",
      body: [
        {
          kind: "paragraph",
          text: "The second edition of IRESS, the Italian Rocket Engineering Students Summit, took place in Padova. Our team was deeply honored to participate in this event, which we proudly initiated in 2023. It was inspiring to witness the dedication and exceptional efforts of Team Thrust from Padova in organizing such a remarkable gathering, attended by numerous distinguished guests. A fantastic opportunity to exchange ideas and strengthen the space community among Italian students!",
        },
      ],
      photos: [
        {
          src: "/outreach/iress-2024-padova.webp",
          alt: "Students from Italy's rocket teams under the IRESS screen at the second edition in Padova.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/C5-p8pCtJIy/",
          caption: "The second edition of IRESS, the Italian Rocket Engineering Students Summit, took place in Padova…",
        },
      },
    },
    {
      title: "IRESS, 1st edition",
      date: "2023-05-02",
      place: "Torino, Italy",
      tags: ["Summit"],
      summary: { text: "In Torino we brought rocket teams from Italy’s main universities together for the first time." },
      lead: "We brought rocket teams from Italy’s main universities together for the first time, at Politecnico di Torino.",
      body: [
        {
          kind: "paragraph",
          text: "The event brought together rocket teams from major Italian universities, promoting collaboration and networking among students, professionals, and industry leaders in the field of Rocket and Space Engineering. The summit provided a platform for students to showcase their projects, share ideas, and discuss the realities and challenges of this field.",
        },
      ],
      photos: [
        {
          src: "/outreach/iress-2023-torino.webp",
          alt: "Students from Italy's rocket teams in the Aula Magna of Politecnico di Torino, under the IRESS screen.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/CrwPytBs6Kr/",
          caption: "The event brought together rocket teams from major Italian universities, promoting collaboration and networking…",
        },
      },
    },
    {
      title: "Steam4Future",
      date: "2023-03-22",
      place: "Milan, Italy",
      tags: ["School"],
      summary: { text: "At Bocconi University we showed high school students the maths behind AI." },
      lead: "At Bocconi University we met high school students, Boeing Italy and ScuolAttiva at an event on the maths behind AI.",
      body: [
        {
          kind: "paragraph",
          text: "We recently took part in Steam4Future at Bocconi University, an event introducing high school students to the mathematics behind AI and its training models. It was a pleasure meeting students, Boeing Italy execs, Bocconi managers, and ScuolAttiva tutors: excited for more experiences ahead!",
        },
      ],
      photos: [
        {
          src: "/outreach/steam4future.webp",
          alt: "Five team members in front of a building at Bocconi University.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/CrBzVzKsSrl/",
          caption: "We recently took part in Steam4Future at Bocconi University, an event introducing high school students…",
        },
      },
    },
    {
      title: "Pi Day Fair",
      date: "2023-03-14",
      place: "Chivasso, Italy",
      tags: ["Fair", "School"],
      summary: { text: "In Chivasso we taught kids rocket basics with a water rocket, and showed the newly painted Cavour for the first time." },
      lead: "In Chivasso we taught kids rocket basics with a water rocket, and Cavour showed its new paint for the first time.",
      body: [
        {
          kind: "paragraph",
          text: "We enthusiastically participated in the Pi Day Fair organized by Associazione Ex Alunni Newton in Chivasso. It was a rewarding experience to nurture the curiosity of younger generations in scientific disciplines, as we taught them rocket science basics and demonstrated a do-it-yourself water-powered rocket. The event also marked the exciting debut of our newly-painted Cavour rocket.",
        },
      ],
      photos: [
        {
          src: "/outreach/pi-day-fair.webp",
          alt: "Children in a square gathered round a team member and the newly painted Cavour.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/Cp-9BnXs8WY/",
          caption: "We enthusiastically participated in the Pi Day Fair organized by Associazione Ex Alunni Newton in Chivasso…",
        },
      },
    },
    {
      title: "Pininfarina wind tunnel",
      date: "2023-02-23",
      place: "Grugliasco, Italy",
      tags: ["Visit"],
      summary: {
        text: "We visited one of Europe’s largest wind tunnels and presented our work to Pininfarina engineers.",
        phone: "We visited one of Europe’s largest wind tunnels, in Grugliasco.",
      },
      lead: "We visited Pininfarina’s wind tunnel in Grugliasco, one of the largest in Europe, and presented our work to its engineers.",
      body: [
        {
          kind: "paragraph",
          text: "Members of PoliTo Rocket Team recently visited Pininfarina’s Wind Tunnel in Grugliasco, one of the largest in Europe. The visit provided valuable insights into the significant role and importance of this establishment, as well as an opportunity to present our work to Pininfarina engineers.",
        },
      ],
      photos: [
        {
          src: "/outreach/pininfarina-wind-tunnel.webp",
          alt: "Team members inside Pininfarina's wind tunnel in Grugliasco.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/CpinA-ANFug/",
          caption: "Members of PoliTo Rocket Team recently visited Pininfarina’s Wind Tunnel in Grugliasco, one of the largest in Europe…",
        },
      },
    },
    {
      title: "Luna e Italia",
      date: "2022-12-16",
      place: "Torino, Italy",
      tags: ["Talk"],
      summary: { text: "We showed our projects and the Cavour prototype at an event for Italy’s National Space Day." },
      lead: "We presented our projects and the Cavour prototype at “Luna e Italia”, for Italy’s National Space Day.",
      body: [
        {
          kind: "paragraph",
          text: "Our Team had the privilege of presenting our projects and the Cavour Rocket prototype at the event ‘Luna e Italia. Torino e il futuro dell’esplorazione spaziale’, organized by Istituto Affari Internazionali and Politecnico di Torino, in celebration of Italy’s National Space Day. We showcased our work in front of esteemed representatives from academia, research, industry, and other institutions, as well as a large audience of attending students.",
        },
      ],
      photos: [
        {
          src: "/outreach/luna-e-italia.webp",
          alt: "Team members with the Cavour prototype at the Luna e Italia event.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/CmbxqzdsyA8/",
          caption: "Our Team had the privilege of presenting our projects and the Cavour Rocket prototype at the event ‘Luna e Italia…",
        },
      },
    },
    {
      title: "Hosting Space Eagle",
      date: "2022-11-25",
      place: "Torino, Italy",
      tags: ["School"],
      summary: { text: "We hosted Space Eagle, a high school rocketry group, with guided tours and hands-on workshops." },
      lead: "We hosted Space Eagle, a high school rocketry group, for guided tours and hands-on workshops.",
      body: [
        {
          kind: "paragraph",
          text: "STEM Outreach goes beyond inspiration; it sparks meaningful exchanges. Recently, PoliTo Rocket Team hosted Space Eagle, a talented high school rocketry group. Guided tours, hands-on workshops, and a remarkable collection unfolded, shaping the future of STEM education.",
        },
      ],
      photos: [
        {
          src: "/outreach/hosting-space-eagle.webp",
          alt: "High school students from Space Eagle with team members in the workshop.",
        },
      ],
      channels: {
        instagram: {
          url: "https://www.instagram.com/p/CrTSz02N8J-/",
          caption: "STEM Outreach goes beyond inspiration; it sparks meaningful exchanges. Recently, PoliTo Rocket Team hosted Space Eagle…",
        },
      },
    },
  ],
};

// What the pages read from the record. Every count and order is worked out
// here, so the record holds each fact once.

/** A post's address: its title in lower case, with every run of other characters as one hyphen. */
export function slugOf(post: Pick<OutreachPost, "title">): string {
  return post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The posts newest first, as the page lists them. */
export function newestFirst(posts: readonly OutreachPost[]): OutreachPost[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The home page's Track record section (board 21, issue #293): the newest
 * post as the featured card and the next three as the news cards.
 */
export type TrackRecord = { featured: OutreachPost; news: OutreachPost[] };

const TRACK_RECORD_NEWS = 3;

/** The Track record cards from the published posts, or null when none is published. */
export function trackRecord(posts: readonly OutreachPost[]): TrackRecord | null {
  const [featured, ...older] = newestFirst(posts);
  return featured === undefined ? null : { featured, news: older.slice(0, TRACK_RECORD_NEWS) };
}

/** The first address two posts share, or null. Two posts with one address would hide one of them. */
export function sharedSlug(posts: readonly OutreachPost[]): string | null {
  const seen = new Set<string>();
  for (const post of posts) {
    const slug = slugOf(post);
    if (seen.has(slug)) return slug;
    seen.add(slug);
  }
  return null;
}

{
  const shared = sharedSlug(outreachRecord.posts);
  if (shared !== null) throw new Error(`Two outreach posts share the address /outreach/${shared}`);
}

/** The post at an address, or undefined. Where two share it, the newest wins. */
export function postBySlug(posts: readonly OutreachPost[], slug: string): OutreachPost | undefined {
  return newestFirst(posts).find((p) => slugOf(p) === slug);
}

/** The next older and the next newer post, where there is one. */
export type Neighbouring = { older?: OutreachPost; newer?: OutreachPost };

/** The posts either side of one (none for a post not in the list): the next older and the next newer, where there is one. */
export function neighboursOf(posts: readonly OutreachPost[], post: Pick<OutreachPost, "title">): Neighbouring {
  const sorted = newestFirst(posts);
  const i = sorted.findIndex((p) => slugOf(p) === slugOf(post));
  if (i < 0) return {};
  return { older: sorted[i + 1], newer: i > 0 ? sorted[i - 1] : undefined };
}

/** The years that have posts, newest first: the year filter's pills after All. */
export function postYears(posts: readonly OutreachPost[]): number[] {
  return [...new Set(newestFirst(posts).map((p) => yearOf(p.date)))];
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

const WORDS_PER_MINUTE = 200;

/** "N min read": the body's words at about 200 a minute, never under one. */
export function readingMinutes(body: readonly BodyBlock[]): number {
  const words = body
    .map((b) => (b.kind === "highlight" ? `${b.label} ${b.text}` : b.text))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** The channels a post has, in `CHANNEL_NAMES` order (Instagram first), each with its name. */
export function channelsOf(post: Pick<PostView, "channels">): { name: ChannelName; channel: Channel }[] {
  return CHANNEL_NAMES.flatMap((name) => {
    const channel = post.channels[name];
    return channel === undefined ? [] : [{ name, channel }];
  });
}

/** The posts the header counts as awards: those carrying the tag the tag list marks as the award one. */
export function awardPosts(content: Pick<OutreachContent, "posts" | "tags">): OutreachPost[] {
  const award = new Set(content.tags.filter((t) => t.award).map((t) => t.name));
  return content.posts.filter((p) => p.tags.some((name) => award.has(name)));
}

/** The header's four figures, counted from the posts, the tags and the feature. */
export function outreachStats(content: OutreachContent): HeaderStats {
  const years = content.posts.map((p) => yearOf(p.date));
  const awards = awardPosts(content).length;
  return [
    {
      value: String(content.posts.length),
      label: { text: years.length === 0 ? "EVENTS" : `EVENTS SINCE ${Math.min(...years)}` },
    },
    { value: String(content.feature.editions.length), label: { text: "IRESS EDITIONS" } },
    { value: String(content.feature.editions[0].year), label: { text: "WE STARTED IRESS" } },
    { value: String(awards), label: { text: awards === 1 ? "AWARD" : "AWARDS" } },
  ];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parts(date: IsoDate): { year: number; month: (typeof MONTHS)[number]; day: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y, month: MONTHS[m - 1], day: d };
}

/** "MAY 2025" on a post card, "JUL 2024" on an older / newer card. */
export function monthYear(date: IsoDate): string {
  const { year, month } = parts(date);
  return `${month.slice(0, 3).toUpperCase()} ${year}`;
}

/** "03 MAY 2025" on a home Track record card (board 21). */
export function dayMonthYear(date: IsoDate): string {
  const { year, month, day } = parts(date);
  return `${String(day).padStart(2, "0")} ${month.slice(0, 3).toUpperCase()} ${year}`;
}

/** "Oct 2024" under an original post's account. */
export function shortMonthYear(date: IsoDate): string {
  const { year, month } = parts(date);
  return `${month.slice(0, 3)} ${year}`;
}

/** "14 Oct 2024" in the Edit post panel's Title and details line (board 74d). */
export function shortDayMonthYear(date: IsoDate): string {
  const { year, month, day } = parts(date);
  return `${day} ${month.slice(0, 3)} ${year}`;
}

/** "OCTOBER 14, 2024" in a post's meta line; phones use `monthYear`-style "OCT 14, 2024". */
export function longDate(date: IsoDate): { text: string; phone: string } {
  const { year, month, day } = parts(date);
  return {
    text: `${month.toUpperCase()} ${day}, ${year}`,
    phone: `${month.slice(0, 3).toUpperCase()} ${day}, ${year}`,
  };
}
