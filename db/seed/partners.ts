// The partners seed (issue #305): the partners on /partners, the home logo
// strip and the dashboard's Partners editor (issue #256, boards 76 and 76b).
// It starts from the partners the import migration carries in
// (lib/partners-import.ts), main and media, Magicar with no website and
// Astrospace and BETA CAE with dark logos among them. EvoMisure holds draft
// changes, as board 76 draws it, and one new partner is a draft that was
// never published, so the public pages do not show it.

import { partners, partnerVersions } from "@/db/schema";
import type { ContentItem } from "@/lib/content/versioned";
import { logoKindOf, type Partner } from "@/lib/partners";
import { importedPartners } from "@/lib/partners-import";
import { partnerColumns } from "@/lib/partners-rows";
import { contentVersionRows } from "./content";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-09-12 10:00:00+00";
const PUBLISHED = "2026-09-12 10:00:00+00";
const DRAFTED = "2026-10-09 14:00:00+00";

/** EvoMisure: published, with a draft of a new one-liner (board 76). */
export const DRAFT_CHANGES_PARTNER = 3;

/** A partner an editor added and saved as a draft, never published. */
export const DRAFT_ONLY_PARTNER = 14;

/**
 * The draft partner's logo: the seed uploads no file, so it borrows the
 * Team's own mark from public/brand/ as a stand-in an editor would replace.
 */
const STAND_IN_LOGO = { src: "/brand/prt-mark-white.svg", width: 444, height: 220 } as const;

const DRAFT_ONLY: Partner = {
  name: "Orbita Composites",
  logo: { ...STAND_IN_LOGO, kind: logoKindOf(STAND_IN_LOGO.width, STAND_IN_LOGO.height), darkLogo: false },
  website: "https://orbita-composites.example.com/",
  tier: "main",
  oneLiner: "Carbon fibre layups for the next airframe.",
};

export const PARTNER_ITEMS: readonly ContentItem<Partner>[] = [
  ...importedPartners().map((item): ContentItem<Partner> => {
    if (item.id !== DRAFT_CHANGES_PARTNER || item.version.state !== "published") return item;
    const published = item.version.published;
    const draft = { ...published, oneLiner: "Test and measurement instruments for our engine tests." };
    return { ...item, version: { state: "published", published, draft } };
  }),
  { id: DRAFT_ONLY_PARTNER, siteOrder: DRAFT_ONLY_PARTNER, version: { state: "draft", draft: DRAFT_ONLY } },
];

export const PARTNER_ROWS = rowsOf(
  partners,
  PARTNER_ITEMS.map(({ id, siteOrder }) => ({ id, siteOrder, createdAt: CREATED })),
);

export const PARTNER_VERSION_ROWS = rowsOf(
  partnerVersions,
  contentVersionRows(PARTNER_ITEMS).map(({ itemId, kind, content }) => ({
    partnerId: itemId,
    version: kind,
    ...partnerColumns(content),
    updatedAt: kind === "published" ? PUBLISHED : DRAFTED,
  })),
);

export const partnersSeed = tableSeedModule({
  name: "partners",
  owns: [partners, partnerVersions],
  rows: [PARTNER_ROWS, PARTNER_VERSION_ROWS],
});
