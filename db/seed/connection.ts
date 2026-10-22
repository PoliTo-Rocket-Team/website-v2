// The seed's one connection: the postgres-js driver, one transaction, then
// close. `pnpm db:seed` (../seed.ts) and the preview build (../preview-build.ts)
// both open it, only on a target the guard approved.

import postgres, { type Sql } from "postgres";
import type { SeedConnection } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

// The seed builds its parameters with drizzle (./rows.ts), which has already
// mapped each value to what the driver sends: JSON text for json and jsonb, a
// string for dates and times. A bare postgres-js client would map them a
// second time, so a jsonb array would be stored as a JSON string holding that
// array. Drizzle's own postgres-js driver turns those serializers off for
// these types; the seed's client does the same, so a seeded row is stored
// exactly as the app would store it.
const DRIZZLE_MAPPED_TYPES = [
  114, // json
  3802, // jsonb
  1082, // date
  1083, // time
  1114, // timestamp
  1115, // timestamp[]
  1182, // date[]
  1184, // timestamptz
  1185, // timestamptz[]
  1231, // numeric[]
] as const;

/** A postgres-js client that sends drizzle-mapped values as they are. */
export function seedClient(connectionString: string): Sql {
  const client = postgres(connectionString, { max: 1 });
  for (const type of DRIZZLE_MAPPED_TYPES) client.options.serializers[type] = (value: unknown) => value;
  return client;
}

export function seedConnection(connectionString: string): SeedConnection<SeedTx> {
  const client = seedClient(connectionString);
  return {
    async transaction(work) {
      await client.begin(work);
    },
    close: () => client.end(),
  };
}
