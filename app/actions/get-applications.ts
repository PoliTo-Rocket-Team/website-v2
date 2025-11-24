"use server";

/**
 * APPLICATIONS DATA ACCESS LAYER
 *
 * This module provides secure, efficient access to applications data with:
 *
 * 1. **Database-Level Security**: Permissions enforced at query level, not application level
 * 2. **Performance Optimization**: Single-pass scope processing, Set-based lookups
 * 3. **Permission Hierarchy**: admin > org > department > division
 * 4. **Scope-Based Filtering**: Users only see applications they have access to
 *
 * FUNCTIONS:
 * - getApplicationsByMemberScope(): Authenticated users with permission filtering
 * - getAllApplications(): Legacy function for backward compatibility (should be migrated)
 */

import { createSupabaseClient } from "@/utils/supabase/client";
import { Applications } from "./types";
import { getCurrentMemberId } from "./get-memberId";
import { getMemberScopes, type ScopeInfo } from "./get-member-scopes";

/**
 * Get applications filtered by user's scope with database-level filtering
 */
export async function getApplicationsByMemberScope(): Promise<{
  applications: Applications[];
  //! todo needs to be optimized with caching
}> {
  // Get user's scope information filtered for applications target
  const { scope: scopeInfo } = (await getMemberScopes("applications")) as {
    scope: ScopeInfo;
  };

  //! todo handle no access in a better way
  // If scopeInfo is empty array (no authentication or no scopes), return NO_ACCESS
  if (Array.isArray(scopeInfo) && scopeInfo.length === 0) {
    return { applications: [] };
  }

  const supabase = await createSupabaseClient();
  console.log("database request on get applications by scope");

  /**
   * Base query selects applications with joined user and position data.
   * Filters out closed divisions/departments and includes position hierarchy.
   */
  let query = supabase
    .from("applications")
    .select(
      `
      *,
      user:users!applications_user_id_fkey(*),
      apply_position:apply_positions!inner(*,
        divisions!inner(
          id, name, code, dept_id,
          departments!inner(id, name, code),
          roles!roles_division_id_fkey(
            member_id,
            type,
            leaved_at,
            members(
              users(first_name, last_name)
            )
          )
        )
      )
    `
    )
    .is("apply_position.divisions.closed_at", null)
    .is("apply_position.divisions.departments.closed_at", null);

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
        `apply_position.division_id.in.(${divisionIdsArray.join(",")}),apply_position.divisions.dept_id.in.(${departmentIdsArray.join(",")})`
      );
    } else if (divisionIdsArray.length > 0) {
      // Filters by division_id using IN clause
      query = query.in("apply_position.division_id", divisionIdsArray);
    } else if (departmentIdsArray.length > 0) {
      // Filters by department ID through divisions relationship
      query = query.in("apply_position.divisions.dept_id", departmentIdsArray);
    }
  } else {
    /**
     * NO ACCESS: User has no permissions for any departments or divisions
     *
     * Return special marker for middleware to handle redirect.
     * More efficient than querying and getting zero results.
     */
    return { applications: []};
  }

  const { data: applications, error } = await query.order("applied_at", {
    ascending: false,
  });

  if (error) {
    console.error("Error getting applications by scope:", error);
    return { applications: [] };
  }

  if (!applications) {
    return { applications: [] };
  }

  /**
   * APPLICATION TRANSFORMATION & PROCESSING
   *
   * For each application returned from the database, we:
   * 1. Transform the raw database structure to our Applications type
   * 2. Process related applications (other applications from same user)
   * 3. Find similar applications (same name, different user)
   */
  return { applications: processApplicationsData(applications) };
}

/**
 * Process and transform applications data with related applications
 * @param applications - Raw application data from database
 * @returns Transformed applications with flattened data and related applications
 */
