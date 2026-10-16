import type { Partner, PartnerLogo, PartnerTier } from "./partners";

// A partner version as its `partner_versions` row holds it (db/schema,
// issue #256), and back. The database side and the import migration both
// write rows through this one mapping, so a partner reads back the same.

export type PartnerColumns = {
  name: string;
  tier: PartnerTier;
  logoUrl: string;
  logoWidth: number;
  logoHeight: number;
  logoKind: PartnerLogo["kind"];
  logoDark: boolean;
  website: string | null;
  oneLiner: string;
  about: string | null;
  support: string | null;
};

export function partnerColumns(partner: Partner): PartnerColumns {
  return {
    name: partner.name,
    tier: partner.tier,
    logoUrl: partner.logo.src,
    logoWidth: partner.logo.width,
    logoHeight: partner.logo.height,
    logoKind: partner.logo.kind,
    logoDark: partner.logo.darkLogo,
    website: partner.website ?? null,
    oneLiner: partner.oneLiner,
    about: partner.story?.about ?? null,
    support: partner.story?.support ?? null,
  };
}

export function partnerFromColumns(row: PartnerColumns): Partner {
  const story = { ...(row.about !== null && { about: row.about }), ...(row.support !== null && { support: row.support }) };
  return {
    name: row.name,
    logo: { src: row.logoUrl, width: row.logoWidth, height: row.logoHeight, kind: row.logoKind, darkLogo: row.logoDark },
    ...(row.website !== null && { website: row.website }),
    tier: row.tier,
    oneLiner: row.oneLiner,
    ...(row.about !== null || row.support !== null ? { story } : {}),
  };
}
