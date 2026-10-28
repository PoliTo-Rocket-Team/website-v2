// The Terms of Service and the Privacy Policy (/terms and /privacy, issue
// #122) as data: one record each, drawn by components/legal/legal-page.tsx.
// The page numbers its sections from their order, so a record holds no number.

/** One kind of personal data the site keeps: what it is, where it is kept, and who can see it. */
export type DataRow = {
  readonly what: string;
  readonly fields: readonly [string, ...string[]];
  readonly where: string;
  readonly who: string;
};

/** One block of a section's text. */
export type LegalBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly [string, ...string[]] }
  | { readonly kind: "data"; readonly rows: readonly [DataRow, ...DataRow[]] };

export type LegalSection = {
  /** The section's anchor on the page: kebab-case, unique in its document. */
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly [LegalBlock, ...LegalBlock[]];
};

export type LegalDocument = {
  readonly description: string;
  readonly header: { readonly eyebrow: string; readonly title: string; readonly intro: string };
  /** When the text last changed, as an ISO date (YYYY-MM-DD). */
  readonly updated: `${number}-${number}-${number}`;
  readonly sections: readonly [LegalSection, ...LegalSection[]];
};
