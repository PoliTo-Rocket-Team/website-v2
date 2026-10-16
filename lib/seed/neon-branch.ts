// Reads the branch behind a Neon endpoint through the Neon API, for the seed
// guard in ./target.ts. It needs NEON_API_KEY and NEON_PROJECT_ID; without
// them, or on any failed read, it answers undefined and the guard refuses.

import type { NeonBranchFacts, NeonBranchLookup } from "./target";

const NEON_API = "https://console.neon.tech/api/v2";

export type NeonApiEnv = {
  readonly NEON_API_KEY?: string;
  readonly NEON_PROJECT_ID?: string;
};

type Fetch = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

export function neonBranchLookup(env: NeonApiEnv, fetchJson: Fetch = fetch): NeonBranchLookup {
  return async (endpointId) => {
    const { NEON_API_KEY: key, NEON_PROJECT_ID: project } = env;
    if (!key || !project) return undefined;
    const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
    const get = async (path: string) => {
      const response = await fetchJson(`${NEON_API}/projects/${encodeURIComponent(project)}${path}`, { headers });
      return response.ok ? response.json() : undefined;
    };

    const branchId = field(field(await get(`/endpoints/${encodeURIComponent(endpointId)}`), "endpoint"), "branch_id");
    if (typeof branchId !== "string") return undefined;
    const branch = field(await get(`/branches/${encodeURIComponent(branchId)}`), "branch");
    const name = field(branch, "name");
    // `primary` is the older name of `default`; either one marks production.
    const isDefault = field(branch, "default") === true || field(branch, "primary") === true;
    const isProtected = field(branch, "protected") === true;
    if (typeof name !== "string") return undefined;
    return { name, isDefault, isProtected } satisfies NeonBranchFacts;
  };
}
