// The Team's partners, one record read by the Partners page (/partners,
// boards 31, 31b, 31m) and the landing page's logo strip. Partners move to the
// database and the dashboard later, so every field is a plain value a form
// can fill. A fact a partner does not have is an absent key: no website
// (Magicar), no text of their own (JEToP).
//
// Order is the live partners page's order, and both surfaces keep it.
// The about and support texts are the live page's, shortened to the limits
// below (Huey's card-size ruling on #107) with their meaning and facts kept;
// the one-liners are board 31's.
//
// Adding a partner: one entry here, the logo in public/design/sponsors/, then
// `pnpm logos:check`, which measures the logo and fails until `darkLogo`
// matches the measurement, and `pnpm partners:check`, which fails while a
// text is over its limit.

import type { HeaderStats } from "./about/types";
import { university } from "./about/university";

/** A logo file in public/design/sponsors/, given as its path from the site root. */
export type LogoSrc = `/design/sponsors/${string}.png`;

export type PartnerLogo = {
  src: LogoSrc;
  /** The file's own pixels: its true shape before it loads. */
  width: number;
  height: number;
  /** A wordmark is drawn shorter than a near-square mark, so both read the same size. */
  kind: "wordmark" | "mark";
  /**
   * Too dark to read on the dark page, so it is drawn all white with a CSS
   * filter. Set from `pnpm logos:check`, never by eye.
   */
  darkLogo: boolean;
};

export type PartnerTier = "main" | "media";

/** The partner's own text: about them, then what they do for the Team. */
export type PartnerStory = {
  about: string;
  support?: string;
};

export type Partner = {
  name: string;
  logo: PartnerLogo;
  /** A full http(s) URL. */
  website?: string;
  tier: PartnerTier;
  /** One line on how they help (board 31). */
  oneLiner: string;
  story?: PartnerStory;
};

/**
 * The most characters (Unicode code points) each partner text may hold.
 * Every desktop card has one fixed height, sized in
 * components/partners/partner-card.tsx for an about and a support text at
 * these limits, so a longer text would spill out of its card. The future
 * dashboard's form reads the same numbers.
 */
export const PARTNER_TEXT_LIMITS = {
  oneLiner: 80,
  about: 220,
  support: 160,
} as const;

export type PartnerTextField = keyof typeof PARTNER_TEXT_LIMITS;

/** One text over its limit, named so a form or a build log can say which. */
export type TextOverLimit = {
  partner: string;
  field: PartnerTextField;
  length: number;
  limit: number;
};

/** The length a limit counts: code points, so "ò" is one character. */
export function textLength(text: string): number {
  return [...text].length;
}

/** Every text of this partner that is over its limit; empty when all fit. */
export function textsOverLimit(partner: Partner): TextOverLimit[] {
  const texts: [PartnerTextField, string | undefined][] = [
    ["oneLiner", partner.oneLiner],
    ["about", partner.story?.about],
    ["support", partner.story?.support],
  ];
  return texts.flatMap(([field, text]) => {
    const limit = PARTNER_TEXT_LIMITS[field];
    if (text === undefined || textLength(text) <= limit) return [];
    return [{ partner: partner.name, field, length: textLength(text), limit }];
  });
}

/**
 * The record as it may be read: throws while any text is over its limit, so
 * `next build` (which renders both pages that import this file) and
 * `pnpm partners:check` fail on it.
 */
function withinTextLimits(list: readonly Partner[]): readonly Partner[] {
  const over = list.flatMap(textsOverLimit);
  if (over.length > 0) {
    const lines = over.map((o) => `  ${o.partner}: ${o.field} is ${o.length} characters, limit ${o.limit}`);
    throw new Error(`Partner texts over their limit (lib/partners.ts):\n${lines.join("\n")}`);
  }
  return list;
}

