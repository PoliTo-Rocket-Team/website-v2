// 1. Define the numeric Rank for each Scope (Higher = More Power)
export const SCOPE_RANK = {
  admin: 4,
  org: 3,
  department: 2,
  division: 1,
  core_member: 0,
} as const;

// 2. Define the Minimum Scope Rank required to view a Target
// If a target isn't listed here, it falls back to 'default'
export const TARGET_MIN_REQUIREMENTS: Record<string, keyof typeof SCOPE_RANK> =
  {
    // --- SYSTEM LEVEL (Restricted) ---
    logs: "admin", // Only Admin can see Logs

    // --- OPERATIONAL LEVEL (Dept/Div Managers) ---
    positions: "division", // Div admin and up can see positions
    applications: "division", // Div admin and up can see applications
    members: "division", // Div admin and up can see members
    orders: "division",

    // --- PUBLIC/BASE LEVEL ---
    faq: "core_member", // Core members and up can see FAQ management
    default: "core_member", // Default for unknown targets
  };
