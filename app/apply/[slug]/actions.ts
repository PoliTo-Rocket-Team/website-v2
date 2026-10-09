"use server";

import { openApplyData } from "@/lib/apply/open";
import { submitDepsOf } from "@/lib/apply/data";
import { submitApplication, type SubmitResult } from "@/lib/apply/submit";

/**
 * Sends an application for one position. Every rule is checked here, on the
 * server (lib/apply/submit.ts); where it lands is the request's data side
 * (lib/apply/pick.ts): the database and the private file store, or memory
 * in dummy mode.
 */
export async function sendApplication(positionId: number, form: FormData): Promise<SubmitResult> {
  return submitApplication(positionId, form, submitDepsOf(await openApplyData()));
}
