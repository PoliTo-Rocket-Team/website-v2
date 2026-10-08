// The Team's partners, one record read by the Partners page (/partners,
// boards 31, 31b, 31m) and the landing page's logo strip. Partners move to the
// database and the dashboard later, so every field is a plain value a form
// can fill. A fact a partner does not have is an absent key: no website
// (Magicar), no text of their own (JEToP).
//
// Order is the live partners page's order, and both surfaces keep it.
// The about and support texts are the live page's, as written there; the
// one-liners are board 31's.
//
// Adding a partner: one entry here, the logo in public/design/sponsors/, then
// `pnpm logos:check`, which measures the logo and fails until `darkLogo`
// matches the measurement.

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
  about: readonly [string, ...string[]];
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

export const partners: readonly Partner[] = [
  {
    name: "Sòphia High Tech",
    logo: { src: "/design/sponsors/color-sophia.png", width: 514, height: 463, kind: "mark", darkLogo: false },
    website: "https://www.sophiahightech.com/",
    tier: "main",
    oneLiner: "Additive manufacturing equipment for Efesto, our liquid engine.",
    story: {
      about: [
        "Sòphia High Tech, certified according to the Quality Standard AS/EN9100, operates in the Aerospace field, focusing on the design, development and production of metal alloy components using Additive Manufacturing and CNC Machining. Sòphia uses the most advanced technological processes: to produce complex components in shape and geometry, Sòphia uses Additive Manufacturing (SLM), according to ECSS-Q-ST-70-80C.",
      ],
      support:
        "Sophia High Tech supports the team in the development of project Efesto by providing state-of-the-art equipment, which will be crucial for the success of the project.",
    },
  },
  {
    name: "Siemens",
    logo: { src: "/design/sponsors/color-siemens.png", width: 794, height: 127, kind: "wordmark", darkLogo: false },
    website: "https://www.siemens.com/it/it.html",
    tier: "main",
    oneLiner: "PLM software that runs the Team's work from design to production.",
    story: {
      about: [
        "Siemens is one of the world's largest industrial conglomerates, operating in several sectors including energy, aerospace, and digital services. Siemens PLM software represents a comprehensive suite of tools designed to manage and optimize the entire lifecycle of a product, from conception through production to the end of its useful life. These tools enable integration between the various modules, ensuring smooth management of data and activities.",
      ],
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
      about: [
        "EvoMisure, founded in 2016, aims to provide turnkey measurement solutions, customized for aerodynamic applications. It supplies probes for velocity and pressure measurements, customized and flexible rakes, suitable for both wind tunnel testing and real-world applications. EvoMisure sensors enable companies to implement precise and reliable measurement systems.",
      ],
      support:
        "EvoMisure is supporting the Polito Rocket Team with the development of a wind tunnel test. The ease of use of their sensors, compact design, and low weight make them ideal for future flight tests as well.",
    },
  },
  {
    name: "Altium",
    logo: { src: "/design/sponsors/color-altium.png", width: 743, height: 163, kind: "wordmark", darkLogo: false },
    website: "https://www.altium.com/",
    tier: "main",
    oneLiner: "Altium Designer licences for the rocket's onboard electronics.",
    story: {
      about: [
        "Altium is one of the world's leading companies in the development of electronic design software, offering advanced tools for the creation of PCBs and complex systems. Through its Education program, Altium supports the PoliTo Rocket Team by providing professional licenses for Altium Designer, allowing members to design advanced electronic circuits and acquire fundamental skills in the field of electronic engineering, which are essential for the development of our rocket's onboard systems.",
      ],
    },
  },
  {
    name: "ASSOCAM Scuola Camerana",
    logo: { src: "/design/sponsors/color-camerana.png", width: 1600, height: 508, kind: "wordmark", darkLogo: false },
    website: "https://www.scuolacamerana.it/",
    tier: "main",
    oneLiner: "Mechanical machining and parts for our builds.",
    story: {
      about: [
        "ASSOCAM Scuola Camerana, is a Turin-based organisation rooted in the city's industrial fabric that has been providing post-diploma training since 1959. It brings together experienced technicians and teachers, as well as a large number of laboratories and machinery for students. In particular, it is a training agency of Unione Industriali and Camera di Commercio of Turin with a focus on technological training applied to industrial processes.",
      ],
      support: "Assocam Scuola Camerana provides the team with the necessary mechanical machining and components for its activities.",
    },
  },
  {
    name: "Explorer Cases",
    logo: { src: "/design/sponsors/color-explorer.png", width: 310, height: 78, kind: "wordmark", darkLogo: false },
    website: "https://www.explorercases.com/",
    tier: "main",
    oneLiner: "Tough cases to carry our equipment safely to every launch.",
    story: {
      about: [
        "EXPLORER CASES is a range of indestructible and waterproof cases which guarantee maximum protection when transporting professional equipment manufactured by GT line. It is a leading brand in the sector, established internationally.",
        "Constant investment in R&D has allowed them to develop efficient solutions, for which they have obtained multiple certifications. The cases are subjected to strict laboratory tests to guarantee their reliability to extreme conditions of use.",
      ],
      support: "Explorer cases supports the team by providing its cases for the safe and practical transport of our equipment.",
    },
  },
  {
    name: "Ansys",
    logo: { src: "/design/sponsors/color-ansys.png", width: 207, height: 66, kind: "wordmark", darkLogo: false },
    website: "https://www.ansys.com/",
    tier: "main",
    oneLiner: "Engineering simulation software.",
    story: {
      about: [
        "With more than 50 years of experience, Ansys is the world reference in engineering simulation. Its solutions are used by market leaders in all industries to revolutionize design, enabling engineers to explore and predict how products will perform in the real world.",
        "Reducing prototype costs and production time, improving quality, reducing risk, accelerating innovation across all industries to push the boundaries the predictive power of Ansys simulation is at your fingertips.",
      ],
    },
  },
  {
    name: "ESSS",
    logo: { src: "/design/sponsors/color-esss.png", width: 768, height: 260, kind: "wordmark", darkLogo: false },
    website: "https://www.esss.com/",
    tier: "main",
    oneLiner: "Simulation software, consulting and training.",
    story: {
      about: [
        "ESSS is a leading engineering solutions and scientific software company specializing in advanced simulations for industries such as aerospace, automotive, and energy.",
        "It offers tools for finite element analysis, computational fluid dynamics and multiphysics simulations, enabling companies to optimize design processes, reduce costs and improve efficiency.",
        "With dedicated consulting and training, ESSS supports innovation and helps customers achieve new standards of competitiveness.",
      ],
    },
  },
  {
    name: "Mul2 Research Group",
    logo: { src: "/design/sponsors/color-mul2.png", width: 173, height: 100, kind: "wordmark", darkLogo: false },
    website: "http://www.mul2.polito.it/",
    tier: "main",
    oneLiner: "3D printers, printing materials and additive manufacturing know-how.",
    story: {
      about: [
        "Mul2 Research Group is a research project within Politecnico di Torino's Dept. of Mechanical and Aerospace Engineering, devoted to the development of advanced structural models for MULSs with particular attention given to the multifield analysis and the fluid-structure interactions.",
      ],
      support:
        "Mul2 provides material support, with 3D printers and 3D printing materials, along with technical support for the additive manufacturing processes.",
    },
  },
  {
    name: "Magicar",
    logo: { src: "/design/sponsors/color-magicar.png", width: 857, height: 324, kind: "wordmark", darkLogo: false },
    tier: "main",
    oneLiner: "The livery of VES, designed and crafted by hand.",
    story: {
      about: [
        "Distinguished by outstanding professionalism and dedication, Carrozzeria Magicar of Fossano (CN) is an example of the commitment and passion of the Italian and Piedmontese entrepreneurship.",
      ],
      support:
        "We are proud to have Magicar as a partner in the Vittorio Emanuele II (VES) project, where their expertise plays a key role in designing and crafting the vehicle's livery. Their support brings quality and character to a project that celebrates innovation and heritage.",
    },
  },
  {
    name: "Astrospace",
    logo: { src: "/design/sponsors/color-astrospace.png", width: 1200, height: 193, kind: "wordmark", darkLogo: true },
    website: "https://www.astrospace.it/",
    tier: "main",
    oneLiner: "Outreach support and access to the ORBIT platform.",
    story: {
      about: [
        "Astrospace is an innovative startup dedicated to sharing humanity's journey through space. Through social media, the ORBIT platform, and an information portal, it provides updates on space exploration, astronomy, and the space economy. Additionally, it creates books, merchandise, and organizes community events to inspire and engage enthusiasts.",
      ],
      support:
        "Astrospace supports teams by offering discounted access to the ORBIT platform and promoting activities such as scientific communication, outreach, event organization, and more through collaborative efforts.",
    },
  },
  {
    name: "BETA CAE Systems",
    logo: { src: "/design/sponsors/color-beta-cae.png", width: 900, height: 408, kind: "wordmark", darkLogo: true },
    website: "https://www.beta-cae.com/",
    tier: "main",
    oneLiner: "ANSA and META software, with technical support.",
    story: {
      about: [
        "BETA CAE Systems transformed CAE by introducing revolutionary automation software tools and practices into Simulation and Analysis processes almost 30 years ago. Today, BETA CAE Systems is a world leader of Engineering Simulation, thanks to their softwares deployed in the Aerospace, Defense, Automotive, Biomechanics, Electronics, Energy and other Industries.",
      ],
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
];

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
