// Site content with drafts (issue #256): every item an editor changes in the
// dashboard (a partner today; outreach, projects and FAQ next) keeps the
// version the public site shows and, beside it, an optional working draft.
// "Save draft" never reaches the public site; "Publish" does. Nothing here
// knows what an item holds, so every content type reuses it.

/**
 * One item's versions. An item that was never published holds only a draft;
 * a published one may also hold draft changes. An item with no version at
 * all cannot be written down.
 *
 * `D` is what the draft of a never-published item may be. A content type
 * whose new items are saved before they are whole (an Outreach post, board
 * 74f) names a looser type there; the others leave it `T`. Draft changes to
 * a published item are always a whole `T`, because Publish puts them on the
 * site as they are.
 */
export type Versioned<T extends D, D = T> =
  | { readonly state: "draft"; readonly draft: D }
  | { readonly state: "published"; readonly published: T; readonly draft: T | null };

/** What the editor's list and panel say about an item (boards 76 and 76b). */
export type ContentStatus = "draft" | "published" | "draft-changes";

export const CONTENT_STATUS_LABELS: Readonly<Record<ContentStatus, string>> = {
  draft: "Draft",
  published: "Published",
  "draft-changes": "Draft changes",
};

/** The two buttons at the foot of an edit panel. */
export type PublishStep = "save-draft" | "publish";

export function isPublishStep(value: unknown): value is PublishStep {
  return value === "save-draft" || value === "publish";
}

/** One stored item: its id, its place in the site order, and its versions. */
export type ContentItem<T extends D, D = T> = {
  readonly id: number;
  /** Lower comes first on the site. Only the order matters, not the numbers. */
  readonly siteOrder: number;
  readonly version: Versioned<T, D>;
};

export function statusOf<T extends D, D = T>(version: Versioned<T, D>): ContentStatus {
  if (version.state === "draft") return "draft";
  return version.draft === null ? "published" : "draft-changes";
}

/** What the public site shows: the published version, or nothing for an item never published. */
export function publicVersion<T extends D, D = T>(version: Versioned<T, D>): T | null {
  return version.state === "published" ? version.published : null;
}

/** `value` as JSON with every object's keys in order, so two reads of one content give one text. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * Whether two reads of an item's versions hold the same content: what a
 * store compares before a write, so a save made on a version another save
 * has since replaced is refused (issue #831).
 */
export function sameVersions<T extends D, D = T>(a: Versioned<T, D> | null, b: Versioned<T, D> | null): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/** The same versions with each one's content put through `f`. */
export function mapVersions<T>(version: Versioned<T>, f: (content: T) => T): Versioned<T> {
  return version.state === "draft"
    ? { state: "draft", draft: f(version.draft) }
    : { state: "published", published: f(version.published), draft: version.draft === null ? null : f(version.draft) };
}

/** What the edit panel opens on: the working draft when there is one, else the published version. */
export function editorVersion<T extends D, D = T>(version: Versioned<T, D>): D {
  return version.state === "draft" ? version.draft : (version.draft ?? version.published);
}

/**
 * The versions after one of the panel's two buttons. Save draft keeps what
 * the public site shows and puts `content` beside it; Publish makes `content`
 * the public version and drops the draft. A new item (`current` null) saved
 * as a draft is a draft only.
 */
export function afterStep<T extends D, D = T>(current: Versioned<T, D> | null, content: T, step: PublishStep): Versioned<T, D> {
  if (step === "publish") return { state: "published", published: content, draft: null };
  if (current === null || current.state === "draft") return { state: "draft", draft: content };
  return { state: "published", published: current.published, draft: content };
}

/**
 * The versions after Save draft with content that is not whole yet: the
 * draft of a new or never-published item. Null for a published item, whose
 * draft changes must be whole (`Versioned`).
 */
export function afterUnfinishedDraft<T extends D, D = T>(current: Versioned<T, D> | null, content: D): Versioned<T, D> | null {
  return current === null || current.state === "draft" ? { state: "draft", draft: content } : null;
}

/**
 * The versions after Unpublish (board 74's row menu, issue #289): the item
 * leaves the public site and stays as a draft of what the editor showed, its
 * draft changes when it had some, else what was published. Null for an item
 * that was never published, which has nothing to take down.
 */
export function unpublished<T extends D, D = T>(version: Versioned<T, D>): Versioned<T, D> | null {
  return version.state === "published" ? { state: "draft", draft: version.draft ?? version.published } : null;
}

/** The items the public site shows, in site order, as their published versions. */
export function publicItems<T extends D, D = T>(items: readonly ContentItem<T, D>[]): T[] {
  return [...items]
    .sort((a, b) => a.siteOrder - b.siteOrder)
    .flatMap((item) => {
      const shown = publicVersion(item.version);
      return shown === null ? [] : [shown];
    });
}

/** Which stored version a row holds: one row per version, as the database keeps them. */
export type VersionKind = "published" | "draft";

export const VERSION_KINDS = ["published", "draft"] as const satisfies readonly VersionKind[];

/** The rows an item's versions are stored as: one per version it holds. */
export function versionRows<T extends D, D = T>(version: Versioned<T, D>): { kind: VersionKind; content: D }[] {
  if (version.state === "draft") return [{ kind: "draft", content: version.draft }];
  const published = { kind: "published" as const, content: version.published };
  return version.draft === null ? [published] : [published, { kind: "draft", content: version.draft }];
}

/** An item's versions read back from its rows; null when it has none, which no write leaves behind. */
export function versionedFromRows<T>(rows: readonly { kind: VersionKind; content: T }[]): Versioned<T> | null {
  const published = rows.find((r) => r.kind === "published")?.content;
  const draft = rows.find((r) => r.kind === "draft")?.content;
  if (published !== undefined) return { state: "published", published, draft: draft ?? null };
  return draft === undefined ? null : { state: "draft", draft };
}
