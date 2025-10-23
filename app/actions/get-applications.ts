"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { Applications } from "./types";

/**
 * Get all applications with the full user record embedded and other applications for each user.
 * Relies on the FK applications.user_id -> public.users.id
 * Also flattens some fields for easier access (no nested user or apply_position objects).
 */
export async function getAllApplications() {
  const supabase = await createSupabaseClient();

  const { data: applications, error } = await supabase
    .from("applications")
    .select(
      `
			*,
      user:users!applications_user_id_fkey(*),
      apply_position:apply_positions(*,
        divisions:divisions(
          id, name, code, dept_id,
          departments:departments(id, name, code)
        )
      )
		`
    )
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("Error fetching applications:", error);
    return { applications: [] };
  }
  if (!applications) {
    return { applications: [] };
  }

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
        user_email: app.user?.email || "",
        user_first_name: app.user?.first_name || "",
        user_last_name: app.user?.last_name || "",
      }));
  };

  // transform application data to match ApplicationWithUser type
  // map nested user fields to top-level fields and include other applications
  const application: Applications[] = applications.map((app: any) => {
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
        department: otherApp.apply_position?.divisions?.departments?.name ?? "",
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
  });

  return { applications: application };
}