function processApplicationsData(applications: any[]): Applications[] {
  /**
   * Helper function to extract division lead name from roles
   * Takes the roles array from the nested query
   * Finds the active lead role (type === "lead" and leaved_at === null)
   * Extracts the full name from the nested user data
   * @param roles - Array of roles from the nested query
   * @returns Full name of the division lead or undefined if no active lead is found
   */
  const getDivisionLeadName = (roles: any[]): string | undefined => {
    if (!roles || !Array.isArray(roles)) return undefined;

    const activeLeadRole = roles.find(
      (role: any) =>
        role.type === "lead" &&
        role.leaved_at === null &&
        role.members?.users?.[0]
    );

    if (activeLeadRole?.members?.users?.[0]) {
      const user = activeLeadRole.members.users[0];
      const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim();
      return fullName || undefined;
    }

    return undefined;
  };

  // Group applications by user_id to find other applications for each user
  const applicationsByUser = new Map();
  applications.forEach((app: any) => {
    if (!applicationsByUser.has(app.user_id)) {
      applicationsByUser.set(app.user_id, []);
    }
    applicationsByUser.get(app.user_id).push(app);
  });

  // Function to normalize names for comparison
  const normalizeName = (name: string) => {
    return name?.toLowerCase().trim().replace(/\s+/g, " ") || "";
  };

  // Function to check if full names are related (exact match or one includes the other)
  const areFullNamesRelated = (
    firstName1: string,
    lastName1: string,
    firstName2: string,
    lastName2: string
  ) => {
    const fullName1 = normalizeName(`${firstName1} ${lastName1}`);
    const fullName2 = normalizeName(`${firstName2} ${lastName2}`);

    if (!fullName1 || !fullName2) return false;

    // Exact match
    if (fullName1 === fullName2) return true;

    // Check if one full name includes the other
    return fullName1.includes(fullName2) || fullName2.includes(fullName1);
  };

  // Function to find similar applications by name (different user_id, same name)
  const findSimilarApplications = (currentApp: any) => {
    const currentFirstName = currentApp.user?.first_name || "";
    const currentLastName = currentApp.user?.last_name || "";

    if (!currentFirstName || !currentLastName) {
      return [];
    }

    return applications
      .filter((app: any) => {
        // Different user
        if (app.user_id === currentApp.user_id) return false;

        // Similar name check
        const appFirstName = app.user?.first_name || "";
        const appLastName = app.user?.last_name || "";

        return areFullNamesRelated(
          currentFirstName,
          currentLastName,
          appFirstName,
          appLastName
        );
      })
      .map((app: any) => ({
        id: app.id,
        status: app.status,
        applied_at: app.applied_at,
        position_title: app.apply_position?.title ?? "",
        division: app.apply_position?.divisions?.name ?? "",
        department: app.apply_position?.divisions?.departments?.name ?? "",
        division_lead_name: getDivisionLeadName(
          app.apply_position?.divisions?.roles
        ),
        user_email: app.user?.email || "",
        user_first_name: app.user?.first_name || "",
        user_last_name: app.user?.last_name || "",
      }));
  };

  // transform application data to match ApplicationWithUser type
  // map nested user fields to top-level fields and include other applications
  const transformedApplications: Applications[] = applications.map(
    (app: any) => {
      const userApps = applicationsByUser.get(app.user_id) || [];
      // Filter out the current application to get other applications
      const otherApps = userApps
        .filter((otherApp: any) => otherApp.id !== app.id)
        .map((otherApp: any) => ({
          id: otherApp.id,
          status: otherApp.status,
          applied_at: otherApp.applied_at,
          position_title: otherApp.apply_position?.title ?? "",
          division: otherApp.apply_position?.divisions?.name ?? "",
          department:
            otherApp.apply_position?.divisions?.departments?.name ?? "",
          division_lead_name: getDivisionLeadName(
            otherApp.apply_position?.divisions?.roles
          ),
        }));

      // Find similar applications (same name, different user)
      const similarApps = findSimilarApplications(app);

      return {
        ...app,
        // user flatten
        user_email: app.user?.email || "",
        user_first_name: app.user?.first_name || "",
        user_last_name: app.user?.last_name || "",
        user_origin: app.user?.origin || "",
        user_level_of_study: app.user?.level_of_study || "",
        user_polito_id: app.user?.polito_id || "",
        user_program: app.user?.program || "",
        user_gender: app.user?.gender || "",
        user_date_of_birth: app.user?.date_of_birth || "",
        user_mobile_number: app.user?.mobile_number || "",
        user_polito_email: app.user?.polito_email || "",

        // position flatten
        position_title: app.apply_position?.title ?? "",
        division: app.apply_position?.divisions?.name ?? "",
        div_id: app.apply_position?.divisions?.id ?? 0,
        department: app.apply_position?.divisions?.departments?.name ?? "",
        dept_id: app.apply_position?.divisions?.departments?.id ?? 0,

        // other applications for this user
        other_applications: otherApps,
        // similar applications (same name, different email)
        similar_applications: similarApps,
      };
    }
  );

  return transformedApplications;
}
