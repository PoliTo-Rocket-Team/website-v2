import { textLength } from "@/lib/content/text";
import { GROUP_PHOTO, readShapeCrops, type GroupPhotoCrops } from "@/lib/photo-crops";
import type { DepartmentHead, DivisionLead, HeaderStats, Leader, PersonPhoto } from "./types";

// The Team page's visual layer (issue #283, ADR 0015): the intro text, the
// header's figures and the group photo an editor sets on the page, kept in
// each stored version beside its layout of page seats (./team-layout.ts,
// ADR 0019). It changes only what the page shows, never anyone's role,
// division, department or access. Its people fields, which epic #835 kept
// for one release, are gone since issue #855: the page's seats live in the
// layout alone. Pure: the database, the seed and the editor all read it the
// same way.

/** The arc holds up to eight leaders. */
export const ARC_LEADERS = 8;

/**
 * The group photo over the core members: a photo of the site's own in
 * public/team/, or one uploaded in the editor (issue #510). An upload may
 * carry `crops` (issue #971), its crop for each shape the box is shown at;
 * a photo without them, as every layer saved before, is shown centred.
 */
export type GroupPhoto = { readonly src: PersonPhoto; readonly alt: string; readonly crops?: GroupPhotoCrops };

/** The whole visual layer: the intro text, the figures and the group photo. */
export type TeamPageLayer = {
  /** The header's intro; null keeps the hand-typed one. */
  readonly intro: string | null;
  /**
   * The header's four figures under the intro (issue #510); absent keeps the
   * hand-typed ones. Absent rather than null, so a layer saved before the
   * figures were editable reads as one that left them alone.
   */
  readonly figures?: HeaderStats;
  /** The group photo over the core members; null keeps the hand-typed one. */
  readonly groupPhoto: GroupPhoto | null;
};

/** What the Team page editor edits of the layer (issue #851): all of it, the intro text, the figures and the group photo. */
export type TeamPageText = TeamPageLayer;

/** The layer's intro text, figures and group photo, with no key for figures it leaves alone. */
export function textOf(layer: TeamPageText): TeamPageText {
  return { intro: layer.intro, ...(layer.figures !== undefined && { figures: layer.figures }), groupPhoto: layer.groupPhoto };
}

export const NO_TEAM_LAYER: TeamPageLayer = { intro: null, groupPhoto: null };

/** Something on the page and where it came from, so the editor can find it. */
export type Shown<R, T> = { readonly at: R; readonly shown: T };

/**
 * How a department block draws its division leads on the carousel (issue
 * #856): under its head, as the technical departments drew them, or beside
 * it, each lead at a head's level, as Operations drew its divisions (board 26).
 */
export const LEADS_DRAWN = ["under", "beside"] as const;
export type LeadsDrawn = (typeof LEADS_DRAWN)[number];

/** A department block as drawn, whatever its places are keyed by. */
export type DrawnDepartment = {
  readonly leadsDrawn: LeadsDrawn;
  readonly heads: readonly { readonly shown: DepartmentHead }[];
  readonly leads: readonly { readonly shown: DivisionLead }[];
};

/** A department group as drawn (issue #856): the heading its slides read, and its blocks in order. */
export type DrawnGroup = { readonly name: string; readonly departments: readonly DrawnDepartment[] };

/** The page as drawn, whatever its places are keyed by (`DrawnDepartment`): the team leader, the arc, the department groups in order, and the layer. */
export type DrawnTeam = TeamPageLayer & {
  readonly leader: Leader | null;
  readonly leaders: readonly { readonly shown: Leader }[];
  readonly groups: readonly DrawnGroup[];
};

export const ARC_FULL = `The arc holds up to ${ARC_LEADERS} leaders.`;

// A layer read back from storage or sent by the browser: anything this code
// could not have written reads as not a layer.

/** The longest name, role, division or department name the page takes. */
export const TEAM_PAGE_TEXT_MAX = 120;
/** The longest intro the page takes. */
export const TEAM_PAGE_INTRO_MAX = 1000;
/** The longest figure value the header's row of four takes ("150+"). */
export const TEAM_PAGE_FIGURE_VALUE_MAX = 12;
/** The longest figure label, desktop or phone ("INTERNATIONAL"). */
export const TEAM_PAGE_FIGURE_LABEL_MAX = 24;

