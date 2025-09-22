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
