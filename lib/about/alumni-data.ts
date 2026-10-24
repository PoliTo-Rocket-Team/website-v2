import "server-only";

import { readAlumni } from "@/lib/dashboard/database-alumni";
import { newestFinishedAcademicYearStart } from "./academic-year";
import { alumniYears, foundersOf } from "./alumni-record";
import type { AlumniPageData } from "./alumni-types";

/**
 * What /about/alumni shows (issue #257), read from the environment alone so
 * the page prerenders: the database's cached record, which every fix and
 * every change to the team refreshes. The years end at the newest finished
 * one (#391): today's, read through a cache that turns over each day.
 */
export async function alumniPageData(): Promise<AlumniPageData> {
  const [alumni, newestFinished] = await Promise.all([readAlumni(), newestFinishedAcademicYearStart()]);
  return { founders: foundersOf(alumni), years: alumniYears(alumni, newestFinished) };
}