/**
 * Whether a remote photo URL is a photo the Team page editor uploaded to this
 * site's own public store, on that store's host (./team-page-photos.ts). Each
 * side that reads or writes a layer passes its own: a side with no store owns
 * none.
 */
export type OwnsUpload = (src: string) => boolean;

/** A side with no public store of its own (the seed, a preview's stand-in): it owns no upload. */
export const NO_UPLOADS: OwnsUpload = () => false;

type Check = (value: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText =
  (max: number): Check =>
  (value) =>
    typeof value === "string" && value.trim() !== "" && textLength(value) <= max;
/** A person's photo the page takes: one of the site's own in public/team/, or a remote https URL. */
export const isPagePhoto = (value: unknown): value is PersonPhoto =>
  typeof value === "string" && textLength(value) <= 2048 && (value.startsWith("/team/") || value.startsWith("https://"));
/** A LinkedIn handle the page takes: the part after linkedin.com/in/, with no slash, query or space. */
export const isLinkedinHandle = (value: unknown): value is string => typeof value === "string" && /^[^/?#\s]{1,100}$/.test(value);

/** Every key is one of `checks` and passes it; a key `required` names must be there. */
function hasShape(value: unknown, checks: Readonly<Record<string, Check>>, required: readonly string[] = []): boolean {
  if (!isRecord(value)) return false;
  return (
    required.every((key) => value[key] !== undefined) &&
    Object.entries(value).every(([key, field]) => Object.hasOwn(checks, key) && (field === undefined || checks[key](field)))
  );
}

/** A group photo: a photo of the site's own, or a Team page upload `ownsUpload` names; never any other remote URL. */
const isGroupPhoto =
  (ownsUpload: OwnsUpload): Check =>
  (value) =>
    // The description is optional (Owner decision, issue #430): an empty one draws the photo with alt="".
    hasShape(
      value,
      {
        src: (src) => typeof src === "string" && isPagePhoto(src) && (src.startsWith("/team/") || ownsUpload(src)),
        alt: (alt) => typeof alt === "string" && textLength(alt) <= 300,
        // Optional (issue #971): absent reads as centred, so a layer saved before it still reads.
        crops: (crops) => readShapeCrops(crops, GROUP_PHOTO) != null,
      },
      ["src", "alt"],
    );

const isFigureLabel: Check = (value) =>
  hasShape(value, { text: isText(TEAM_PAGE_FIGURE_LABEL_MAX), phone: isText(TEAM_PAGE_FIGURE_LABEL_MAX) }, ["text"]);
const isFigure: Check = (value) => hasShape(value, { value: isText(TEAM_PAGE_FIGURE_VALUE_MAX), label: isFigureLabel }, ["value", "label"]);
/** Always four figures: the header's row has no room to add one and none to leave empty. */
const isFigures: Check = (value) => Array.isArray(value) && value.length === 4 && value.every(isFigure);

/** The checks of the intro text, the figures and the group photo, one each. */
const textChecks = (ownsUpload: OwnsUpload): Readonly<Record<keyof TeamPageText, Check>> => ({
  intro: (v) => v === null || isText(TEAM_PAGE_INTRO_MAX)(v),
  figures: isFigures,
  groupPhoto: (v) => v === null || isGroupPhoto(ownsUpload)(v),
});

/** The intro text, figures and group photo as the editor sends them (issue #851): checked as a layer checks them. */
export function isTeamPageText(value: unknown, ownsUpload: OwnsUpload): value is TeamPageText {
  return hasShape(value, textChecks(ownsUpload), ["intro", "groupPhoto"]);
}

/**
 * A layer this code could have written: the intro text and the group photo
 * present, the figures present or absent, as layers saved before they existed
 * leave them, and nothing else. A group photo off the site's own photos must
 * be an upload `ownsUpload` names. The browser's text and the stored layer
 * are one shape (`TeamPageText`).
 */
export const isTeamPageLayer: (value: unknown, ownsUpload: OwnsUpload) => value is TeamPageLayer = isTeamPageText;
