import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { PARTNER_TEXT_LIMITS, textLength, type Partner, type PartnerLogo, type PartnerStory, type PartnerTier } from "./partners";

// The edit panel's fields (board 76b, issue #256) and the one check both the
// panel and the server run on them. The panel shows the counters and the
// first error under its field; the server refuses whatever the panel let
// through anyway, since a server action takes any input.

/** The fields as the panel sends them, every one a string. */
export const PARTNER_FIELDS = ["name", "tier", "website", "oneLiner", "about", "support"] as const;

export type PartnerFieldName = (typeof PARTNER_FIELDS)[number];

export type PartnerFields = Record<PartnerFieldName, string>;

/** The longest name the panel takes: a bound on the input, longer than any partner's name. */
export const PARTNER_NAME_MAX = 100;

/** A partner without its logo: what the fields hold. */
export type PartnerText = Omit<Partner, "logo">;

/** The fields a partner fills the panel with. */
export function fieldsOf(partner: Partner | null): PartnerFields {
  return {
    name: partner?.name ?? "",
    tier: partner?.tier ?? "main",
    website: partner?.website ?? "",
    oneLiner: partner?.oneLiner ?? "",
    about: partner?.story?.about ?? "",
    support: partner?.story?.support ?? "",
  };
}

export type PartnerFieldErrors = Partial<Record<PartnerFieldName, string>>;

function isTier(value: string): value is PartnerTier {
  return value === "main" || value === "media";
}

/** A full http(s) address, or why not. */
function websiteError(website: string): string | null {
  try {
    const url = new URL(website);
    if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".")) return null;
  } catch {
    // Not an address at all.
  }
  return "Enter the full address, starting with https://";
}

/** Every field that is wrong, by name; empty when the fields make a partner. */
export function partnerFieldErrors(fields: PartnerFields): PartnerFieldErrors {
  const errors: PartnerFieldErrors = {};
  const name = fields.name.trim();
  if (name === "") errors.name = "Enter the partner's name.";
  else if (textLength(name) > PARTNER_NAME_MAX) errors.name = `Keep the name under ${PARTNER_NAME_MAX} characters.`;
  if (!isTier(fields.tier)) errors.tier = "Pick Main or Media.";
  const website = fields.website.trim();
  if (website !== "") {
    const error = websiteError(website);
    if (error !== null) errors.website = error;
  }
  if (fields.oneLiner.trim() === "") errors.oneLiner = "Write one line on what they do for the Team.";
  for (const field of ["oneLiner", "about", "support"] as const) {
    const length = textLength(fields[field].trim());
    if (length > PARTNER_TEXT_LIMITS[field]) errors[field] = `${length} characters; the limit is ${PARTNER_TEXT_LIMITS[field]}.`;
  }
  return errors;
}

/** The fields as a partner's text, or the first error. Blank optional fields are absent keys. */
export function checkPartnerFields(fields: PartnerFields): WriteResult<PartnerText> {
  const errors = partnerFieldErrors(fields);
  const first = PARTNER_FIELDS.map((f) => errors[f]).find((e) => e !== undefined);
  if (first !== undefined) return refused(first);
  const about = fields.about.trim();
  const support = fields.support.trim();
  const story: PartnerStory = { ...(about && { about }), ...(support && { support }) };
  const website = fields.website.trim();
  return written({
    name: fields.name.trim(),
    tier: fields.tier as PartnerTier,
    oneLiner: fields.oneLiner.trim(),
    ...(website && { website }),
    ...(about || support ? { story } : {}),
  });
}

/** A website as the list row shows it (board 76): the host, without "www.". */
export function websiteLabel(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

/** The partner the panel saves: its text and its logo. */
export function withLogo(text: PartnerText, logo: PartnerLogo): Partner {
  return { name: text.name, logo, ...(text.website && { website: text.website }), tier: text.tier, oneLiner: text.oneLiner, ...(text.story && { story: text.story }) };
}
