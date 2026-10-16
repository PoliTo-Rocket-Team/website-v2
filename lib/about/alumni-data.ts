import "server-only";

import { readAlumni } from "@/lib/dashboard/database-alumni";
import { dummyAlumni } from "@/lib/dummy-data/alumni";
import { NO_EDITS } from "@/lib/dummy-data/edits";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { editedAlumniRecord } from "@/lib/dummy-data/team-pages";
import { alumniYears, foundersOf } from "./alumni-record";
import type { AlumniPageData } from "./alumni-types";

/**
 * What /about/alumni shows (issue #257), read from the environment alone so
 * the page prerenders: the database's cached record, which every fix and
 * every change to the team refreshes, or the dummy team in dummy mode
 * (lib/dummy-data/mode.ts), with no test developer's edits.
 */
export async function alumniPageData(): Promise<AlumniPageData> {
  const alumni = dummyDataOn() ? dummyAlumni(editedAlumniRecord(NO_EDITS)) : await readAlumni();
  return { founders: foundersOf(alumni), years: alumniYears(alumni) };
}