export const partners: readonly Partner[] = withinTextLimits([
  {
    name: "Sòphia High Tech",
    logo: { src: "/design/sponsors/color-sophia.png", width: 514, height: 463, kind: "mark", darkLogo: false },
    website: "https://www.sophiahightech.com/",
    tier: "main",
    oneLiner: "Additive manufacturing equipment for Efesto, our liquid engine.",
    story: {
      about:
        "Sòphia High Tech, certified to AS/EN9100, designs and produces metal alloy aerospace components by Additive Manufacturing (SLM, to ECSS-Q-ST-70-80C) and CNC Machining.",
      support: "Sòphia High Tech supports project Efesto with state-of-the-art equipment, crucial for the project's success.",
    },
  },
  {
    name: "Siemens",
    logo: { src: "/design/sponsors/color-siemens.png", width: 794, height: 127, kind: "wordmark", darkLogo: false },
    website: "https://www.siemens.com/it/it.html",
    tier: "main",
    oneLiner: "PLM software that runs the Team's work from design to production.",
    story: {
      about:
        "Siemens is one of the world's largest industrial conglomerates, in energy, aerospace and digital services. Its PLM software manages a product's whole lifecycle, from conception through production to end of life.",
      support: "Siemens provides a comprehensive suite of software that will be critical for the Team to take its activities forward.",
    },
  },
  {
    name: "EvoMisure",
    logo: { src: "/design/sponsors/color-evomisure.png", width: 742, height: 137, kind: "wordmark", darkLogo: false },
    website: "https://www.evomisure.it/",
    tier: "main",
    oneLiner: "Probes and sensors for our wind tunnel tests, light enough to fly.",
    story: {
      about:
        "EvoMisure, founded in 2016, provides turnkey measurement solutions for aerodynamics: velocity and pressure probes and custom rakes, for wind tunnel testing and real-world applications.",
      support:
        "EvoMisure supports the Team's wind tunnel test. Their sensors are easy to use, compact and light, which makes them ideal for future flight tests too.",
    },
  },
  {
    name: "Altium",
    logo: { src: "/design/sponsors/color-altium.png", width: 743, height: 163, kind: "wordmark", darkLogo: false },
    website: "https://www.altium.com/",
    tier: "main",
    oneLiner: "Altium Designer licences for the rocket's onboard electronics.",
    story: {
      about: "Altium is one of the world's leading companies in electronic design software, with advanced tools for creating PCBs and complex systems.",
      support:
        "Through its Education program, Altium gives the Team Altium Designer licenses to design advanced circuits for our rocket's onboard systems.",
    },
  },
  {
    name: "ASSOCAM Scuola Camerana",
    logo: { src: "/design/sponsors/color-camerana.png", width: 1600, height: 508, kind: "wordmark", darkLogo: false },
    website: "https://www.scuolacamerana.it/",
    tier: "main",
    oneLiner: "Mechanical machining and parts for our builds.",
    story: {
      about:
        "ASSOCAM Scuola Camerana, rooted in Turin's industry, has given post-diploma training since 1959. A training agency of Unione Industriali and Camera di Commercio of Turin, it has many labs and machines.",
      support: "Assocam Scuola Camerana provides the Team with the mechanical machining and components it needs for its activities.",
    },
  },
  {
    name: "Explorer Cases",
    logo: { src: "/design/sponsors/color-explorer.png", width: 310, height: 78, kind: "wordmark", darkLogo: false },
    website: "https://www.explorercases.com/",
    tier: "main",
    oneLiner: "Tough cases to carry our equipment safely to every launch.",
    story: {
      about:
        "Explorer Cases, made by GT Line, are indestructible, waterproof cases for professional equipment. Constant R&D has earned them multiple certifications, and strict lab tests prove them for extreme use.",
      support: "Explorer Cases supports the Team by providing its cases for the safe and practical transport of our equipment.",
    },
  },
  {
    name: "Ansys",
    logo: { src: "/design/sponsors/color-ansys.png", width: 207, height: 66, kind: "wordmark", darkLogo: false },
    website: "https://www.ansys.com/",
    tier: "main",
    oneLiner: "Engineering simulation software.",
    story: {
      about:
        "With more than 50 years of experience, Ansys is the world reference in engineering simulation, letting engineers predict how products will perform in the real world while cutting prototype costs and time.",
    },
  },
  {
    name: "ESSS",
    logo: { src: "/design/sponsors/color-esss.png", width: 768, height: 260, kind: "wordmark", darkLogo: false },
    website: "https://www.esss.com/",
    tier: "main",
    oneLiner: "Simulation software, consulting and training.",
    story: {
      about:
        "ESSS is a leading engineering and scientific software company. It offers finite element, fluid dynamics and multiphysics simulation, with consulting and training, for aerospace, automotive and energy.",
    },
  },
  {
    name: "Mul2 Research Group",
    logo: { src: "/design/sponsors/color-mul2.png", width: 173, height: 100, kind: "wordmark", darkLogo: false },
    website: "http://www.mul2.polito.it/",
    tier: "main",
    oneLiner: "3D printers, printing materials and additive manufacturing know-how.",
    story: {
      about:
        "Mul2 is a research group in Politecnico di Torino's Dept. of Mechanical and Aerospace Engineering, developing advanced structural models for MULSs, with a focus on multifield and fluid-structure analysis.",
      support: "Mul2 provides 3D printers and 3D printing materials, along with technical support for the additive manufacturing processes.",
    },
  },
  {
    name: "Magicar",
    logo: { src: "/design/sponsors/color-magicar.png", width: 857, height: 324, kind: "wordmark", darkLogo: false },
    tier: "main",
    oneLiner: "The livery of VES, designed and crafted by hand.",
    story: {
      about:
        "Distinguished by outstanding professionalism and dedication, Carrozzeria Magicar of Fossano (CN) is an example of the commitment and passion of Italian and Piedmontese entrepreneurship.",
      support:
        "Magicar designs and crafts the livery of our Vittorio Emanuele II (VES) project, bringing quality and character to a project of innovation and heritage.",
    },
  },
  {
    name: "Astrospace",
    logo: { src: "/design/sponsors/color-astrospace.png", width: 1200, height: 193, kind: "wordmark", darkLogo: true },
    website: "https://www.astrospace.it/",
    tier: "main",
    oneLiner: "Outreach support and access to the ORBIT platform.",
    story: {
      about:
        "Astrospace is an innovative startup sharing humanity's journey through space: news on space exploration, astronomy and the space economy, plus books, merchandise and community events.",
      support:
        "Astrospace offers discounted access to the ORBIT platform, and promotes science communication, outreach and event organization through collaborative efforts.",
    },
  },
  {
    name: "BETA CAE Systems",
    logo: { src: "/design/sponsors/color-beta-cae.png", width: 900, height: 408, kind: "wordmark", darkLogo: true },
    website: "https://www.beta-cae.com/",
    tier: "main",
    oneLiner: "ANSA and META software, with technical support.",
    story: {
      about:
        "BETA CAE Systems transformed CAE almost 30 years ago with automation software for simulation and analysis. Today it is a world leader in engineering simulation, in aerospace, defense, automotive, energy and more.",
      support: "BETA CAE Systems provides material support with the ANSA and META software suites, as well as technical support to the Team.",
    },
  },
  {
    name: "JEToP",
    logo: { src: "/design/sponsors/color-jetop.png", width: 268, height: 354, kind: "mark", darkLogo: false },
    website: "https://www.jetop.com/",
    tier: "media",
    oneLiner: "Junior Enterprise of Politecnico di Torino.",
  },
]);

