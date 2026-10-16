// Site content with drafts (issue #256): every item an editor changes in the
// dashboard (a partner today; outreach, projects and FAQ next) keeps the
// version the public site shows and, beside it, an optional working draft.
// "Save draft" never reaches the public site; "Publish" does. Nothing here
// knows what an item holds, so every content type reuses it.

/**
 * One item's versions. An item that was never published holds only a draft;
 * a published one may also hold draft changes. An item with no version at
 * all cannot be written down.
 */
export type Versioned<T> =
  | { readonly state: "draft"; readonly draft: T }
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
export type ContentItem<T> = {
  readonly id: number;
  /** Lower comes first on the site. Only the order matters, not the numbers. */
  readonly siteOrder: number;
  readonly version: Versioned<T>;
};

export function statusOf<T>(version: Versioned<T>): ContentStatus {
  if (version.state === "draft") return "draft";
  return version.draft === null ? "published" : "draft-changes";
}

/** What the public site shows: the published version, or nothing for an item never published. */
export function publicVersion<T>(version: Versioned<T>): T | null {
  return version.state === "published" ? version.published : null;
}

/** What the edit panel opens on: the working draft when there is one, else the published version. */
export function editorVersion<T>(version: Versioned<T>): T {
  return version.state === "draft" ? version.draft : (version.draft ?? version.published);
}

/**
 * The versions after one of the panel's two buttons. Save draft keeps what
 * the public site shows and puts `content` beside it; Publish makes `content`
 * the public version and drops the draft. A new item (`current` null) saved
 * as a draft is a draft only.
 */
export function afterStep<T>(current: Versioned<T> | null, content: T, step: PublishStep): Versioned<T> {
  if (step === "publish") return { state: "published", published: content, draft: null };
  if (current === null || current.state === "draft") return { state: "draft", draft: content };
  return { state: "published", published: current.published, draft: content };
}

/** The items the public site shows, in site order, as their published versions. */
export function publicItems<T>(items: readonly ContentItem<T>[]): T[] {
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
export function versionRows<T>(version: Versioned<T>): { kind: VersionKind; content: T }[] {
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
