"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { Scope } from "./types";
import { Prettify } from "@/lib/utils";
import { auth } from "@/auth";

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
 * @param target - Optional target to get processed scope info (e.g., 'positions', 'members', 'applications', )
 * @returns Array of scope permissions OR processed scope info object when target is provided
 */
export async function getMemberScopes(
  target?: string
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

  // If no target specified, return raw scopes array
  if (!target) {
    return { scope: scopesData };
  }

  // Generic scope processing for any target that needs processed info
  /**
   * PERFORMANCE OPTIMIZATION: Single pass through scopes to extract all needed information
   *
   * This reduces complexity from O(6n) to O(n) by processing each scope only once
   * and building all required data structures simultaneously.
   *
   * Extracts:
   * - Access permissions (who can VIEW positions)
   * - Edit permissions (who can EDIT positions)
   * - Department/Division IDs (for database filtering)
   * - Editable Department/Division IDs (for permission checking)
   */
  const scopeInfo = scopesData.reduce(
    (acc, scope) => {
      // Only process scopes that apply to the specified target (or all targets)
      const isTargetMatch = scope.target === "all" || scope.target === target;
      if (!isTargetMatch) return acc;

      // PERMISSION HIERARCHY: admin > org > department > division
      if (scope.scope === "admin") {
        // Admin scope: Technical/system-wide access
        acc.hasAdminAccess = true;
        if (scope.access_level === "edit") acc.hasAdminEdit = true;
      } else if (scope.scope === "org") {
        // Org scope: Organization-wide access
        acc.hasOrgAccess = true;
        if (scope.access_level === "edit") acc.hasOrgEdit = true;
      } else if (scope.scope === "department" && scope.dept_id !== null) {
        // Department scope: Access to specific department and all its divisions
        acc.departmentIds.add(scope.dept_id);
        if (scope.access_level === "edit")
          acc.editableDepartmentIds.add(scope.dept_id);
      } else if (scope.scope === "division" && scope.division_id !== null) {
        // Division scope: Access to specific division only
        acc.divisionIds.add(scope.division_id);
        if (scope.access_level === "edit")
          acc.editableDivisionIds.add(scope.division_id);
      }
      //! todo website scope needs to be added in future
      //! future scope types can be added here

      return acc;
    },
    {
      // Access permissions (for database filtering)
      hasAdminAccess: false,
      hasOrgAccess: false,
      // Edit permissions (for UI state)
      hasAdminEdit: false,
      hasOrgEdit: false,
      // Sets for O(1) lookup performance and automatic deduplication
      departmentIds: new Set<number>(),
      divisionIds: new Set<number>(),
      editableDepartmentIds: new Set<number>(),
      editableDivisionIds: new Set<number>(),
    }
  );

  return { scope: scopeInfo };
}

/**
 * Get divisions that the current user can edit
 * @returns Array of divisions the user has edit access to
 */
export async function getEditableDivisions() {
  //! todo needs to be optimized with caching

  // Use generic scope processing for members target
  const { scope: scopeInfo } = (await getMemberScopes("members")) as {
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
