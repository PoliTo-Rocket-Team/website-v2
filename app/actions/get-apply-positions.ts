"use server";

/**
 * POSITION DATA ACCESS LAYER
 *
 * This module provides secure, efficient access to apply_positions data with:
 *
 * 1. **Database-Level Security**: Permissions enforced at query level, not application level
 * 2. **Performance Optimization**: Single-pass scope processing, Set-based lookups
 * 3. **Permission Hierarchy**: admin > org > department > division
 * 4. **Scope-Based Filtering**: Users only see positions they have access to
 *
 * FUNCTIONS:
 * - getPositionsByMemberScope(): Authenticated users with permission filtering
 * - getPublicPositions(): Public access for application forms (active positions only)
 */

import { createSupabaseClient } from "@/utils/supabase/client";
import { ApplyPosition } from "./types";
import { getUserScope, type ScopeInfo } from "./get-user-scope";

/**
 * Get positions filtered by user's scope with database-level filtering
 */
export async function getPositionsByMemberScope(): Promise<{
  //! todo needs to be optimized with caching
  positions: ApplyPosition[];
}> {
  // Get user's scope information filtered for positions target
  const { scope: scopeInfo } = (await getUserScope("positions")) as {
    scope: ScopeInfo;
  };

  //! todo handle no access in a better way
  // If scopeInfo is empty array (no authentication or no scopes), return NO_ACCESS
  if (Array.isArray(scopeInfo) && scopeInfo.length === 0) {
    return { positions: [] };
  }

  const supabase = await createSupabaseClient();
  //! todo remove debug log
  console.log("database request on get positions");

  /**
   * Base query selects positions with joined division and department data.
   * Filters out deleted positions (is_deleted = false) and closed divisions/departments.
   */
  let query = supabase
    .from("apply_positions")
    .select(
      `
      *,
      divisions!inner(
        id, name, code, dept_id,
        departments!inner(id, name, code)
      )
    `
    )
    .eq("is_deleted", false)
    .is("divisions.closed_at", null)
    .is("divisions.departments.closed_at", null);

  /**
   * Database filtering based on user permissions:
   * - Admin/Org access: No additional filtering
   * - Department access: Filter by divisions.dept_id
   * - Division access: Filter by division_id
   * - Combined access: OR condition with both filters
   * - No access: Return empty array
   */
  if (scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess) {
    // Admin or org access - no additional filtering needed
  } else if (
    scopeInfo.departmentIds.size > 0 ||
    scopeInfo.divisionIds.size > 0
  ) {
    // Convert Sets to arrays for Supabase query methods
    const departmentIdsArray = Array.from(scopeInfo.departmentIds);
    const divisionIdsArray = Array.from(scopeInfo.divisionIds);

    if (departmentIdsArray.length > 0 && divisionIdsArray.length > 0) {
      // Applies OR condition for both division and department filtering
      query = query.or(
        `division_id.in.(${divisionIdsArray.join(",")}),divisions.dept_id.in.(${departmentIdsArray.join(",")})`
      );
    } else if (divisionIdsArray.length > 0) {
      // Filters by division_id using IN clause
      query = query.in("division_id", divisionIdsArray);
    } else if (departmentIdsArray.length > 0) {
      // Filters by department ID through divisions relationship
      query = query.in("divisions.dept_id", departmentIdsArray);
    }
  } else {
    /**
     * NO ACCESS: User has no permissions for any departments or divisions
     *
     * Early exit to avoid unnecessary database query.
     * More efficient than querying and getting zero results.
     */
    return { positions: [] };
  }

  const { data: positions, error } = await query
    .order("divisions(dept_id)", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Error getting positions by scope:", error);
    return { positions: [] };
  }

  if (!positions) {
    return { positions: [] };
  }

  /**
   * POSITION TRANSFORMATION & EDIT PERMISSION CALCULATION
   *
   * For each position returned from the database, we:
   * 1. Transform the raw database structure to our ApplyPosition type
   * 2. Calculate edit permissions using our pre-computed scope information
   *
   * PERFORMANCE: Edit permissions use O(1) Set lookups instead of O(n) array searches
   */
  const transformedPositions: ApplyPosition[] = positions.map(position => {
    const divisionId = position.division_id;
    const deptId = position.divisions?.dept_id;

    /**
     * EDIT PERMISSION HIERARCHY:
     * 1. Admin edit scope (highest - can edit anything)
     * 2. Org edit scope (can edit organization-wide)
     * 3. Specific division edit access
     * 4. Specific department edit access (includes all divisions in that department)
     */
    const canEdit =
      scopeInfo.hasAdminEdit || // Admin can edit everything
      scopeInfo.hasOrgEdit || // Org managers can edit everything
      (divisionId !== null && scopeInfo.editableDivisionIds.has(divisionId)) || // Division-specific edit
      (deptId !== null && scopeInfo.editableDepartmentIds.has(deptId)); // Department-specific edit

    // Transform database structure to our frontend type
    return {
      ...position,
      // Flatten nested division/department data for easier frontend consumption
      div_name: position.divisions?.name || "",
      div_code: position.divisions?.code || "",
      dept_id: position.divisions?.departments?.id || 0,
      dept_name: position.divisions?.departments?.name || "",
      dept_code: position.divisions?.departments?.code || "",
      canEdit, // Add computed edit permission
    };
  });

  return { positions: transformedPositions };
}

/**
 * Get public positions for apply page - only active(status=true) positions
 */
export async function getPublicPositions(): Promise<{
  //! todo needs to be optimized with caching
  positions: ApplyPosition[];
}> {
  const supabase = await createSupabaseClient();
  //! todo remove debug log
  console.log("database request on get public positions");

  const { data: positions, error } = await supabase
    .from("apply_positions")
    .select(
      `
      *,
      divisions!inner(
        id, name, code, dept_id,
        departments!inner(id, name, code)
      )
    `
    )
    .eq("is_deleted", false)
    .eq("status", true)
    .is("divisions.closed_at", null)
    .is("divisions.departments.closed_at", null)
    .order("divisions(dept_id)", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Error getting public positions:", error);
    return { positions: [] };
  }
  //! todo permanent positions needs to be enabled
  //! there needs to be some(3-5) permanent positions available to display at all times
  if (!positions) {
    return { positions: [] };
  }

  const transformedPositions: ApplyPosition[] = positions.map(position => ({
    ...position,
    div_name: position.divisions?.name || "",
    div_code: position.divisions?.code || "",
    dept_id: position.divisions?.departments?.id || 0,
    dept_name: position.divisions?.departments?.name || "",
    dept_code: position.divisions?.departments?.code || "",
  }));

  return { positions: transformedPositions };
}
