// The seed's one connection: the postgres-js driver, one transaction, then
// close. `pnpm db:seed` (../seed.ts) and the preview build (../preview-build.ts)
// both open it, only on a target the guard approved.

import postgres from "postgres";
import type { SeedConnection } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

export function seedConnection(connectionString: string): SeedConnection<SeedTx> {
  const client = postgres(connectionString, { max: 1 });
  return {
    async transaction(work) {
      await client.begin(work);
    },
    close: () => client.end(),
  };
}
