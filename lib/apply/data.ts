import type { Applicant } from "@/app/actions/get-applicant";
import type { ApplyPosition } from "@/db/types";
import type { PrivatePathname } from "@/lib/storage/pathname";
import type { PreviousFiles } from "./application-form";
import type { Faq } from "./page";
import type { Recruitment } from "./positions";
import type { NewApplication, OwnFile, SubmitDeps } from "./submit";

/**
 * The one way the apply pages and their submit read and write data (issue
 * #150), in the shape of the dashboard's (lib/dashboard/data.ts). The
 * database side is ./database.ts, which every apply page reads (issue #609).
 */
export interface ApplyData {
  /** The positions /apply lists: public ones only. */
  publicPositions(): Promise<ApplyPosition[]>;
  /** The questions at the bottom of /apply: the published ones, in site order (issue #258). */
  faqs(): Promise<readonly Faq[]>;
  /** One position, deleted or not, with the recruitment switch, read fresh for the submit; null when no position has the id. */
  position(id: number): Promise<{ position: ApplyPosition; recruitment: Recruitment } | null>;
  /**
   * The same read for the position page (issue #395): on the database side
   * cached under the tag position edits and the recruitment switch refresh.
   */
  shownPosition(id: number): Promise<{ position: ApplyPosition; recruitment: Recruitment } | null>;
  /** The signed-in applicant, or null when nobody is signed in. */
  applicant(): Promise<Applicant | null>;
  hasApplied(userId: string, positionId: number): Promise<boolean>;
  /** The latest CV and motivation letter the user stored, which the form offers again (issue #826); only their own. */
  previousFiles(userId: string): Promise<PreviousFiles>;
  /** Where a sent application's files and rows go. */
  readonly store: ApplicationStore;
}

export type ApplicationStore = {
  /** The user's own stored file with this id; null when there is none, or it is another user's. */
  ownFile(userId: string, fileId: number): Promise<OwnFile | null>;
  /** The user's own stored file with these bytes, by their hash and size; null when they stored none. */
  ownFileWithContent(userId: string, hash: string, size: number): Promise<OwnFile | null>;
  putPdf(key: PrivatePathname, bytes: Uint8Array): Promise<void>;
  deletePdf(key: PrivatePathname): Promise<void>;
  /** Writes the profile, the new file rows and the application in one go. */
  save(application: NewApplication): Promise<"saved" | "already-applied">;
  newFileName(): string;
};

/** What the submit (./submit.ts) needs, read from one side of the interface. */
export function submitDepsOf(data: ApplyData): SubmitDeps {
  return {
    applicant: () => data.applicant(),
    position: async (id) => {
      const read = await data.position(id);
      if (read === null) return null;
      const { position, recruitment } = read;
      return {
        position: {
          id: position.id,
          status: position.status,
          is_deleted: position.is_deleted,
          customQuestions: position.custom_questions ?? [],
          requiresMotivationLetter: position.requires_motivation_letter,
        },
        recruitment,
      };
    },
    hasApplied: (userId, positionId) => data.hasApplied(userId, positionId),
    ...data.store,
  };
}
