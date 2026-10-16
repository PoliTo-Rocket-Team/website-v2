// The seed runner (issue #303, ADR 0015). The seed is a list of modules, one
// per area, run in registry order. In one transaction the runner first resets
// every module's own rows, last module first, then inserts every module's rows
// in order. A second run therefore starts from the same empty slots and
// leaves the same rows. It connects only to a target the guard approved.

import type { ApprovedSeedTarget } from "./target";

/** One area of the seed. `reset` removes only the rows this module owns. */
export type SeedModule<Tx> = {
  readonly name: string;
  reset(tx: Tx): Promise<void>;
  insert(tx: Tx): Promise<void>;
};

/** An open connection: one transaction, then close. */
export type SeedConnection<Tx> = {
  transaction(work: (tx: Tx) => Promise<void>): Promise<void>;
  close(): Promise<void>;
};

export type SeedReport = {
  readonly target: ApprovedSeedTarget;
  readonly modules: readonly string[];
};

/** Throws when two modules share a name, before any connection opens. */
export function assertUniqueNames(modules: readonly SeedModule<unknown>[]): void {
  const seen = new Set<string>();
  for (const { name } of modules) {
    if (seen.has(name)) throw new Error(`seed module "${name}" is registered twice`);
    seen.add(name);
  }
}

export async function runSeed<Tx>(
  target: ApprovedSeedTarget,
  modules: readonly SeedModule<Tx>[],
  connect: (connectionString: string) => SeedConnection<Tx>,
): Promise<SeedReport> {
  assertUniqueNames(modules);
  const connection = connect(target.connectionString);
  try {
    await connection.transaction(async (tx) => {
      for (const module of [...modules].reverse()) await module.reset(tx);
      for (const module of modules) await module.insert(tx);
    });
  } finally {
    await connection.close();
  }
  return { target, modules: modules.map((module) => module.name) };
}
