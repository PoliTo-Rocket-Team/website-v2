// Every seed module, in the order the runner inserts them (and resets them in
// reverse). An area slice adds its module with one line here and its cases in
// docs/seed-cases.md.

import type { SeedModule } from "@/lib/seed/runner";
import { baseline } from "./baseline";
import type { SeedTx } from "./tx";

export const SEED_MODULES: readonly SeedModule<SeedTx>[] = [baseline];
