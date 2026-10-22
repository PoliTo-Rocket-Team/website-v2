import { contentEditor, type ContentStore } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import type { ContentItem, PublishStep } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { measureLogo } from "./logo-luminance";
import { checkPartnerFields, withLogo, type PartnerFields } from "./partners-fields";
import { logoKindOf, type Partner, type PartnerLogo, type PartnerTier } from "./partners";

// The Partners page's reads and writes (boards 76 and 76b, issue #256): the
// shared content editor (lib/content/editor.ts) with the partner's own
// fields and logo. Both sides of the dashboard data interface build it, each
// with its own store and its own place for logo files.

/** The largest logo file the panel takes. */
export const LOGO_MAX_BYTES = 1024 * 1024;

/**
 * A logo as measured on upload, before it is stored: what the partner keeps
 * (`logo`, its dark flag as measured) and whether the file sits on a solid box
 * instead of transparency, which the panel warns about but does not refuse
 * (issue #394).
 */
export type MeasuredLogo = { logo: Omit<PartnerLogo, "src">; solidBackground: boolean };

/** Where uploaded logo files go: the public Blob store, or nowhere on a preview. */
export interface LogoFiles {
  /** Stores the file and answers its `src`. */
  put(logo: Upload): Promise<string>;
}

/**
 * The upload measured with `measureLogo` (lib/logo-luminance.ts): its size,
 * its kind from its shape, whether it is too dark for the page, in which
 * case the site draws it white, and whether it sits on a solid box. Only an
 * 8-bit PNG can be measured, so only that is taken.
 */
export function measureUpload(logo: Upload): WriteResult<MeasuredLogo> {
  if (logo.contentType !== "image/png") return refused("The logo must be a PNG file.");
  if (logo.bytes.byteLength > LOGO_MAX_BYTES) return refused("The logo must be at most 1 MB.");
  try {
    const { width, height, dark, solidBackground } = measureLogo(logo.bytes);
    return written({ logo: { width, height, kind: logoKindOf(width, height), darkLogo: dark }, solidBackground });
  } catch (error) {
    return refused(`The logo could not be read: ${error instanceof Error ? error.message : "not a PNG file"}.`);
  }
}

export interface PartnerEditor {
  /** Every partner as the editor sees it, in site order; null for a viewer without site-content access. */
  list(): Promise<readonly ContentItem<Partner>[] | null>;
  /** The panel measures a picked logo before it is saved, so it can pre-set "draw it white" and warn of a solid box. */
  measure(logo: Upload): Promise<WriteResult<MeasuredLogo>>;
  /**
   * Save draft or Publish (`id` null: New partner). A new partner needs a logo; an edit keeps its logo unless one is sent.
   * `darkLogo` is the editor's choice to draw the logo white, kept over the measurement; left out, a sent logo keeps its
   * measured flag and a kept logo its stored one.
   */
  save(
    id: number | null,
    step: PublishStep,
    fields: PartnerFields,
    logo: Upload | null,
    darkLogo?: boolean,
  ): Promise<WriteResult<ContentItem<Partner>>>;
  remove(id: number): Promise<WriteResult<null>>;
  /** The order of one tier's partners, as dragged. */
  reorder(tier: PartnerTier, ids: readonly number[]): Promise<WriteResult<null>>;
}

export function partnerEditor(viewer: ViewerStanding, store: ContentStore<Partner>, files: LogoFiles): PartnerEditor {
  const editor = contentEditor(viewer, store);
  return {
    list: () => editor.list(),
    measure: async (logo) => (maySiteContent(viewer) ? measureUpload(logo) : refused(SITE_CONTENT_REFUSAL)),
    save: (id, step, fields, logo, darkLogo) =>
      editor.save(id, step, async (current) => {
        const text = checkPartnerFields(fields);
        if (!text.ok) return text;
        const chosen = (kept: PartnerLogo): PartnerLogo => (darkLogo === undefined ? kept : { ...kept, darkLogo });
        if (logo === null) return current === null ? refused("Add the partner's logo.") : written(withLogo(text.value, chosen(current.logo)));
        const measured = measureUpload(logo);
        if (!measured.ok) return measured;
        return written(withLogo(text.value, chosen({ src: await files.put(logo), ...measured.value.logo })));
      }),
    remove: (id) => editor.remove(id),
    reorder: (tier, ids) => editor.reorder((partner) => partner.tier === tier, ids),
  };
}
