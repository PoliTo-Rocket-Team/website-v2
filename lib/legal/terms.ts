import { DATA_CONTACT, TEAM_ADDRESS, TEAM_NAME } from "./contact";
import type { LegalDocument } from "./types";

// The Terms of Service (/terms, issue #122): the use of the public site, of
// an applicant's account and of the team dashboard. Sign-in is Google only
// (ADR 0008); who may do what in the dashboard is docs/dashboard-rules.md.

export const termsOfService: LegalDocument = {
  description: "The terms for using the PoliTo Rocket Team site, applying for a position and using the team dashboard.",

  header: {
    eyebrow: "LEGAL · TERMS OF SERVICE",
    title: "Terms of Service",
    intro: "The rules for using this site, applying for a position, and using the team dashboard if you are on the team.",
  },

  updated: "2026-10-25",

  sections: [
    {
      id: "about",
      title: "About these terms",
      blocks: [
        {
          kind: "paragraph",
          text: `This site is run by ${TEAM_NAME}, a student rocketry team at Politecnico di Torino (${TEAM_ADDRESS}). By signing in, you agree to these terms. How we handle your personal data is in our Privacy Policy.`,
        },
      ],
    },
    {
      id: "the-site",
      title: "The public site",
      blocks: [
        {
          kind: "paragraph",
          text: "Anyone can read the public pages without an account. They tell the story of the team, its projects, its partners and its outreach. We keep them as accurate as we can, but they are for information only and may change without notice.",
        },
      ],
    },
    {
      id: "your-account",
      title: "Your account",
      blocks: [
        {
          kind: "list",
          items: [
            "You sign in with a Google account. It is the only way to sign in.",
            "Use your own account only, and keep it secure. What is done with your account is your responsibility.",
            "Keep your details true and up to date.",
            "You can delete your account at any time from the dashboard.",
          ],
        },
      ],
    },
    {
      id: "applying",
      title: "Applying to join",
      blocks: [
        {
          kind: "list",
          items: [
            "Give true answers, and upload only your own CV and motivation letter.",
            "The team decides on each application. Applying does not promise you an interview or a place.",
            "Accepting you does not put you on the team yet: you join once you have signed the team's NDA.",
            "You can withdraw an application at any time.",
          ],
        },
      ],
    },
    {
      id: "the-dashboard",
      title: "The team dashboard",
      blocks: [
        {
          kind: "paragraph",
          text: "The dashboard is for team members. What you can see and do in it depends on your role and on the access the team gives you.",
        },
        {
          kind: "list",
          items: [
            "Use it only for the team's work.",
            "Keep what you see there confidential, as your NDA says. This includes applicants' and members' personal data.",
            "Do not copy personal data out of the dashboard, or share it, beyond what your role needs.",
            "Your access ends when your role or your access grant ends.",
          ],
        },
      ],
    },
    {
      id: "fair-use",
      title: "Fair use",
      blocks: [
        {
          kind: "paragraph",
          text: "Do not:",
        },
        {
          kind: "list",
          items: [
            "Try to reach parts of the site, or data, that you are not allowed to see.",
            "Disrupt the site, overload it, or scan it with automated tools.",
            "Pretend to be someone else, or use the site for anything unlawful.",
          ],
        },
      ],
    },
    {
      id: "our-content",
      title: "Our content and brand",
      blocks: [
        {
          kind: "paragraph",
          text: "The text, photos, renders and the PoliTo Rocket Team name and logo belong to the team or to the people who made them. Partner logos belong to our partners. You may share links to our pages, but do not reuse our content or brand without asking us first.",
        },
      ],
    },
    {
      id: "liability",
      title: "No guarantee",
      blocks: [
        {
          kind: "paragraph",
          text: "We are a student team, and we run the site as it is. We do our best to keep it working and correct, but we cannot promise that it is always available or free of errors. As far as the law allows, we are not liable for loss caused by using the site, or by not being able to use it.",
        },
      ],
    },
    {
      id: "ending",
      title: "Ending access",
      blocks: [
        {
          kind: "paragraph",
          text: "If an account breaks these terms, we may suspend it or close it.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes and the law",
      blocks: [
        {
          kind: "paragraph",
          text: "We may update these terms. When we do, we update this page and the date at its top. Italian law applies to these terms.",
        },
        {
          kind: "paragraph",
          text: `For any question about these terms, write to us at ${DATA_CONTACT}.`,
        },
      ],
    },
  ],
};
