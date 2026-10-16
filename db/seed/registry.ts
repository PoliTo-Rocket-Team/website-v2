// Every seed module, in the order the runner inserts them (and resets them in
// reverse). An area slice adds its module with one line here and its cases in
// docs/seed-cases.md. `audit` stays last: it clears the audit rows every
// module before it wrote.

import type { SeedModule } from "@/lib/seed/runner";
import { access } from "./access";
import { alumni } from "./alumni";
import { audit } from "./audit";
import { baseline } from "./baseline";
import { people } from "./people";
import { structure } from "./structure";
import type { SeedTx } from "./tx";

export const SEED_MODULES: readonly SeedModule<SeedTx>[] = [structure, people, alumni, access, baseline, audit];
