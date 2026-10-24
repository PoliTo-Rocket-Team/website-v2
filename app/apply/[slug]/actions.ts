"use server";

import { submitDepsOf } from "@/lib/apply/data";
import { databaseApplyData } from "@/lib/apply/database";
import { submitApplication, type SubmitResult } from "@/lib/apply/submit";

/**
 * Sends an application for one position. Every rule is checked here, on the
 * server (lib/apply/submit.ts); it lands in the database and the private
 * file store.
 */
export async function sendApplication(positionId: number, form: FormData): Promise<SubmitResult> {
  return submitApplication(positionId, form, submitDepsOf(databaseApplyData));
}
