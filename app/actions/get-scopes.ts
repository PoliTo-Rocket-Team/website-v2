"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { Scope } from "./types";
import { getCurrentMemberId } from "./get-memberId";

/**
 * Fetch scopes for a given member from Supabase
 * @param memberId - The ID of the member to fetch scopes for
 * @returns Array of scope permissions for the member
 */
export async function getScopes(memberId: number): Promise<Scope[]> {
  const supabase = await createSupabaseClient();

  const { data: scopes, error } = await supabase
    .from("scopes")
    .select("*")
    .eq("member_id", memberId);

  if (error) {
    console.error("Error fetching scopes:", error);
    return [];
  }

  return scopes || [];
}

/**
 * Generic function to filter any items by user scope permissions
 * @param items - Array of items to filter (must have dept_id and division_id properties)
 * @returns Filtered array of items with embedded canEdit property
 */
export async function filterItemsByScope<
  T extends {
    dept_id?: number | null;
    division_id?: number | null;
  },
>(items: T[]): Promise<Array<T & { canEdit: boolean }>> {
  const memberId = await getCurrentMemberId();

  if (!memberId) {
    return [];
  }

  const scopes = await getScopes(memberId);

  // Pre-calculate user's general permissions
  const hasAllEditAccess = scopes.some(
    s => s.scope === "all" && s.access_level === "edit"
  );
  const hasAllViewAccess = scopes.some(s => s.scope === "all" && s.access_level === "view");

  // Short-circuit only if user has "all" edit access → return everything with canEdit: true
  if (hasAllEditAccess) {
    return items.map(item => ({
      ...item,
      canEdit: true,
    }));
  }

  // For all other cases (including "all" view access), filter and calculate individual permissions
  const filteredItemsWithPermissions = items
    .map(item => {
      const divisionId = item.division_id;
      const deptId = item.dept_id;

      // If user has "all" view access, they can see everything
      if (hasAllViewAccess) {
        // Check if they have specific edit permissions for this item
        const canEdit = scopes.some(
          scope =>
            scope.member_id === memberId &&
            scope.access_level === "edit" &&
            ((scope.scope === "division" &&
              scope.division_id != null &&
              divisionId != null &&
              scope.division_id === divisionId) ||
              (scope.scope === "department" &&
                scope.dept_id != null &&
                deptId != null &&
                scope.dept_id === deptId))
        );

        return {
          ...item,
          canEdit,
        };
      }

      // Otherwise, filter by division/department scopes
      const relevantScopes = scopes.filter(
        scope =>
          scope.member_id === memberId &&
          ((scope.scope === "division" &&
            scope.division_id != null &&
            divisionId != null &&
            scope.division_id === divisionId) ||
            (scope.scope === "department" &&
              scope.dept_id != null &&
              deptId != null &&
              scope.dept_id === deptId))
      );

      // If no relevant scopes, user can't access this item
      if (relevantScopes.length === 0) return null;

      // Check if any of the relevant scopes have edit access
      const canEdit = relevantScopes.some(
        scope => scope.access_level === "edit"
      );

      return {
        ...item,
        canEdit,
      };
    })
    .filter((item): item is T & { canEdit: boolean } => item !== null);

  return filteredItemsWithPermissions;
}

/**
 * Get divisions that the current user can edit
 * @returns Array of divisions the user has edit access to
 */
export async function getEditableDivisions() {
  const { createSupabaseClient } = await import("@/utils/supabase/client");
  const supabase = await createSupabaseClient();
  const memberId = await getCurrentMemberId();

  if (!memberId) {
    return [];
  }

  const scopes = await getScopes(memberId);

  // Get all active divisions first
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
    .is("closed_at", null) // Only active divisions
    .order("id"); // Order by division name for consistent ordering

  if (error) {
    console.error("Error fetching divisions:", error);
    return [];
  }

  if (!allDivisions) {
    return [];
  }

  // Check if user has "all" edit access
  const hasAllEditAccess = scopes.some(
    s => s.scope === "all" && s.access_level === "edit"
  );

  if (hasAllEditAccess) {
    return allDivisions;
  }

  // Filter divisions based on specific scopes (both division and department level)
  const divisionIds = scopes
    .filter(s => s.access_level === "edit" && s.scope === "division" && s.division_id !== null)
    .map(s => s.division_id)
    .filter(id => id !== null) as number[];

  const departmentIds = scopes
    .filter(s => s.access_level === "edit" && s.scope === "department" && s.dept_id !== null)
    .map(s => s.dept_id)
    .filter(id => id !== null) as number[];

  // Filter divisions based on user's scopes
  const editableDivisions = allDivisions.filter(division => {
    // Check if user has direct division access
    if (divisionIds.includes(division.id)) {
      return true;
    }
    
    // Check if user has department access (division belongs to accessible department)
    if (division.dept_id && departmentIds.includes(division.dept_id)) {
      return true;
    }
    
    return false;
  });

  return editableDivisions;
}


