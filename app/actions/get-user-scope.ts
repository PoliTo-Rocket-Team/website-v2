"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { Scope } from "./types";
import { Prettify } from "@/lib/utils";
import { auth } from "@/auth";

import { SCOPE_RANK, TARGET_MIN_REQUIREMENTS } from "@/lib/permission.config";

export type ScopeInfo = {
  hasAdminAccess: boolean;
  hasOrgAccess: boolean;
  hasAdminEdit: boolean;
  hasOrgEdit: boolean;
  departmentIds: Set<number>;
  divisionIds: Set<number>;
  editableDepartmentIds: Set<number>;
  editableDivisionIds: Set<number>;
};

/**
 * Fetch scopes for a given member from Supabase
 * @param targetResource - Optional targetResource to get processed scope info (e.g., 'positions', 'members', 'applications', )
 * @returns Array of scope permissions OR processed scope info object when targetResource is provided
 */
export async function getUserScope(
  targetResource?: string
): Promise<{ scope: Prettify<Scope[] | ScopeInfo> }> {
  //! todo cache needs to implemented

  const session = await auth();
  if (!session?.userId) {
    return { scope: [] };
  }

  const supabase = await createSupabaseClient();
  //! todo remove debug log
  console.log("database request on get scopes");

  const { data: scopes, error } = await supabase
    .from("scopes")
    .select("*")
    .eq("user_id", session.userId);

  if (error) {
    console.error("Error fetching scopes:", error);
    return { scope: [] };
  }

  const scopesData = scopes || [];

  //! todo consider whether or not returning raw scope necessary
  // If no target specified, return raw scopes array
  if (!targetResource) {
    return { scope: scopesData };
  }

  // Generic scope processing for any target that needs processed info
  /**
   * PERFORMANCE OPTIMIZATION: Single pass through scopes to extract all needed information
   *
   * Extracts:
   * - Access permissions (who can VIEW positions)
   * - Edit permissions (who can EDIT positions)
   * - Department/Division IDs (for database filtering)
   * - Editable Department/Division IDs (for permission checking)
   */
  const scopeInfo = scopesData.reduce(
    (acc, scopeEntry) => {
      // -----------------------------------------------------------
      // CHECK 1: SECURITY LEVEL
      // -----------------------------------------------------------
      
      // Get the Ranks from our Config file
      const userRank = SCOPE_RANK[scopeEntry.scope as keyof typeof SCOPE_RANK];
      console.log('userRank', {userRank});
      
      // Determine required rank for this specific target
      const requiredScopeName = TARGET_MIN_REQUIREMENTS[targetResource] || TARGET_MIN_REQUIREMENTS['default'];
      console.log("requiredScope name", {requiredScopeName});
      const requiredRank = SCOPE_RANK[requiredScopeName];
      console.log('requiredRank', {requiredRank});

      // THE GUARD: Logic Storage enforces the rule here
      // Example: User is 'org' (Rank 3). Target is 'logs' (Requires Rank 4).
      // 3 < 4, so we RETURN immediately (Permission Denied).
      if (userRank < requiredRank) {
        return acc; 
      }

      // -----------------------------------------------------------
      // CHECK 2: TARGET MATCH
      // -----------------------------------------------------------
      const isTargetMatch = scopeEntry.target === 'all' || scopeEntry.target === targetResource;
      if (!isTargetMatch) return acc;

      // -----------------------------------------------------------
      // CHECK 3: POPULATE PERMISSIONS
      // -----------------------------------------------------------
      
      if (scopeEntry.scope === 'admin') {
        acc.hasAdminAccess = true;
        if (scopeEntry.access_level === 'edit') acc.hasAdminEdit = true;
      } 
      else if (scopeEntry.scope === 'org') {
        acc.hasOrgAccess = true;
        if (scopeEntry.access_level === 'edit') acc.hasOrgEdit = true;
      } 
      else if (scopeEntry.scope === 'department' && scopeEntry.dept_id) {
        acc.departmentIds.add(scopeEntry.dept_id);
        if (scopeEntry.access_level === 'edit') acc.editableDepartmentIds.add(scopeEntry.dept_id);
      } 
      else if (scopeEntry.scope === 'division' && scopeEntry.division_id) {
        acc.divisionIds.add(scopeEntry.division_id);
        if (scopeEntry.access_level === 'edit') acc.editableDivisionIds.add(scopeEntry.division_id);
      }
      //! 'core_member' usually doesn't need specific ID tracking since it's global,
      //! but if there is a logic for it, add it here.

      return acc;
    },
    {
      hasAdminAccess: false,
      hasOrgAccess: false,
      hasAdminEdit: false,
      hasOrgEdit: false,
      departmentIds: new Set<number>(),
      divisionIds: new Set<number>(),
      editableDepartmentIds: new Set<number>(),
      editableDivisionIds: new Set<number>(),
    }
  );

  return { scope: scopeInfo };
}


//! todo divisions list for positions selector,  it may be needed a refactor in the future
/**
 * Get divisions that the current user can edit
 * @returns Array of divisions the user has edit access to
 */
export async function getEditableDivisions() {
  //! todo needs to be optimized with caching

  // Use generic scope processing for members target
  const { scope: scopeInfo } = (await getUserScope("members")) as {
    scope: ScopeInfo;
  };

  // If scopeInfo is empty array (no authentication or no scopes), return empty array
  if (Array.isArray(scopeInfo) && scopeInfo.length === 0) {
    return [];
  }

  const supabase = await createSupabaseClient();
  //! todo remove debug log
  console.log("database request on get editable divisions");

  //! todo needs to be optimized with caching
  //! todo future enhancement: use all divisions from cached org structure if available
  // Get all active divisions
  const { data: allDivisions, error } = await supabase
    .from("divisions")
    .select(
      `
      id,
      name,
      code,
      dept_id,
      departments(
        id,
        name,
        code
      )
    `
    )
    .is("closed_at", null)
    .order("id");

  if (error) {
    console.error("Error fetching divisions:", error);
    return [];
  }

  if (!allDivisions) {
    return [];
  }

  // Use processed scope info instead of manual filtering
  if (scopeInfo.hasAdminAccess || scopeInfo.hasOrgEdit) {
    return allDivisions;
  }

  // Filter divisions based on processed scope info
  const divisionIdsArray = Array.from(scopeInfo.editableDivisionIds);
  const departmentIdsArray = Array.from(scopeInfo.editableDepartmentIds);

  const editableDivisions = allDivisions.filter(division => {
    // Check if user has direct division access
    if (divisionIdsArray.includes(division.id)) {
      return true;
    }

    // Check if user has department access
    if (division.dept_id && departmentIdsArray.includes(division.dept_id)) {
      return true;
    }

    return false;
  });

  return editableDivisions;
}
