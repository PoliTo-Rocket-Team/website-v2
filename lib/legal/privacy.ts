import { DATA_CONTACT, TEAM_ADDRESS, TEAM_NAME } from "./contact";
import type { LegalDocument } from "./types";

// The Privacy Policy (/privacy, issue #122). Each field it names is one the
// site stores: Google sign-in (ADR 0008, db/schema/better-auth.ts), the
// application form (lib/apply/application-form.ts), the private file store
// (ADR 0010), the member record (db/schema/public.ts), who sees what
// (docs/dashboard-rules.md), and how long it is kept (ADR 0011 rule 8,
// ADR 0012, lib/dashboard/anonymize.ts, issue #257). A change to what the site
// stores changes this text with it.

const APPLICATION_READERS =
  "The leads of the division you applied to and the head of its department, the team leader, the operations lead, the IT lead, the Project Manager and the Chief Engineer, and team members given access to applications for that role.";

export const privacyPolicy: LegalDocument = {
  description: "What personal data the PoliTo Rocket Team site keeps, where it is kept, who can see it, and how long.",

  header: {
    eyebrow: "LEGAL · PRIVACY POLICY",
    title: "Privacy Policy",
    intro:
      "What we keep about you when you sign in, apply or join the team, where we keep it, who can see it, and how to ask for a copy or for it to be deleted.",
  },

  updated: "2026-10-25",

  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        {
          kind: "paragraph",
          text: `${TEAM_NAME} is a student rocketry team at Politecnico di Torino (${TEAM_ADDRESS}). We run this site, and we decide how the personal data it collects is used. This policy follows the EU General Data Protection Regulation (GDPR).`,
        },
        {
          kind: "paragraph",
          text: `For any question about your data, write to us at ${DATA_CONTACT}.`,
        },
      ],
    },
    {
      id: "what-we-keep",
      title: "What we keep, where, and who sees it",
      blocks: [
        {
          kind: "paragraph",
          text: "You can read the public pages without signing in. We keep personal data only when you sign in, apply for a position or join the team. We do not show ads, and we do not track you for advertising.",
        },
        {
          kind: "data",
          rows: [
            {
              what: "Your Google account",
              fields: ["Name", "Email address", "Profile photo"],
              where: "Our database. Google is the only way to sign in, and we never see your Google password.",
              who: "You, and the team members who handle your application or your place on the team.",
            },
            {
              what: "Your application",
              fields: [
                "First and last name",
                "PoliTo ID",
                "Phone number",
                "Date of birth",
                "Study programme and degree programme",
                "Your answers to the position's questions",
              ],
              where: "Our database.",
              who: APPLICATION_READERS,
            },
            {
              what: "Statistics answers",
              fields: ["Gender", "International or domestic student", "How you heard about us"],
              where: "Our database, beside your application.",
              who: "The same people as your application. We use these answers for team statistics.",
            },
            {
              what: "Your files",
              fields: ["CV", "Motivation letter, when the position asks for one"],
              where:
                "A private file store. The files have no public link: they open only for a signed-in person who is allowed to see your application.",
              who: APPLICATION_READERS,
            },
            {
              what: "If you join the team",
              fields: [
                "Team email address, mobile number and Discord name",
                "The name and date on your signed NDA",
                "Your country and LinkedIn profile, if you add them",
                "Your profile photo, roles and years on the team",
              ],
              where: "Our database. Profile photos are kept in a public file store.",
              who: "The team leads and the team members the dashboard rules allow. Your name, photo and role show on the public Team page while you are on the team.",
            },
            {
              what: "Sign-in and security records",
              fields: [
                "Your sign-in sessions, with the IP address and browser they came from",
                "A record of the changes made in the dashboard, and who made them",
              ],
              where: "Our database.",
              who: "The sessions are used only to keep you signed in and your account safe. Only the IT lead can read the record of changes.",
            },
          ],
        },
        {
          kind: "paragraph",
          text: "The site also counts page visits and measures how fast pages load, with Vercel Web Analytics and Speed Insights. They report totals, use no advertising cookies and do not build a profile of you. The only cookie we set is the one that keeps you signed in.",
        },
      ],
    },
    {
      id: "why",
      title: "Why we use it, and on what basis",
      blocks: [
        {
          kind: "list",
          items: [
            "To handle your application and, if you join, your place on the team. You ask us to do this when you apply (GDPR Article 6(1)(b)).",
            "To keep statistics on who applies and who joins, so we can run fair recruitment and report on the team. This is our legitimate interest (Article 6(1)(f)), and the statistics never name you.",
            "To keep the site and your account secure. This is our legitimate interest (Article 6(1)(f)).",
          ],
        },
        {
          kind: "paragraph",
          text: "We do not sell your data, and we do not use it for advertising or for any decision made only by a machine.",
        },
      ],
    },
    {
      id: "who-else",
      title: "Who else handles it",
      blocks: [
        {
          kind: "paragraph",
          text: "A few services run parts of the site for us. They handle your data only to provide their service, under their data processing terms:",
        },
        {
          kind: "list",
          items: [
            "Google, for sign-in.",
            "Vercel, which hosts the site and the file stores, and provides the visit and speed counts.",
            "Neon, which hosts our database.",
          ],
        },
        {
          kind: "paragraph",
          text: "Some of these services may handle data outside the EU. Where they do, they rely on the safeguards the GDPR allows, such as the European Commission's standard contractual clauses.",
        },
      ],
    },
    {
      id: "how-long",
      title: "How long we keep it",
      blocks: [
        {
          kind: "list",
          items: [
            "While your account is open, we keep what you gave us, so you can follow your applications and we can manage the team.",
            "If you withdraw an application, the leads stop seeing it at once, and its files are deleted 30 days later.",
            "If you delete your account, your data is kept for at least one year. Then it is anonymized and kept only for statistics. Your files and photos are deleted at that point.",
          ],
        },
        {
          kind: "paragraph",
          text: "We keep the data of a deleted account for at least one year because recruitment and the team's work run by academic year. Over that year we may need to answer a question about a past application or a past member, or show that recruitment was fair. This is our legitimate interest (GDPR Article 6(1)(f)). After that, anonymized data no longer identifies you, so it is kept only for statistics.",
        },
      ],
    },
    {
      id: "alumni",
      title: "Your name on the Alumni page",
      blocks: [
        {
          kind: "paragraph",
          text: "If you were on the team, your alumni entry is part of the team's history: your name, your years on the team, your roles and, where it applies, your founder mark. It stays on the Alumni page after you leave, after you delete your account and after your data is anonymized.",
        },
        {
          kind: "paragraph",
          text: "If you do not want this, tick \"Remove my name from the Alumni page\" in the Leave the team or the Delete account dialog. You can also ask us later.",
        },
      ],
    },
    {
      id: "your-rights",
      title: "Your rights, and how to use them",
      blocks: [
        {
          kind: "paragraph",
          text: "Under the GDPR you can ask us to:",
        },
        {
          kind: "list",
          items: [
            "Give you a copy of the data we keep about you, in a common format you can take elsewhere.",
            "Correct data that is wrong. You can change most of your details yourself on My account or My profile.",
            "Delete your data. You can delete your account yourself from the dashboard, or ask us to do it.",
            "Limit how we use your data, or stop using it where we rely on our legitimate interest.",
          ],
        },
        {
          kind: "paragraph",
          text: `To ask for a copy, a correction or a deletion, write to ${DATA_CONTACT} from the email address you sign in with. We answer within one month.`,
        },
        {
          kind: "paragraph",
          text: "If you think we handle your data wrongly, you can also complain to the Italian data protection authority, the Garante per la protezione dei dati personali (garanteprivacy.it).",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        {
          kind: "paragraph",
          text: "If we change what we keep or how we use it, we update this page and the date at its top.",
        },
      ],
    },
  ],
};
