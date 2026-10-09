import type { Applicant } from "@/app/actions/get-applicant";
import type { ApplyPosition } from "@/db/types";
import type { PrivatePathname } from "@/lib/storage/pathname";
import type { Recruitment } from "./positions";
import type { NewApplication, SubmitDeps } from "./submit";

/**
 * The one way the apply pages and their submit read and write data (issue
 * #150), in the shape of the dashboard's (lib/dashboard/data.ts). The
 * database side is ./database.ts, the dummy side is lib/dummy-data/apply.ts,
 * and ./pick.ts picks one per request.
 */
export interface ApplyData {
  /** The positions /apply lists: public ones only. */
  publicPositions(): Promise<ApplyPosition[]>;
  /** One position, deleted or not, with the recruitment switch, read fresh; null when no position has the id. */
  position(id: number): Promise<{ position: ApplyPosition; recruitment: Recruitment } | null>;
  /** The signed-in applicant, or null when nobody is signed in. */
  applicant(): Promise<Applicant | null>;
  hasApplied(userId: string, positionId: number): Promise<boolean>;
  /** Where a sent application's files and rows go. */
  readonly store: ApplicationStore;
}

export type ApplicationStore = {
  putPdf(key: PrivatePathname, bytes: Uint8Array): Promise<void>;
  deletePdf(key: PrivatePathname): Promise<void>;
  /** Writes the profile, the file rows and the application in one go. */
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
