import "server-only";

import { readAlumni } from "@/lib/dashboard/database-alumni";
import { DUMMY_NEWEST_FINISHED_YEAR, dummyAlumni } from "@/lib/dummy-data/alumni";
import { NO_EDITS } from "@/lib/dummy-data/edits";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { editedAlumniRecord } from "@/lib/dummy-data/team-pages";
import { newestFinishedAcademicYearStart } from "./academic-year";
import { alumniYears, foundersOf } from "./alumni-record";
import type { AlumniPageData } from "./alumni-types";

/**
 * What /about/alumni shows (issue #257), read from the environment alone so
 * the page prerenders: the database's cached record, which every fix and
 * every change to the team refreshes, or the dummy team in dummy mode
 * (lib/dummy-data/mode.ts), with no test developer's edits. The years end at
 * the newest finished one (#391): today's on the database side, read through
 * a cache that turns over each day, and the dummy clock's in dummy mode.
 */
export async function alumniPageData(): Promise<AlumniPageData> {
  const [alumni, newestFinished] = dummyDataOn()
    ? [dummyAlumni(editedAlumniRecord(NO_EDITS)), DUMMY_NEWEST_FINISHED_YEAR]
    : await Promise.all([readAlumni(), newestFinishedAcademicYearStart()]);
  return { founders: foundersOf(alumni), years: alumniYears(alumni, newestFinished) };
}
