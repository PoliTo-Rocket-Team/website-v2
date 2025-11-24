import { createClient } from "@supabase/supabase-js";

/**
 * Permission check helper for middleware
 * 
 * This module provides lightweight permission checking for middleware
 * without the full overhead of server actions
 */

export type TargetType = 'positions' | 'applications' | 'members' | 'all';

interface PermissionCheckResult {
  hasAccess: boolean;
}

/**
 * Check if user has any access to a specific target
 * Used by middleware to gate access to protected pages
 * 
 * @param userId - User ID to check permissions for
 * @param target - Target resource type (positions, applications, members)
 * @param supabaseAccessToken - Supabase access token from session
 * @returns Promise with access result
 */
export async function checkUserHasAccess(
  userId: string,
  target: TargetType,
  supabaseAccessToken: string
): Promise<PermissionCheckResult> {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing required Supabase environment variables");
      return { hasAccess: false };
    }

    // Create Supabase client with user's token
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${supabaseAccessToken}`,
          },
        },
      }
    );

    // Query user's scopes for the target
    // Using explicit filter for enum-based target matching (safe from injection)
    const { data: scopes, error } = await supabase
      .from("scopes")
      .select("scope, target")
      .eq("user_id", userId)
      .or(`target.eq.${target},target.eq.all`);

    if (error) {
      console.error("Error checking permissions:", error);
      return { hasAccess: false };
    }

    // User has access if they have any scope matching the target
    const hasAccess = scopes && scopes.length > 0;

    return { hasAccess };
  } catch (error) {
    console.error("Error in permission check:", error);
    return { hasAccess: false };
  }
}

/**
 * Map dashboard paths to their required target permissions
 */
export const PROTECTED_ROUTES: Record<string, TargetType> = {
  '/dashboard/positions': 'positions',
  '/dashboard/applications': 'applications',
  '/dashboard/members': 'members',
};

/**
 * Check if a path is a protected route that requires permission checking
 */
export function isProtectedRoute(pathname: string): boolean {
  return pathname in PROTECTED_ROUTES;
}

/**
 * Get the required target for a protected route
 */
export function getRequiredTarget(pathname: string): TargetType | null {
  return PROTECTED_ROUTES[pathname] || null;
}