export function partnersOf(tier: PartnerTier): readonly Partner[] {
  return partners.filter((p) => p.tier === tier);
}

/** The Partners page's own copy (boards 31 and 31m). */
export const partnersPage = {
  description: "The companies and groups that give the PoliTo Rocket Team money, equipment, software and know-how.",
  header: {
    eyebrow: "PARTNERS",
    title: "Partners",
    intro:
      "Building rockets doesn't come easy. Our partners give us money, equipment, software and know-how. Here is what each of them does for the Team.",
  },
  mainTitle: "Main partners",
  mediaTitle: "Media partners",
  become: {
    eyebrow: "BECOME A PARTNER",
    title: "Help us build the next one.",
    body: "We welcome financial, technical or material support, and any service that helps a student team fly. Write to us and we'll tell you what we're working on.",
    cta: "Write to us",
    email: "info@politorocketteam.it",
  },
} as const;

/**
 * The header's four figures. The partner counts come from the record, and the
 * budget split from Politecnico's share on the Our University page, so the
 * two pages never disagree.
 */
export function partnerStats(): HeaderStats {
  const main = partnersOf("main").length;
  const media = partnersOf("media").length;
  const politecnico = university.support.share;
  return [
    { value: String(main), label: { text: main === 1 ? "PARTNER" : "PARTNERS" } },
    { value: String(media), label: { text: media === 1 ? "MEDIA PARTNER" : "MEDIA PARTNERS" } },
    { value: `${100 - politecnico}%`, label: { text: "OF OUR BUDGET FROM PARTNERS", phone: "FROM PARTNERS" } },
    { value: `${politecnico}%`, label: { text: "FROM POLITECNICO" } },
  ];
}
